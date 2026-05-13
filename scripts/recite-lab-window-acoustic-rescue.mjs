import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");
const LAB_DIR = path.join(ROOT_DIR, "artifacts", "recite-lab");
const ANALYSIS_DIR = path.join(LAB_DIR, "analysis");
const DEFAULT_MANIFEST_FILE = path.join(ANALYSIS_DIR, "audio-manifest.jsonl");
const EXPERIMENT_VERSION = "recite-lab-window-acoustic-rescue-v0.1";
const KNOWN_LABELS = new Set(["correct", "skip", "repeat", "wrong"]);

function safeFilePart(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]+/g, "_");
}

function getOutputFiles(scopeLabel) {
  const scopePart = safeFilePart(scopeLabel);
  return {
    resultsFile: path.join(ANALYSIS_DIR, `window-acoustic-rescue-${scopePart}-results.jsonl`),
    summaryFile: path.join(ANALYSIS_DIR, `window-acoustic-rescue-${scopePart}-summary.json`),
  };
}

function parseArgs(argv) {
  const options = {
    write: false,
    json: false,
    manifestFile: DEFAULT_MANIFEST_FILE,
    scopeLabel: "1:1-7",
    windowSize: 10,
    maxFrames: 90,
    referenceCount: 3,
    maxFalseRescues: 0,
    threshold: null,
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
    } else if (arg === "--window-size") {
      const value = Number.parseInt(argv[index + 1] ?? "", 10);
      if (!Number.isFinite(value) || value < 3) {
        throw new Error("--window-size must be followed by a number >= 3.");
      }
      options.windowSize = value;
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
    } else if (arg === "--max-false-rescues") {
      const value = Number.parseInt(argv[index + 1] ?? "", 10);
      if (!Number.isFinite(value) || value < 0) {
        throw new Error("--max-false-rescues must be followed by a number >= 0.");
      }
      options.maxFalseRescues = value;
      index += 1;
    } else if (arg === "--threshold") {
      const value = Number.parseFloat(argv[index + 1] ?? "");
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error("--threshold must be followed by a positive number.");
      }
      options.threshold = value;
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
    if (format.bitsPerSample === 8) return (buffer.readUInt8(sampleOffset) - 128) / 128;
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
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) /
    Math.max(1, values.length - 1);
  const scale = Math.sqrt(variance) || 1;
  return values.map((value) => (value - average) / scale);
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
  const selected = speechFrames.length > 8 ? speechFrames : frames;
  return compressSequence(
    selected.map((frame) => frame.vector),
    maxFrames,
  );
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
    8,
    Math.abs(a.length - b.length),
    Math.ceil(Math.max(a.length, b.length) * 0.28),
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

function expectedPassForLabel(label) {
  if (label === "correct") return "pass";
  if (label === "skip" || label === "repeat" || label === "wrong") return "not_pass";
  return null;
}

function buildWindows(expectedWordCount, windowSize) {
  const windows = [];
  for (let start = 1; start <= expectedWordCount; start += windowSize) {
    windows.push({
      index: windows.length + 1,
      startExpectedIndex: start,
      endExpectedIndex: Math.min(expectedWordCount, start + windowSize - 1),
    });
  }
  return windows;
}

function sliceWav(wav, startSec, endSec) {
  const durationSec = wav.samples.length / wav.sampleRate;
  const start = Math.max(0, Math.floor(Math.min(startSec, durationSec) * wav.sampleRate));
  const end = Math.min(
    wav.samples.length,
    Math.ceil(Math.max(startSec + 0.12, Math.min(endSec, durationSec)) * wav.sampleRate),
  );
  return {
    ...wav,
    samples: wav.samples.slice(start, Math.max(start + 1, end)),
  };
}

function getWindowBounds(row, wav, window) {
  const expectedCount = Math.max(1, row.expectedWordCount ?? 1);
  const durationSec = wav.samples.length / wav.sampleRate;
  const padSec = Math.min(0.35, Math.max(0.12, durationSec / expectedCount));
  const startRatio = (window.startExpectedIndex - 1) / expectedCount;
  const endRatio = window.endExpectedIndex / expectedCount;
  return {
    startSec: Math.max(0, durationSec * startRatio - padSec),
    endSec: Math.min(durationSec, durationSec * endRatio + padSec),
  };
}

async function loadWindowSequences(row, options) {
  const buffer = await readFile(path.resolve(ROOT_DIR, row.audioFile));
  const wav = parseWav(buffer, row.audioFile);
  const windows = buildWindows(row.expectedWordCount ?? 0, options.windowSize);
  return {
    ...row,
    audioDurationSec: wav.samples.length / wav.sampleRate,
    windows: windows.map((window) => {
      const bounds = getWindowBounds(row, wav, window);
      const segment = sliceWav(wav, bounds.startSec, bounds.endSec);
      return {
        ...window,
        startSec: bounds.startSec,
        endSec: bounds.endSec,
        durationSec: segment.samples.length / segment.sampleRate,
        sequence: extractSpeechFrames(segment, options.maxFrames),
      };
    }),
  };
}

function chooseReferenceRows(rows) {
  const clean = rows.filter(
    (row) =>
      row.label === "correct" &&
      row.currentDecision === "pass" &&
      row.windowStatus === "complete" &&
      row.labelDecisionMismatch !== true,
  );
  if (clean.length >= 2) return { rows: clean, mode: "clean_pass" };

  const correctCompleted = rows.filter(
    (row) =>
      row.label === "correct" &&
      (row.windowAcceptedCount ?? 0) >= Math.max(1, (row.expectedWordCount ?? 0) - 1),
  );
  if (correctCompleted.length >= 2) return { rows: correctCompleted, mode: "correct_completed" };

  return { rows: rows.filter((row) => row.label === "correct"), mode: "correct_any" };
}

function nearestReferenceDistances(row, window, references, options) {
  return references
    .filter((reference) => reference.id !== row.id)
    .map((reference) => {
      const referenceWindow = reference.windows.find((item) => item.index === window.index);
      if (!referenceWindow) return null;
      const acousticDistance = dtwDistance(window.sequence, referenceWindow.sequence);
      const durationPenalty = Math.abs(
        Math.log(
          Math.max(0.001, window.durationSec) / Math.max(0.001, referenceWindow.durationSec),
        ),
      );
      return {
        id: reference.id,
        acousticDistance,
        durationPenalty,
        distance: acousticDistance + durationPenalty * 0.04,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, options.referenceCount);
}

function scoreWindows(row, references, options) {
  const windows = row.windows.map((window) => {
    const nearestReferences = nearestReferenceDistances(row, window, references, options);
    const distance =
      nearestReferences.reduce((sum, item) => sum + item.distance, 0) /
      Math.max(1, nearestReferences.length);
    const acousticDistance =
      nearestReferences.reduce((sum, item) => sum + item.acousticDistance, 0) /
      Math.max(1, nearestReferences.length);
    return {
      index: window.index,
      startExpectedIndex: window.startExpectedIndex,
      endExpectedIndex: window.endExpectedIndex,
      durationSec: window.durationSec,
      distance,
      acousticDistance,
      nearestReferences,
    };
  });
  const distances = windows.map((window) => window.distance).filter(Number.isFinite);
  const sorted = [...distances].sort((a, b) => a - b);
  const meanDistance =
    distances.reduce((sum, value) => sum + value, 0) / Math.max(1, distances.length);
  const maxDistance = distances.length ? Math.max(...distances) : Number.POSITIVE_INFINITY;
  const p90Distance = percentile(sorted, 0.9);
  return { windows, meanDistance, maxDistance, p90Distance };
}

function getFallbackWindowIndex(row) {
  const windowCount = row.windowCount ?? row.windows?.length ?? 0;
  if (windowCount <= 0) return null;
  const acceptedCount = row.windowAcceptedCount ?? row.expectedWordCount ?? 0;
  return Math.max(
    1,
    Math.min(windowCount, Math.ceil(Math.max(1, acceptedCount) / optionsWindowSize(row))),
  );
}

function optionsWindowSize(row) {
  const expectedCount = row.expectedWordCount ?? 0;
  const windowCount = row.windowCount ?? row.windows?.length ?? 0;
  return windowCount > 0 ? Math.ceil(expectedCount / windowCount) : 10;
}

function getTargetWindowIndexes(row) {
  const details = Array.isArray(row.windowDetails) ? row.windowDetails : [];
  const flagged = details
    .filter((window) => window.decision === "uncertain" || window.decision === "blocked")
    .map((window) => window.index)
    .filter(Number.isFinite);

  if (flagged.length > 0) return [...new Set(flagged)].sort((a, b) => a - b);

  const missingLike =
    (row.windowStatus === "incomplete" || row.windowStatus === "needs_audio") &&
    (row.expectedWordCount ?? 0) > 0;
  if (!missingLike) return [];

  const fallbackIndex =
    row.windowDetails?.find?.((window) => window.index === row.windowDetails.length)?.index ??
    getFallbackWindowIndex(row);
  return fallbackIndex ? [fallbackIndex] : [];
}

function scoreRescueTargetWindows(row, scoredWindows, targetWindowIndexes) {
  const selected = scoredWindows.filter((window) => targetWindowIndexes.includes(window.index));
  if (selected.length === 0) {
    return {
      targetWindowIndexes: [],
      targetWindowCount: 0,
      targetMeanDistance: Number.POSITIVE_INFINITY,
      targetMaxDistance: Number.POSITIVE_INFINITY,
      targetP90Distance: Number.POSITIVE_INFINITY,
    };
  }
  const distances = selected.map((window) => window.distance).filter(Number.isFinite);
  const sorted = [...distances].sort((a, b) => a - b);
  return {
    targetWindowIndexes,
    targetWindowCount: selected.length,
    targetMeanDistance:
      distances.reduce((sum, value) => sum + value, 0) / Math.max(1, distances.length),
    targetMaxDistance: distances.length ? Math.max(...distances) : Number.POSITIVE_INFINITY,
    targetP90Distance: percentile(sorted, 0.9),
  };
}

function isRescueCandidate(row) {
  if (!KNOWN_LABELS.has(row.label)) return { eligible: false, reason: "unknown_label" };
  if (row.currentDecision === "pass") return { eligible: false, reason: "already_passed" };

  const expectedCount = row.expectedWordCount ?? 0;
  const acceptedCount = row.windowAcceptedCount ?? 0;
  const nearEndSlack = Math.max(1, Math.ceil(expectedCount * 0.04));
  const nearEnd = expectedCount > 0 && acceptedCount >= expectedCount - nearEndSlack;
  if (!nearEnd) return { eligible: false, reason: "not_near_end" };

  if (row.windowStatus === "needs_audio") {
    return { eligible: true, reason: "window_needs_audio" };
  }
  if (row.windowStatus === "incomplete" && expectedCount - acceptedCount <= nearEndSlack) {
    return { eligible: true, reason: "near_complete_incomplete" };
  }
  return { eligible: false, reason: `window_${row.windowStatus ?? "unknown"}` };
}

function summarizePredictions(predictions) {
  const matrix = {};
  let correct = 0;
  for (const prediction of predictions) {
    const actual = prediction.actual ?? "unknown";
    const predicted = prediction.predicted ?? "unknown";
    matrix[`${actual}:${predicted}`] = (matrix[`${actual}:${predicted}`] ?? 0) + 1;
    if (actual === predicted) correct += 1;
  }
  return {
    total: predictions.length,
    correct,
    accuracy: predictions.length === 0 ? null : Number((correct / predictions.length).toFixed(4)),
    matrix,
    mismatches: predictions.filter((prediction) => prediction.actual !== prediction.predicted),
  };
}

function calibrateThreshold(scoredRows, options) {
  const candidates = scoredRows.filter(
    (row) => row.isRescueCandidate && Number.isFinite(row.rescueScore),
  );
  const positives = candidates.filter((row) => row.expectedPassDecision === "pass");
  const negatives = candidates.filter((row) => row.expectedPassDecision === "not_pass");
  if (positives.length === 0) {
    return {
      threshold: null,
      reason: "no_correct_rescue_candidates",
      positiveCandidates: 0,
      negativeCandidates: negatives.length,
    };
  }
  if (negatives.length === 0) {
    const positiveScores = positives.map((row) => row.rescueScore).sort((a, b) => a - b);
    return {
      threshold: null,
      suggestedPositiveOnlyThreshold: percentile(positiveScores, 0.9),
      reason: "no_negative_rescue_candidates",
      positiveCandidates: positives.length,
      negativeCandidates: 0,
    };
  }

  const thresholds = [...new Set(candidates.map((row) => row.rescueScore))]
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  let best = null;
  for (const threshold of thresholds) {
    const rescued = candidates.filter((row) => row.rescueScore <= threshold);
    const trueRescues = rescued.filter((row) => row.expectedPassDecision === "pass").length;
    const falseRescues = rescued.filter((row) => row.expectedPassDecision === "not_pass").length;
    if (falseRescues > options.maxFalseRescues) continue;
    const candidate = {
      threshold,
      trueRescues,
      falseRescues,
      missedCorrect: positives.length - trueRescues,
      positiveCandidates: positives.length,
      negativeCandidates: negatives.length,
    };
    if (
      !best ||
      candidate.trueRescues > best.trueRescues ||
      (candidate.trueRescues === best.trueRescues && candidate.threshold < best.threshold)
    ) {
      best = candidate;
    }
  }

  return best ?? {
    threshold: null,
    reason: "no_threshold_satisfies_false_rescue_limit",
    positiveCandidates: positives.length,
    negativeCandidates: negatives.length,
  };
}

function countBy(rows, keyForRow) {
  const counts = {};
  for (const row of rows) {
    const key = keyForRow(row) ?? "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function buildSummary(scoredRows, references, referenceMode, calibration, options) {
  const threshold = options.threshold ?? calibration.threshold ?? null;
  const rowsWithHybrid = scoredRows.map((row) => {
    const acousticRescued =
      row.isRescueCandidate &&
      threshold !== null &&
      Number.isFinite(row.rescueScore) &&
      row.rescueScore <= threshold;
    return {
      ...row,
      acousticRescueDecision: acousticRescued ? "rescue_pass" : "hold",
      hybridPassDecision: row.currentDecision === "pass" || acousticRescued ? "pass" : "not_pass",
    };
  });
  const primaryPredictions = rowsWithHybrid.map((row) => ({
    id: row.id,
    actual: row.expectedPassDecision,
    predicted: row.currentDecision === "pass" ? "pass" : "not_pass",
    label: row.label,
  }));
  const hybridPredictions = rowsWithHybrid.map((row) => ({
    id: row.id,
    actual: row.expectedPassDecision,
    predicted: row.hybridPassDecision,
    label: row.label,
  }));
  const rescueCandidates = rowsWithHybrid.filter((row) => row.isRescueCandidate);
  const acousticRescues = rowsWithHybrid.filter(
    (row) => row.acousticRescueDecision === "rescue_pass",
  );

  return {
    generatedAt: new Date().toISOString(),
    experimentVersion: EXPERIMENT_VERSION,
    manifestFile: path.relative(ROOT_DIR, options.manifestFile),
    scopeLabel: options.scopeLabel,
    windowSize: options.windowSize,
    maxFrames: options.maxFrames,
    referenceCount: options.referenceCount,
    referenceMode,
    referenceRows: references.map((row) => row.id),
    threshold,
    thresholdSource: options.threshold !== null ? "manual" : calibration.threshold ? "calibrated" : "none",
    calibration,
    rowCount: scoredRows.length,
    byLabel: countBy(scoredRows, (row) => row.label),
    byCurrentDecision: countBy(scoredRows, (row) => row.currentDecision),
    byWindowStatus: countBy(scoredRows, (row) => row.windowStatus),
    candidateCount: rescueCandidates.length,
    candidatesByLabel: countBy(rescueCandidates, (row) => row.label),
    candidateReasons: countBy(scoredRows, (row) => row.rescueCandidateReason),
    acousticRescueCount: acousticRescues.length,
    acousticRescuesByLabel: countBy(acousticRescues, (row) => row.label),
    falseRescues: acousticRescues.filter((row) => row.expectedPassDecision !== "pass"),
    primaryPassVsNotPass: summarizePredictions(primaryPredictions),
    hybridPassVsNotPass: summarizePredictions(hybridPredictions),
  };
}

function printSummary(summary, rows) {
  console.log("Recite Lab window acoustic rescue");
  console.log(`Scope: ${summary.scopeLabel}`);
  console.log(`Rows: ${summary.rowCount}`);
  console.log(`References: ${summary.referenceRows.length} (${summary.referenceMode})`);
  console.log(`Candidates: ${summary.candidateCount} ${JSON.stringify(summary.candidatesByLabel)}`);
  console.log(
    `Threshold: ${
      summary.threshold === null ? "none" : summary.threshold.toFixed(4)
    } (${summary.thresholdSource})`,
  );
  if (summary.calibration.reason) console.log(`Calibration note: ${summary.calibration.reason}`);
  if (summary.calibration.suggestedPositiveOnlyThreshold) {
    console.log(
      `Positive-only suggestion: ${summary.calibration.suggestedPositiveOnlyThreshold.toFixed(4)}`,
    );
  }
  console.log(
    `Primary pass/not-pass: ${summary.primaryPassVsNotPass.correct}/${summary.primaryPassVsNotPass.total} (${summary.primaryPassVsNotPass.accuracy})`,
  );
  console.log(
    `Hybrid pass/not-pass: ${summary.hybridPassVsNotPass.correct}/${summary.hybridPassVsNotPass.total} (${summary.hybridPassVsNotPass.accuracy})`,
  );
  console.log(`Acoustic rescues: ${summary.acousticRescueCount}`);
  console.log(`False rescues: ${summary.falseRescues.length}`);

  const candidates = rows.filter((row) => row.isRescueCandidate);
  if (candidates.length > 0) {
    console.log("");
    console.log("Rescue candidates:");
    for (const row of candidates.slice(-12)) {
      const score = Number.isFinite(row.rescueScore) ? row.rescueScore.toFixed(4) : "n/a";
      console.log(
        `- ${row.id.slice(0, 8)} label=${row.label} current=${row.currentDecision} window=${
          row.windowStatus
        } accepted=${row.windowAcceptedCount}/${row.expectedWordCount} targets=${
          row.targetWindowIndexes.join(",") || "none"
        } score=${score} mean=${row.meanDistance.toFixed(
          4,
        )} max=${row.maxDistance.toFixed(4)} rescue=${row.acousticRescueDecision}`,
      );
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const manifestRows = (await readJsonl(options.manifestFile))
    .filter((row) => row.audioFile && KNOWN_LABELS.has(row.label))
    .filter((row) => (row.expectedScope?.label ?? null) === options.scopeLabel);
  const loadedRows = [];
  for (const row of manifestRows) {
    loadedRows.push(await loadWindowSequences(row, options));
  }

  const { rows: referenceRows, mode: referenceMode } = chooseReferenceRows(loadedRows);
  if (referenceRows.length < 2) {
    throw new Error(`Need at least two reference recordings for ${options.scopeLabel}.`);
  }

  const scoredRows = loadedRows.map((row) => {
    const scores = scoreWindows(row, referenceRows, options);
    const targetWindowIndexes = getTargetWindowIndexes(row);
    const targetScores = scoreRescueTargetWindows(row, scores.windows, targetWindowIndexes);
    const eligibility = isRescueCandidate(row);
    return {
      id: row.id,
      label: row.label,
      expectedPassDecision: expectedPassForLabel(row.label),
      currentDecision: row.currentDecision,
      windowStatus: row.windowStatus,
      windowAcceptedCount: row.windowAcceptedCount,
      expectedWordCount: row.expectedWordCount,
      heardTokenCount: row.heardTokenCount,
      score: row.score,
      audioFile: row.audioFile,
      audioDurationSec: row.audioDurationSec,
      windowDetails: row.windowDetails,
      isRescueCandidate: eligibility.eligible,
      rescueCandidateReason: eligibility.reason,
      targetWindowIndexes: targetScores.targetWindowIndexes,
      targetWindowCount: targetScores.targetWindowCount,
      targetMeanDistance: targetScores.targetMeanDistance,
      targetMaxDistance: targetScores.targetMaxDistance,
      targetP90Distance: targetScores.targetP90Distance,
      rescueScore: targetScores.targetP90Distance,
      meanDistance: scores.meanDistance,
      maxDistance: scores.maxDistance,
      p90Distance: scores.p90Distance,
      windows: scores.windows,
    };
  });
  const calibration = calibrateThreshold(scoredRows, options);
  const summary = buildSummary(scoredRows, referenceRows, referenceMode, calibration, options);
  const threshold = summary.threshold;
  const rowsWithHybrid = scoredRows.map((row) => {
    const acousticRescued =
      row.isRescueCandidate &&
      threshold !== null &&
      Number.isFinite(row.rescueScore) &&
      row.rescueScore <= threshold;
    return {
      ...row,
      acousticRescueDecision: acousticRescued ? "rescue_pass" : "hold",
      hybridPassDecision: row.currentDecision === "pass" || acousticRescued ? "pass" : "not_pass",
    };
  });

  if (options.write) {
    const { resultsFile, summaryFile } = getOutputFiles(options.scopeLabel);
    await mkdir(ANALYSIS_DIR, { recursive: true });
    await writeFile(
      resultsFile,
      `${rowsWithHybrid.map((row) => JSON.stringify(row)).join("\n")}\n`,
      "utf8",
    );
    await writeFile(summaryFile, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  }

  if (options.json) {
    console.log(JSON.stringify({ summary, rows: rowsWithHybrid }, null, 2));
    return;
  }

  printSummary(summary, rowsWithHybrid);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
