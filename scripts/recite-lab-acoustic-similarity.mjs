import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");
const LAB_DIR = path.join(ROOT_DIR, "artifacts", "recite-lab");
const ANALYSIS_DIR = path.join(LAB_DIR, "analysis");
const DEFAULT_MANIFEST_FILE = path.join(ANALYSIS_DIR, "audio-manifest.jsonl");
const RESULTS_FILE = path.join(ANALYSIS_DIR, "acoustic-similarity-results.jsonl");
const SUMMARY_FILE = path.join(ANALYSIS_DIR, "acoustic-similarity-summary.json");
const EXPERIMENT_VERSION = "recite-lab-acoustic-similarity-v0.1";
const KNOWN_LABELS = new Set(["correct", "skip", "repeat", "wrong"]);

function parseArgs(argv) {
  const options = {
    write: false,
    json: false,
    manifestFile: DEFAULT_MANIFEST_FILE,
    scopeLabel: "1:1-7",
    maxFrames: 260,
    referenceCount: 3,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--write") {
      options.write = true;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--manifest") {
      const value = argv[index + 1];
      if (!value) throw new Error("--manifest must be followed by a path.");
      options.manifestFile = path.resolve(ROOT_DIR, value);
      index += 1;
    } else if (arg === "--scope") {
      const value = argv[index + 1];
      if (!value) throw new Error("--scope must be followed by a scope label.");
      options.scopeLabel = value;
      index += 1;
    } else if (arg === "--max-frames") {
      const value = Number.parseInt(argv[index + 1] ?? "", 10);
      if (!Number.isFinite(value) || value < 20) {
        throw new Error("--max-frames must be followed by a number >= 20.");
      }
      options.maxFrames = value;
      index += 1;
    } else if (arg === "--references") {
      const value = Number.parseInt(argv[index + 1] ?? "", 10);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error("--references must be followed by a positive number.");
      }
      options.referenceCount = value;
      index += 1;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

async function readJsonl(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`Missing manifest file: ${path.relative(ROOT_DIR, filePath)}`);
  }

  const content = await readFile(filePath, "utf8");
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Could not parse ${path.basename(filePath)} line ${index + 1}: ${message}`);
      }
    });
}

function readAscii(buffer, start, end) {
  return buffer.toString("ascii", start, end);
}

function parseWav(buffer, filePath) {
  if (readAscii(buffer, 0, 4) !== "RIFF" || readAscii(buffer, 8, 12) !== "WAVE") {
    throw new Error(`${filePath} is not a RIFF/WAVE file.`);
  }

  let offset = 12;
  let format = null;
  let dataStart = null;
  let dataSize = null;

  while (offset + 8 <= buffer.length) {
    const chunkId = readAscii(buffer, offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    const nextOffset = chunkStart + chunkSize + (chunkSize % 2);

    if (chunkId === "fmt ") {
      format = {
        audioFormat: buffer.readUInt16LE(chunkStart),
        channels: buffer.readUInt16LE(chunkStart + 2),
        sampleRate: buffer.readUInt32LE(chunkStart + 4),
        blockAlign: buffer.readUInt16LE(chunkStart + 12),
        bitsPerSample: buffer.readUInt16LE(chunkStart + 14),
      };
    } else if (chunkId === "data") {
      dataStart = chunkStart;
      dataSize = chunkSize;
    }

    offset = nextOffset;
  }

  if (!format || dataStart === null || dataSize === null) {
    throw new Error(`${filePath} is missing fmt or data chunks.`);
  }

  const bytesPerSample = format.bitsPerSample / 8;
  const frameCount = Math.floor(dataSize / format.blockAlign);
  const samples = new Float32Array(frameCount);

  function readSample(sampleOffset) {
    if (format.audioFormat === 3 && format.bitsPerSample === 32) {
      return buffer.readFloatLE(sampleOffset);
    }
    if (format.audioFormat !== 1) {
      throw new Error(`${filePath} uses unsupported WAV format ${format.audioFormat}.`);
    }
    if (format.bitsPerSample === 16) return buffer.readInt16LE(sampleOffset) / 32768;
    if (format.bitsPerSample === 24) {
      const unsigned =
        buffer[sampleOffset] |
        (buffer[sampleOffset + 1] << 8) |
        (buffer[sampleOffset + 2] << 16);
      const signed = unsigned & 0x800000 ? unsigned | 0xff000000 : unsigned;
      return signed / 8388608;
    }
    if (format.bitsPerSample === 32) return buffer.readInt32LE(sampleOffset) / 2147483648;
    if (format.bitsPerSample === 8) return (buffer.readUInt8(sampleOffset) - 128) / 128;
    throw new Error(`${filePath} uses unsupported ${format.bitsPerSample}-bit PCM.`);
  }

  for (let frame = 0; frame < frameCount; frame += 1) {
    const frameOffset = dataStart + frame * format.blockAlign;
    let mono = 0;
    for (let channel = 0; channel < format.channels; channel += 1) {
      mono += readSample(frameOffset + channel * bytesPerSample);
    }
    samples[frame] = mono / format.channels;
  }

  return {
    sampleRate: format.sampleRate,
    channels: format.channels,
    bitsPerSample: format.bitsPerSample,
    samples,
  };
}

function percentile(sortedValues, percentileValue) {
  if (sortedValues.length === 0) return 0;
  const index = (sortedValues.length - 1) * percentileValue;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedValues[lower] ?? 0;
  const weight = index - lower;
  return (sortedValues[lower] ?? 0) * (1 - weight) + (sortedValues[upper] ?? 0) * weight;
}

function resampleTo16k(samples, sampleRate) {
  if (sampleRate === 16000) return samples;
  const targetLength = Math.max(1, Math.round((samples.length * 16000) / sampleRate));
  const output = new Float32Array(targetLength);
  const ratio = sampleRate / 16000;

  for (let index = 0; index < targetLength; index += 1) {
    const sourceIndex = index * ratio;
    const lower = Math.floor(sourceIndex);
    const upper = Math.min(samples.length - 1, lower + 1);
    const weight = sourceIndex - lower;
    output[index] = (samples[lower] ?? 0) * (1 - weight) + (samples[upper] ?? 0) * weight;
  }

  return output;
}

function makeHamming(size) {
  return Array.from({ length: size }, (_, index) => {
    if (size === 1) return 1;
    return 0.54 - 0.46 * Math.cos((2 * Math.PI * index) / (size - 1));
  });
}

function goertzelPower(samples, start, frameSize, sampleRate, frequency, window) {
  const omega = (2 * Math.PI * frequency) / sampleRate;
  const coefficient = 2 * Math.cos(omega);
  let previous = 0;
  let previous2 = 0;

  for (let index = 0; index < frameSize; index += 1) {
    const sample = (samples[start + index] ?? 0) * window[index];
    const current = sample + coefficient * previous - previous2;
    previous2 = previous;
    previous = current;
  }

  return previous2 * previous2 + previous * previous - coefficient * previous * previous2;
}

function frameRms(samples, start, frameSize) {
  let sumSq = 0;
  for (let index = 0; index < frameSize; index += 1) {
    const sample = samples[start + index] ?? 0;
    sumSq += sample * sample;
  }
  return Math.sqrt(sumSq / frameSize);
}

function normalizeVector(values) {
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) / Math.max(1, values.length - 1);
  const scale = Math.sqrt(variance) || 1;
  return values.map((value) => (value - average) / scale);
}

function extractSpeechFrames(wav, maxFrames) {
  const samples = resampleTo16k(wav.samples, wav.sampleRate);
  const sampleRate = 16000;
  const frameSize = Math.round(sampleRate * 0.025);
  const hopSize = Math.round(sampleRate * 0.01);
  const window = makeHamming(frameSize);
  const centers = [220, 300, 410, 560, 760, 1030, 1400, 1900, 2600, 3500];
  const frames = [];
  const rmsValues = [];

  for (let start = 0; start + frameSize <= samples.length; start += hopSize) {
    const rms = frameRms(samples, start, frameSize);
    rmsValues.push(rms);
    const bands = centers.map((frequency) =>
      Math.log(goertzelPower(samples, start, frameSize, sampleRate, frequency, window) + 1e-10),
    );
    frames.push({
      rms,
      vector: normalizeVector([...bands, Math.log(rms + 1e-8)]),
    });
  }

  const sortedRms = [...rmsValues].sort((a, b) => a - b);
  const p20 = percentile(sortedRms, 0.2);
  const p90 = percentile(sortedRms, 0.9);
  const threshold = Math.max(p20 * 2.6, p90 * 0.16, 0.0005);
  const speechFrames = frames.filter((frame) => frame.rms >= threshold);
  const selected = speechFrames.length > 12 ? speechFrames : frames;
  return compressSequence(
    selected.map((frame) => frame.vector),
    maxFrames,
  );
}

function compressSequence(sequence, maxFrames) {
  if (sequence.length <= maxFrames) return sequence;
  const output = [];
  const dimensions = sequence[0]?.length ?? 0;

  for (let bucket = 0; bucket < maxFrames; bucket += 1) {
    const start = Math.floor((bucket * sequence.length) / maxFrames);
    const end = Math.max(start + 1, Math.floor(((bucket + 1) * sequence.length) / maxFrames));
    const vector = Array.from({ length: dimensions }, () => 0);
    for (let index = start; index < end; index += 1) {
      const item = sequence[index] ?? [];
      for (let dimension = 0; dimension < dimensions; dimension += 1) {
        vector[dimension] += item[dimension] ?? 0;
      }
    }
    output.push(vector.map((value) => value / (end - start)));
  }

  return output;
}

function vectorDistance(a, b) {
  let sum = 0;
  for (let index = 0; index < a.length; index += 1) {
    const delta = (a[index] ?? 0) - (b[index] ?? 0);
    sum += delta * delta;
  }
  return Math.sqrt(sum / Math.max(1, a.length));
}

function dtwDistance(a, b) {
  if (a.length === 0 || b.length === 0) return Number.POSITIVE_INFINITY;
  const band = Math.max(
    10,
    Math.abs(a.length - b.length),
    Math.ceil(Math.max(a.length, b.length) * 0.22),
  );
  let previous = Array.from({ length: b.length + 1 }, () => Number.POSITIVE_INFINITY);
  let current = Array.from({ length: b.length + 1 }, () => Number.POSITIVE_INFINITY);
  previous[0] = 0;

  for (let i = 1; i <= a.length; i += 1) {
    current.fill(Number.POSITIVE_INFINITY);
    const jStart = Math.max(1, i - band);
    const jEnd = Math.min(b.length, i + band);
    for (let j = jStart; j <= jEnd; j += 1) {
      const cost = vectorDistance(a[i - 1], b[j - 1]);
      current[j] = cost + Math.min(previous[j], current[j - 1], previous[j - 1]);
    }
    [previous, current] = [current, previous];
  }

  return previous[b.length] / (a.length + b.length);
}

async function loadSequence(row, options) {
  const buffer = await readFile(path.resolve(ROOT_DIR, row.audioFile));
  const wav = parseWav(buffer, row.audioFile);
  return {
    ...row,
    sequence: extractSpeechFrames(wav, options.maxFrames),
    audioDurationSec: wav.samples.length / wav.sampleRate,
  };
}

function expectedDecisionForLabel(label) {
  if (label === "correct") return "pass";
  if (label === "skip" || label === "repeat" || label === "wrong") return "not_pass";
  return null;
}

function summarizePredictions(predictions) {
  const matrix = {};
  let correct = 0;
  for (const prediction of predictions) {
    matrix[`${prediction.actual}:${prediction.predicted}`] =
      (matrix[`${prediction.actual}:${prediction.predicted}`] ?? 0) + 1;
    if (prediction.actual === prediction.predicted) correct += 1;
  }
  return {
    total: predictions.length,
    correct,
    accuracy: predictions.length === 0 ? null : Number((correct / predictions.length).toFixed(4)),
    matrix,
    mismatches: predictions.filter((prediction) => prediction.actual !== prediction.predicted),
  };
}

function bestThreshold(scoredRows) {
  const candidates = [...new Set(scoredRows.map((row) => row.distance))]
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (candidates.length === 0) return null;

  let best = null;
  for (const threshold of candidates) {
    const predictions = scoredRows.map((row) => ({
      actual: expectedDecisionForLabel(row.label),
      predicted: row.distance <= threshold ? "pass" : "not_pass",
    }));
    const summary = summarizePredictions(predictions);
    const passRecall =
      (summary.matrix["pass:pass"] ?? 0) /
      Math.max(1, (summary.matrix["pass:pass"] ?? 0) + (summary.matrix["pass:not_pass"] ?? 0));
    const notPassRecall =
      (summary.matrix["not_pass:not_pass"] ?? 0) /
      Math.max(
        1,
        (summary.matrix["not_pass:not_pass"] ?? 0) + (summary.matrix["not_pass:pass"] ?? 0),
      );
    const balancedAccuracy = (passRecall + notPassRecall) / 2;
    if (
      !best ||
      balancedAccuracy > best.balancedAccuracy ||
      (balancedAccuracy === best.balancedAccuracy && summary.accuracy > best.accuracy)
    ) {
      best = {
        threshold,
        accuracy: summary.accuracy,
        balancedAccuracy: Number(balancedAccuracy.toFixed(4)),
        matrix: summary.matrix,
      };
    }
  }

  return best;
}

function getNearestReferenceDistances(row, references, options, weights) {
  return references
    .filter((reference) => reference.id !== row.id)
    .map((reference) => {
      const acousticDistance = dtwDistance(row.sequence, reference.sequence);
      const durationPenalty = Math.abs(
        Math.log(Math.max(0.001, row.audioDurationSec) / Math.max(0.001, reference.audioDurationSec)),
      );
      const framePenalty = Math.abs(
        Math.log(Math.max(1, row.sequence.length) / Math.max(1, reference.sequence.length)),
      );
      return {
        id: reference.id,
        acousticDistance,
        durationPenalty,
        framePenalty,
        distance:
          acousticDistance +
          weights.duration * durationPenalty +
          weights.frame * framePenalty,
      };
    })
    .sort((a, b) => a.distance - b.distance);
}

function scoreRows(rows, references, options, weights) {
  return rows
    .filter((row) => KNOWN_LABELS.has(row.label))
    .map((row) => {
      const referenceDistances = getNearestReferenceDistances(row, references, options, weights);
      const nearest = referenceDistances.slice(0, options.referenceCount);
      const distance =
        nearest.reduce((sum, item) => sum + item.distance, 0) / Math.max(1, nearest.length);
      const acousticDistance =
        nearest.reduce((sum, item) => sum + item.acousticDistance, 0) /
        Math.max(1, nearest.length);
      const durationPenalty =
        nearest.reduce((sum, item) => sum + item.durationPenalty, 0) / Math.max(1, nearest.length);
      const framePenalty =
        nearest.reduce((sum, item) => sum + item.framePenalty, 0) / Math.max(1, nearest.length);
      return {
        id: row.id,
        label: row.label,
        expectedDecision: expectedDecisionForLabel(row.label),
        currentDecision: row.currentDecision,
        scope: row.expectedScope?.label ?? null,
        scopeMode: row.expectedScope?.mode ?? null,
        audioFile: row.audioFile,
        frameCount: row.sequence.length,
        audioDurationSec: row.audioDurationSec,
        distance,
        acousticDistance,
        durationPenalty,
        framePenalty,
        nearestReferences: nearest,
      };
    });
}

function calibrateRows(rows, references, options) {
  const durationWeights = [0, 0.03, 0.06, 0.1, 0.14, 0.2, 0.3];
  const frameWeights = [0, 0.02, 0.05, 0.08, 0.12];
  let best = null;

  for (const duration of durationWeights) {
    for (const frame of frameWeights) {
      const weights = { duration, frame };
      const scoredRows = scoreRows(rows, references, options, weights);
      const threshold = bestThreshold(scoredRows);
      if (!threshold) continue;
      const candidate = { weights, scoredRows, threshold };
      if (
        !best ||
        threshold.balancedAccuracy > best.threshold.balancedAccuracy ||
        (threshold.balancedAccuracy === best.threshold.balancedAccuracy &&
          threshold.accuracy > best.threshold.accuracy)
      ) {
        best = candidate;
      }
    }
  }

  if (!best) {
    const weights = { duration: 0, frame: 0 };
    return {
      weights,
      scoredRows: scoreRows(rows, references, options, weights),
      threshold: null,
    };
  }

  return best;
}

function buildSummary(scoredRows, references, options, calibration) {
  const threshold = bestThreshold(scoredRows);
  const predictions = scoredRows.map((row) => ({
    id: row.id,
    actual: row.expectedDecision,
    predicted: threshold && row.distance <= threshold.threshold ? "pass" : "not_pass",
    distance: row.distance,
    label: row.label,
  }));
  const predictionSummary = summarizePredictions(predictions);
  const byLabel = {};
  for (const row of scoredRows) {
    byLabel[row.label] ??= [];
    byLabel[row.label].push(row.distance);
  }

  return {
    generatedAt: new Date().toISOString(),
    experimentVersion: EXPERIMENT_VERSION,
    manifestFile: path.relative(ROOT_DIR, options.manifestFile),
    scopeLabel: options.scopeLabel,
    maxFrames: options.maxFrames,
    referenceCount: options.referenceCount,
    calibratedWeights: calibration.weights,
    rowCount: scoredRows.length,
    referenceRows: references.map((row) => row.id),
    bestThreshold: threshold,
    predictionSummary,
    distanceByLabel: Object.fromEntries(
      Object.entries(byLabel).map(([label, distances]) => [
        label,
        {
          count: distances.length,
          min: Math.min(...distances),
          mean: distances.reduce((sum, value) => sum + value, 0) / distances.length,
          max: Math.max(...distances),
        },
      ]),
    ),
  };
}

function printSummary(summary) {
  console.log("Recite Lab acoustic similarity");
  console.log(`Scope: ${summary.scopeLabel}`);
  console.log(`Rows: ${summary.rowCount}`);
  console.log(`Correct references: ${summary.referenceRows.length}`);
  console.log(
    `Best pass threshold: ${
      summary.bestThreshold ? summary.bestThreshold.threshold.toFixed(4) : "n/a"
    }`,
  );
  console.log(
    `Weights: duration=${summary.calibratedWeights.duration}, frame=${summary.calibratedWeights.frame}`,
  );
  console.log(
    `Pass/not-pass accuracy: ${summary.predictionSummary.correct}/${summary.predictionSummary.total} (${summary.predictionSummary.accuracy})`,
  );
  console.log(
    `Balanced accuracy: ${
      summary.bestThreshold ? summary.bestThreshold.balancedAccuracy : "n/a"
    }`,
  );
  console.log(`Matrix: ${JSON.stringify(summary.predictionSummary.matrix)}`);
  console.log("");
  console.log(
    `Distance by label: ${JSON.stringify(
      Object.fromEntries(
        Object.entries(summary.distanceByLabel).map(([label, stats]) => [
          label,
          {
            count: stats.count,
            mean: Number(stats.mean.toFixed(4)),
            min: Number(stats.min.toFixed(4)),
            max: Number(stats.max.toFixed(4)),
          },
        ]),
      ),
    )}`,
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const manifestRows = (await readJsonl(options.manifestFile)).filter(
    (row) =>
      row.audioFile &&
      KNOWN_LABELS.has(row.label) &&
      (row.expectedScope?.label ?? null) === options.scopeLabel,
  );

  const rows = [];
  for (const row of manifestRows) {
    rows.push(await loadSequence(row, options));
  }

  const cleanReferences = rows.filter(
    (row) =>
      row.label === "correct" &&
      row.currentDecision === "pass" &&
      row.labelDecisionMismatch !== true,
  );
  const references =
    cleanReferences.length >= 2 ? cleanReferences : rows.filter((row) => row.label === "correct");
  if (references.length < 2) {
    throw new Error(`Need at least two correct reference recordings for ${options.scopeLabel}.`);
  }

  const calibration = calibrateRows(rows, references, options);
  const scoredRows = calibration.scoredRows;
  const summary = buildSummary(scoredRows, references, options, calibration);

  if (options.write) {
    await mkdir(ANALYSIS_DIR, { recursive: true });
    await writeFile(
      RESULTS_FILE,
      `${scoredRows.map((row) => JSON.stringify(row)).join("\n")}\n`,
      "utf8",
    );
    await writeFile(SUMMARY_FILE, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  }

  if (options.json) {
    console.log(JSON.stringify({ summary, scoredRows }, null, 2));
    return;
  }

  printSummary(summary);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
