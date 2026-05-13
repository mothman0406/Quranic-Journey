import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");
const LAB_DIR = path.join(ROOT_DIR, "artifacts", "recite-lab");
const ANALYSIS_DIR = path.join(LAB_DIR, "analysis");
const DEFAULT_MANIFEST_FILE = path.join(ANALYSIS_DIR, "audio-manifest.jsonl");
const FEATURE_MANIFEST_FILE = path.join(ANALYSIS_DIR, "audio-feature-manifest.jsonl");
const SUMMARY_FILE = path.join(ANALYSIS_DIR, "audio-experiment-summary.json");
const FEATURE_VERSION = "recite-lab-audio-features-v0.1";
const KNOWN_LABELS = new Set(["correct", "skip", "repeat", "wrong"]);

function parseArgs(argv) {
  const options = {
    write: false,
    json: false,
    includeNoisy: false,
    manifestFile: DEFAULT_MANIFEST_FILE,
    k: 3,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--write") {
      options.write = true;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--include-noisy") {
      options.includeNoisy = true;
    } else if (arg === "--manifest") {
      const value = argv[index + 1];
      if (!value) throw new Error("--manifest must be followed by a path.");
      options.manifestFile = path.resolve(ROOT_DIR, value);
      index += 1;
    } else if (arg === "--k") {
      const value = Number.parseInt(argv[index + 1] ?? "", 10);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error("--k must be followed by a positive number.");
      }
      options.k = value;
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
        byteRate: buffer.readUInt32LE(chunkStart + 8),
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
  if (format.channels <= 0 || format.sampleRate <= 0 || format.blockAlign <= 0) {
    throw new Error(`${filePath} has an invalid WAV format.`);
  }

  const frameCount = Math.floor(dataSize / format.blockAlign);
  const samples = new Float32Array(frameCount);
  const bytesPerSample = format.bitsPerSample / 8;

  function readSample(sampleOffset) {
    if (format.audioFormat === 3 && format.bitsPerSample === 32) {
      return buffer.readFloatLE(sampleOffset);
    }
    if (format.audioFormat === 3 && format.bitsPerSample === 64) {
      return buffer.readDoubleLE(sampleOffset);
    }
    if (format.audioFormat !== 1) {
      throw new Error(`${filePath} uses unsupported WAV format ${format.audioFormat}.`);
    }

    if (format.bitsPerSample === 8) {
      return (buffer.readUInt8(sampleOffset) - 128) / 128;
    }
    if (format.bitsPerSample === 16) {
      return buffer.readInt16LE(sampleOffset) / 32768;
    }
    if (format.bitsPerSample === 24) {
      const unsigned =
        buffer[sampleOffset] |
        (buffer[sampleOffset + 1] << 8) |
        (buffer[sampleOffset + 2] << 16);
      const signed = unsigned & 0x800000 ? unsigned | 0xff000000 : unsigned;
      return signed / 8388608;
    }
    if (format.bitsPerSample === 32) {
      return buffer.readInt32LE(sampleOffset) / 2147483648;
    }

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
    audioFormat: format.audioFormat,
    channels: format.channels,
    sampleRate: format.sampleRate,
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

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  return percentile(sorted, 0.5);
}

function countZeroCrossings(samples, start, end) {
  let crossings = 0;
  let previous = samples[start] ?? 0;
  for (let index = start + 1; index < end; index += 1) {
    const current = samples[index] ?? 0;
    if ((previous < 0 && current >= 0) || (previous >= 0 && current < 0)) {
      crossings += 1;
    }
    previous = current;
  }
  return crossings;
}

function frameAudio(samples, sampleRate) {
  const frameSize = Math.max(1, Math.round(sampleRate * 0.025));
  const hopSize = Math.max(1, Math.round(sampleRate * 0.01));
  const frames = [];

  for (let start = 0; start + frameSize <= samples.length; start += hopSize) {
    let sumSq = 0;
    let peak = 0;
    const end = start + frameSize;
    for (let index = start; index < end; index += 1) {
      const sample = samples[index] ?? 0;
      sumSq += sample * sample;
      peak = Math.max(peak, Math.abs(sample));
    }
    const zcr = countZeroCrossings(samples, start, end) / frameSize;
    frames.push({
      startSec: start / sampleRate,
      endSec: end / sampleRate,
      rms: Math.sqrt(sumSq / frameSize),
      peak,
      zcr,
    });
  }

  return frames;
}

function buildSegments(frames, threshold) {
  const rawSegments = [];
  let current = null;

  for (const frame of frames) {
    if (frame.rms >= threshold) {
      if (!current) {
        current = { startSec: frame.startSec, endSec: frame.endSec };
      } else {
        current.endSec = frame.endSec;
      }
    } else if (current) {
      rawSegments.push(current);
      current = null;
    }
  }
  if (current) rawSegments.push(current);

  const merged = [];
  for (const segment of rawSegments) {
    const previous = merged[merged.length - 1];
    if (previous && segment.startSec - previous.endSec <= 0.15) {
      previous.endSec = segment.endSec;
    } else {
      merged.push({ ...segment });
    }
  }

  return merged.filter((segment) => segment.endSec - segment.startSec >= 0.08);
}

function extractAudioFeatures(wav) {
  const { samples, sampleRate } = wav;
  const durationSec = samples.length / sampleRate;
  let sumSq = 0;
  let peak = 0;

  for (const sample of samples) {
    sumSq += sample * sample;
    peak = Math.max(peak, Math.abs(sample));
  }

  const globalRms = Math.sqrt(sumSq / Math.max(1, samples.length));
  const frames = frameAudio(samples, sampleRate);
  const frameRms = frames.map((frame) => frame.rms).sort((a, b) => a - b);
  const p20 = percentile(frameRms, 0.2);
  const p50 = percentile(frameRms, 0.5);
  const p90 = percentile(frameRms, 0.9);
  const voiceThreshold = Math.max(p20 * 2.6, p90 * 0.16, globalRms * 0.28, 0.0005);
  const segments = buildSegments(frames, voiceThreshold);
  const activeSpeechSec = segments.reduce(
    (sum, segment) => sum + (segment.endSec - segment.startSec),
    0,
  );
  const pauses = [];
  for (let index = 1; index < segments.length; index += 1) {
    pauses.push(Math.max(0, segments[index].startSec - segments[index - 1].endSec));
  }

  const voicedFrames = frames.filter((frame) => frame.rms >= voiceThreshold);
  const speechRms = Math.sqrt(
    voicedFrames.reduce((sum, frame) => sum + frame.rms * frame.rms, 0) /
      Math.max(1, voicedFrames.length),
  );
  const meanZcr =
    frames.reduce((sum, frame) => sum + frame.zcr, 0) / Math.max(1, frames.length);
  const voicedZcr =
    voicedFrames.reduce((sum, frame) => sum + frame.zcr, 0) /
    Math.max(1, voicedFrames.length);

  return {
    sampleRate,
    channels: wav.channels,
    bitsPerSample: wav.bitsPerSample,
    audioFormat: wav.audioFormat,
    durationSec,
    activeSpeechSec,
    voicedRatio: durationSec === 0 ? 0 : activeSpeechSec / durationSec,
    segmentCount: segments.length,
    pauseCount: pauses.length,
    longestPauseSec: pauses.length ? Math.max(...pauses) : 0,
    meanPauseSec: pauses.length ? pauses.reduce((sum, value) => sum + value, 0) / pauses.length : 0,
    globalRms,
    speechRms,
    peak,
    rmsP20: p20,
    rmsP50: p50,
    rmsP90: p90,
    rmsDynamicRange: p20 === 0 ? 0 : p90 / p20,
    voiceThreshold,
    meanZcr,
    voicedZcr,
  };
}

async function loadFeatureRow(manifestRow) {
  const absoluteAudioPath = path.resolve(ROOT_DIR, manifestRow.audioFile);
  const buffer = await readFile(absoluteAudioPath);
  const wav = parseWav(buffer, manifestRow.audioFile);
  const features = extractAudioFeatures(wav);
  const expectedWordCount = Math.max(1, manifestRow.expectedWordCount ?? 1);

  return {
    id: manifestRow.id,
    label: manifestRow.label,
    rawLabel: manifestRow.rawLabel,
    expectedDecision: manifestRow.expectedDecision,
    currentDecision: manifestRow.currentDecision,
    rawPayloadDecision: manifestRow.rawPayloadDecision,
    decisionVersion: manifestRow.decisionVersion,
    labelDecisionMismatch: manifestRow.labelDecisionMismatch,
    audioFile: manifestRow.audioFile,
    audioBytes: manifestRow.audioBytes,
    savedAt: manifestRow.savedAt,
    route: manifestRow.route,
    expectedScope: manifestRow.expectedScope,
    expectedWordCount: manifestRow.expectedWordCount,
    transcriptTokenCount: manifestRow.heardTokenCount,
    acceptedCount: manifestRow.acceptedCount,
    transcriptScore: manifestRow.score,
    features: {
      ...features,
      durationPerExpectedWord: features.durationSec / expectedWordCount,
      activeSpeechPerExpectedWord: features.activeSpeechSec / expectedWordCount,
      segmentsPerExpectedWord: features.segmentCount / expectedWordCount,
      pausesPerExpectedWord: features.pauseCount / expectedWordCount,
      logGlobalRms: Math.log10(features.globalRms + 1e-8),
      logSpeechRms: Math.log10(features.speechRms + 1e-8),
    },
  };
}

function mean(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stdev(values, average) {
  if (values.length <= 1) return 1;
  const variance =
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance) || 1;
}

function standardize(rows, featureNames) {
  const stats = Object.fromEntries(
    featureNames.map((name) => {
      const values = rows.map((row) => row.features[name]).filter(Number.isFinite);
      const average = mean(values);
      return [name, { mean: average, stdev: stdev(values, average) }];
    }),
  );

  return rows.map((row) => ({
    row,
    vector: featureNames.map((name) => {
      const value = row.features[name];
      const stat = stats[name];
      return Number.isFinite(value) && stat ? (value - stat.mean) / stat.stdev : 0;
    }),
  }));
}

function euclideanDistance(a, b) {
  let sum = 0;
  for (let index = 0; index < a.length; index += 1) {
    const delta = (a[index] ?? 0) - (b[index] ?? 0);
    sum += delta * delta;
  }
  return Math.sqrt(sum);
}

function predictKnn(standardizedRows, rowIndex, labelForRow, k) {
  const target = standardizedRows[rowIndex];
  const neighbors = standardizedRows
    .map((candidate, index) => ({
      index,
      label: labelForRow(candidate.row),
      distance: index === rowIndex ? Number.POSITIVE_INFINITY : euclideanDistance(target.vector, candidate.vector),
    }))
    .filter((candidate) => candidate.label)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, Math.max(1, Math.min(k, standardizedRows.length - 1)));

  const scores = new Map();
  for (const neighbor of neighbors) {
    const score = 1 / Math.max(neighbor.distance, 1e-6);
    scores.set(neighbor.label, (scores.get(neighbor.label) ?? 0) + score);
  }

  return [...scores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function evaluateKnn(rows, featureNames, labelForRow, k) {
  const eligibleRows = rows.filter((row) => labelForRow(row));
  const standardizedRows = standardize(eligibleRows, featureNames);
  const predictions = standardizedRows.map((item, index) => ({
    id: item.row.id,
    actual: labelForRow(item.row),
    predicted: predictKnn(standardizedRows, index, labelForRow, k),
  }));
  return summarizePredictions(predictions);
}

function centroidForRows(items) {
  if (items.length === 0) return [];
  const dimensions = items[0].vector.length;
  const centroid = Array.from({ length: dimensions }, () => 0);

  for (const item of items) {
    for (let index = 0; index < dimensions; index += 1) {
      centroid[index] += item.vector[index] ?? 0;
    }
  }

  return centroid.map((value) => value / items.length);
}

function predictNearestCentroid(standardizedRows, rowIndex, labelForRow) {
  const target = standardizedRows[rowIndex];
  const labels = [...new Set(standardizedRows.map((item) => labelForRow(item.row)).filter(Boolean))];
  const centroids = labels
    .map((label) => {
      const members = standardizedRows.filter(
        (item, index) => index !== rowIndex && labelForRow(item.row) === label,
      );
      return members.length > 0 ? { label, centroid: centroidForRows(members) } : null;
    })
    .filter(Boolean);

  return centroids
    .map((entry) => ({
      label: entry.label,
      distance: euclideanDistance(target.vector, entry.centroid),
    }))
    .sort((a, b) => a.distance - b.distance)[0]?.label ?? null;
}

function evaluateNearestCentroid(rows, featureNames, labelForRow) {
  const eligibleRows = rows.filter((row) => labelForRow(row));
  const standardizedRows = standardize(eligibleRows, featureNames);
  const predictions = standardizedRows.map((item, index) => ({
    id: item.row.id,
    actual: labelForRow(item.row),
    predicted: predictNearestCentroid(standardizedRows, index, labelForRow),
  }));
  return summarizePredictions(predictions);
}

function summarizePredictions(predictions) {
  const matrix = {};
  let correct = 0;
  const labels = new Set();

  for (const prediction of predictions) {
    const actual = prediction.actual ?? "unknown";
    const predicted = prediction.predicted ?? "unknown";
    labels.add(actual);
    labels.add(predicted);
    matrix[`${actual}:${predicted}`] = (matrix[`${actual}:${predicted}`] ?? 0) + 1;
    if (actual === predicted) correct += 1;
  }

  const perLabel = {};
  for (const label of labels) {
    const truePositive = matrix[`${label}:${label}`] ?? 0;
    let actualTotal = 0;
    let predictedTotal = 0;
    for (const key of Object.keys(matrix)) {
      const [actual, predicted] = key.split(":");
      if (actual === label) actualTotal += matrix[key] ?? 0;
      if (predicted === label) predictedTotal += matrix[key] ?? 0;
    }
    perLabel[label] = {
      recall: actualTotal === 0 ? null : Number((truePositive / actualTotal).toFixed(4)),
      precision: predictedTotal === 0 ? null : Number((truePositive / predictedTotal).toFixed(4)),
      support: actualTotal,
    };
  }

  const mismatches = predictions.filter((prediction) => prediction.actual !== prediction.predicted);
  return {
    total: predictions.length,
    correct,
    accuracy: predictions.length === 0 ? null : Number((correct / predictions.length).toFixed(4)),
    matrix,
    perLabel,
    mismatches,
  };
}

function timingRule(rows) {
  const correctRows = rows.filter((row) => row.label === "correct");
  const medianActivePerWord = median(
    correctRows.map((row) => row.features.activeSpeechPerExpectedWord),
  );
  const medianDurationPerWord = median(
    correctRows.map((row) => row.features.durationPerExpectedWord),
  );
  const predictions = rows
    .filter((row) => KNOWN_LABELS.has(row.label))
    .map((row) => {
      const activeRatio = row.features.activeSpeechPerExpectedWord / Math.max(0.001, medianActivePerWord);
      const durationRatio = row.features.durationPerExpectedWord / Math.max(0.001, medianDurationPerWord);
      let predicted = "correct";
      if (activeRatio < 0.72 || durationRatio < 0.72) {
        predicted = "skip";
      } else if (activeRatio > 1.24 || durationRatio > 1.24) {
        predicted = "repeat";
      }
      return {
        id: row.id,
        actual: row.label,
        predicted,
        activeRatio: Number(activeRatio.toFixed(3)),
        durationRatio: Number(durationRatio.toFixed(3)),
      };
    });

  return {
    medianActivePerWord,
    medianDurationPerWord,
    ...summarizePredictions(predictions),
  };
}

function summarizeByLabel(rows) {
  const byLabel = {};
  for (const row of rows) {
    const bucket = (byLabel[row.label] ??= {
      count: 0,
      durationSec: [],
      activeSpeechSec: [],
      activeSpeechPerExpectedWord: [],
      voicedRatio: [],
      segmentCount: [],
      longestPauseSec: [],
    });
    bucket.count += 1;
    for (const key of Object.keys(bucket)) {
      if (key === "count") continue;
      bucket[key].push(row.features[key]);
    }
  }

  return Object.fromEntries(
    Object.entries(byLabel).map(([label, bucket]) => [
      label,
      Object.fromEntries(
        Object.entries(bucket).map(([key, value]) => [
          key,
          key === "count"
            ? value
            : {
                mean: Number(mean(value).toFixed(4)),
                median: Number(median(value).toFixed(4)),
              },
        ]),
      ),
    ]),
  );
}

function buildSummary(rows, options) {
  const knownRows = rows.filter((row) => KNOWN_LABELS.has(row.label));
  const evaluatedRows = options.includeNoisy ? rows : knownRows;
  const timingFeatures = [
    "durationPerExpectedWord",
    "activeSpeechPerExpectedWord",
    "voicedRatio",
    "pausesPerExpectedWord",
    "longestPauseSec",
  ];
  const fullAudioFeatures = [
    ...timingFeatures,
    "segmentsPerExpectedWord",
    "meanPauseSec",
    "logGlobalRms",
    "logSpeechRms",
    "peak",
    "rmsDynamicRange",
    "meanZcr",
    "voicedZcr",
  ];

  return {
    generatedAt: new Date().toISOString(),
    featureVersion: FEATURE_VERSION,
    manifestFile: path.relative(ROOT_DIR, options.manifestFile),
    totalAudioRows: rows.length,
    evaluatedRows: evaluatedRows.length,
    includedNoisy: options.includeNoisy,
    k: options.k,
    byLabel: Object.fromEntries(
      [...new Set(rows.map((row) => row.label))].map((label) => [
        label,
        rows.filter((row) => row.label === label).length,
      ]),
    ),
    featureSummaryByLabel: summarizeByLabel(evaluatedRows),
    timingRule: timingRule(evaluatedRows),
    knnTimingMulticlass: evaluateKnn(
      evaluatedRows,
      timingFeatures,
      (row) => (KNOWN_LABELS.has(row.label) ? row.label : null),
      options.k,
    ),
    knnFullMulticlass: evaluateKnn(
      evaluatedRows,
      fullAudioFeatures,
      (row) => (KNOWN_LABELS.has(row.label) ? row.label : null),
      options.k,
    ),
    knnFullPassVsNotPass: evaluateKnn(
      evaluatedRows,
      fullAudioFeatures,
      (row) => {
        if (!KNOWN_LABELS.has(row.label)) return null;
        return row.label === "correct" ? "pass" : "not_pass";
      },
      options.k,
    ),
    centroidFullMulticlass: evaluateNearestCentroid(
      evaluatedRows,
      fullAudioFeatures,
      (row) => (KNOWN_LABELS.has(row.label) ? row.label : null),
    ),
    centroidFullPassVsNotPass: evaluateNearestCentroid(
      evaluatedRows,
      fullAudioFeatures,
      (row) => {
        if (!KNOWN_LABELS.has(row.label)) return null;
        return row.label === "correct" ? "pass" : "not_pass";
      },
    ),
    pairwiseCorrectVs: Object.fromEntries(
      ["skip", "repeat", "wrong"].map((negativeLabel) => {
        const pairRows = evaluatedRows.filter(
          (row) => row.label === "correct" || row.label === negativeLabel,
        );
        return [
          negativeLabel,
          evaluateKnn(
            pairRows,
            fullAudioFeatures,
            (row) => (row.label === "correct" ? "correct" : negativeLabel),
            options.k,
          ),
        ];
      }),
    ),
  };
}

function printSummary(summary) {
  console.log("Recite Lab audio experiment");
  console.log(`Audio rows: ${summary.totalAudioRows}`);
  console.log(`Evaluated rows: ${summary.evaluatedRows}`);
  console.log(`Labels: ${JSON.stringify(summary.byLabel)}`);
  console.log("");
  console.log(
    `Timing rule accuracy: ${summary.timingRule.correct}/${summary.timingRule.total} (${summary.timingRule.accuracy})`,
  );
  console.log(
    `kNN timing multiclass: ${summary.knnTimingMulticlass.correct}/${summary.knnTimingMulticlass.total} (${summary.knnTimingMulticlass.accuracy})`,
  );
  console.log(
    `kNN full multiclass: ${summary.knnFullMulticlass.correct}/${summary.knnFullMulticlass.total} (${summary.knnFullMulticlass.accuracy})`,
  );
  console.log(
    `kNN full pass/not-pass: ${summary.knnFullPassVsNotPass.correct}/${summary.knnFullPassVsNotPass.total} (${summary.knnFullPassVsNotPass.accuracy})`,
  );
  console.log(
    `centroid full pass/not-pass: ${summary.centroidFullPassVsNotPass.correct}/${summary.centroidFullPassVsNotPass.total} (${summary.centroidFullPassVsNotPass.accuracy})`,
  );
  console.log(
    `pairwise correct-vs-skip/repeat/wrong: ${summary.pairwiseCorrectVs.skip.accuracy}, ${summary.pairwiseCorrectVs.repeat.accuracy}, ${summary.pairwiseCorrectVs.wrong.accuracy}`,
  );

  const hardCases = summary.knnFullPassVsNotPass.mismatches.slice(0, 10);
  if (hardCases.length > 0) {
    console.log("");
    console.log("Pass/not-pass hard cases:");
    for (const item of hardCases) {
      console.log(`- ${item.id.slice(0, 8)} actual=${item.actual} predicted=${item.predicted}`);
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const manifestRows = await readJsonl(options.manifestFile);
  const featureRows = [];

  for (const row of manifestRows) {
    if (!row.audioFile) continue;
    featureRows.push(await loadFeatureRow(row));
  }

  const summary = buildSummary(featureRows, options);

  if (options.write) {
    await mkdir(ANALYSIS_DIR, { recursive: true });
    await writeFile(
      FEATURE_MANIFEST_FILE,
      `${featureRows.map((row) => JSON.stringify(row)).join("\n")}\n`,
      "utf8",
    );
    await writeFile(SUMMARY_FILE, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  }

  if (options.json) {
    console.log(JSON.stringify({ summary, featureRows }, null, 2));
    return;
  }

  printSummary(summary);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
