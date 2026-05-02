#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const layoutPath = resolve(repoRoot, "artifacts/noor-mobile/assets/qul-kfgqpc-v4-layout.json");
const wordsPath = resolve(repoRoot, "artifacts/noor-mobile/assets/qul-words.json");
const apiMetaPath = resolve(repoRoot, "artifacts/api-server/src/data/quran-meta.ts");
const mobileMushafPath = resolve(repoRoot, "artifacts/noor-mobile/src/lib/mushaf.ts");

const TOTAL_PAGES = 604;
const TOTAL_SURAHS = 114;

const SURAH_VERSE_COUNTS = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109,
  123, 111, 43, 52, 99, 128, 111, 110, 98, 135,
  112, 78, 118, 64, 77, 227, 93, 88, 69, 60,
  34, 30, 73, 54, 45, 83, 182, 88, 75, 85,
  54, 53, 89, 59, 37, 35, 38, 29, 18, 45,
  60, 49, 62, 55, 78, 96, 29, 22, 24, 13,
  14, 11, 11, 18, 12, 12, 30, 52, 52, 44,
  28, 28, 20, 56, 40, 31, 50, 40, 46, 42,
  29, 19, 36, 25, 22, 17, 19, 26, 30, 20,
  15, 21, 11, 8, 8, 19, 5, 8, 8, 11,
  11, 8, 3, 9, 5, 4, 7, 3, 6, 3,
  5, 4, 5, 6, 5, 8, 3, 3, 6, 3,
];

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf-8"));
}

function asFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseWordKey(wordKey) {
  const [surah, ayah, position] = wordKey.split(":").map(Number);
  if (![surah, ayah, position].every(Number.isFinite)) return null;
  return { surah, ayah, position };
}

function compareVerseRefs(left, right) {
  if (left.surah !== right.surah) return left.surah - right.surah;
  return left.ayah - right.ayah;
}

function verseOrdinal(ref) {
  let total = ref.ayah;
  for (let surah = 1; surah < ref.surah; surah += 1) {
    total += SURAH_VERSE_COUNTS[surah - 1] ?? 0;
  }
  return total;
}

function formatRef(ref) {
  return `${ref.surah}:${ref.ayah}`;
}

function buildWordKeyByIndex(words) {
  const wordKeyByIndex = new Map();
  for (const word of words.words ?? []) {
    if (Number.isFinite(word.word_index) && typeof word.word_key === "string") {
      wordKeyByIndex.set(word.word_index, word.word_key);
    }
  }
  return wordKeyByIndex;
}

function buildLinesByPage(layout) {
  const linesByPage = new Map();
  for (const line of layout.pages ?? []) {
    const pageNumber = asFiniteNumber(line.page_number);
    if (pageNumber === null) continue;
    const lines = linesByPage.get(pageNumber) ?? [];
    lines.push(line);
    linesByPage.set(pageNumber, lines);
  }

  for (const lines of linesByPage.values()) {
    lines.sort((a, b) => (asFiniteNumber(a.line_number) ?? 0) - (asFiniteNumber(b.line_number) ?? 0));
  }

  return linesByPage;
}

function getWordKeysOnLine(line, wordKeyByIndex) {
  const firstWordId = asFiniteNumber(line.first_word_id);
  const lastWordId = asFiniteNumber(line.last_word_id);
  if (firstWordId === null) return [];

  const start = firstWordId;
  const end = lastWordId ?? firstWordId;
  const lower = Math.min(start, end);
  const upper = Math.max(start, end);
  const keys = [];

  for (let wordIndex = lower; wordIndex <= upper; wordIndex += 1) {
    const wordKey = wordKeyByIndex.get(wordIndex);
    if (wordKey) keys.push(wordKey);
  }

  return keys;
}

function deriveTables(layout, words) {
  const wordKeyByIndex = buildWordKeyByIndex(words);
  const linesByPage = buildLinesByPage(layout);
  const pageToFirstVerse = new Array(TOTAL_PAGES).fill(null);
  const surahStartPages = new Array(TOTAL_SURAHS).fill(null);
  const ayahsPerSurah = new Map();

  for (let page = 1; page <= TOTAL_PAGES; page += 1) {
    const lines = linesByPage.get(page) ?? [];
    for (const line of lines) {
      if (line.line_type !== "ayah") continue;

      const firstWordId = asFiniteNumber(line.first_word_id);
      if (firstWordId !== null && pageToFirstVerse[page - 1] === null) {
        const firstWordKey = wordKeyByIndex.get(firstWordId);
        const firstWord = firstWordKey ? parseWordKey(firstWordKey) : null;
        if (firstWord) {
          pageToFirstVerse[page - 1] = { surah: firstWord.surah, ayah: firstWord.ayah };
        }
      }

      for (const wordKey of getWordKeysOnLine(line, wordKeyByIndex)) {
        const parsed = parseWordKey(wordKey);
        if (!parsed) continue;
        if (parsed.surah < 1 || parsed.surah > TOTAL_SURAHS) continue;

        if (surahStartPages[parsed.surah - 1] === null) {
          surahStartPages[parsed.surah - 1] = page;
        }

        const ayahs = ayahsPerSurah.get(parsed.surah) ?? new Set();
        ayahs.add(parsed.ayah);
        ayahsPerSurah.set(parsed.surah, ayahs);
      }
    }
  }

  validateDerivedTables(pageToFirstVerse, surahStartPages, ayahsPerSurah);

  return {
    pageToFirstVerse,
    surahStartPages,
    ayahsPerSurah,
  };
}

function validateDerivedTables(pageToFirstVerse, surahStartPages, ayahsPerSurah) {
  let validationFailed = false;

  for (let page = 1; page <= TOTAL_PAGES; page += 1) {
    if (pageToFirstVerse[page - 1] === null) {
      console.error(`[ERROR] Page ${page} has no ayah lines in QUL layout. Cannot generate.`);
      validationFailed = true;
    }
  }

  for (let surah = 1; surah <= TOTAL_SURAHS; surah += 1) {
    if (surahStartPages[surah - 1] === null) {
      console.error(`[ERROR] Surah ${surah} has no ayah lines in QUL layout. Cannot generate.`);
      validationFailed = true;
    }

    const expected = SURAH_VERSE_COUNTS[surah - 1];
    const actual = ayahsPerSurah.get(surah)?.size ?? 0;
    if (actual !== expected) {
      console.error(`[ERROR] Surah ${surah}: QUL has ${actual} ayahs, expected ${expected}.`);
      validationFailed = true;
    }
  }

  if (validationFailed) {
    console.error("[ERROR] QUL data does not match canonical verse counts. Aborting.");
    process.exit(1);
  }
}

function extractArrayBody(source, exportName) {
  const escapedName = exportName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(
    new RegExp(`export\\s+const\\s+${escapedName}\\b[^=]*=\\s*\\[([\\s\\S]*?)\\]\\s*(?:as\\s+const)?\\s*;`),
  );
  return match?.[1] ?? null;
}

function parseVerseRefArray(source, exportName) {
  const body = extractArrayBody(source, exportName);
  if (!body) return null;

  return [...body.matchAll(/\{\s*surah\s*:\s*(\d+)\s*,\s*ayah\s*:\s*(\d+)\s*\}/g)].map((match) => ({
    surah: Number(match[1]),
    ayah: Number(match[2]),
  }));
}

function parseNumberArray(source, exportName) {
  const body = extractArrayBody(source, exportName);
  if (!body) return null;
  if (/[^,\s\d]/.test(body)) return null;

  return [...body.matchAll(/\b\d+\b/g)].map((match) => Number(match[0]));
}

function printVerseTableDiff(label, existing, generated) {
  if (!existing) {
    console.log(`[diff] ${label}: existing hand-typed table not found; skipped old-table diff.`);
    return;
  }

  const compareLength = Math.min(existing.length, generated.length);
  const diffs = [];
  for (let index = 0; index < compareLength; index += 1) {
    const oldRef = existing[index];
    const newRef = generated[index];
    if (compareVerseRefs(oldRef, newRef) !== 0) {
      diffs.push({
        page: index + 1,
        oldRef,
        newRef,
        delta: verseOrdinal(newRef) - verseOrdinal(oldRef),
      });
    }
  }

  const lengthDelta = Math.abs(existing.length - generated.length);
  console.log(
    `[diff] ${label}: ${diffs.length} of ${generated.length} entries differ` +
      (lengthDelta > 0 ? ` (${lengthDelta} length mismatch)` : "") +
      ".",
  );

  if (diffs.length === 0) return;

  const affectedSurahs = [...new Set(diffs.flatMap((diff) => [diff.oldRef.surah, diff.newRef.surah]))]
    .sort((a, b) => a - b)
    .join(", ");
  console.log(`  Affected surahs: ${affectedSurahs}`);

  if (diffs.length > 50) {
    console.warn(`  [warn] ${diffs.length} page rows changed; pause for human review before wiring.`);
  }

  console.log("  Largest verse-index shifts:");
  for (const diff of [...diffs].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 12)) {
    console.log(
      `    page ${diff.page}: old ${formatRef(diff.oldRef)} -> QUL ${formatRef(diff.newRef)} ` +
        `(delta ${diff.delta >= 0 ? "+" : ""}${diff.delta} ayahs)`,
    );
  }
}

function printNumberTableDiff(label, existing, generated, itemName) {
  if (!existing) {
    console.log(`[diff] ${label}: existing hand-typed table not found; skipped old-table diff.`);
    return;
  }

  const compareLength = Math.min(existing.length, generated.length);
  const diffs = [];
  for (let index = 0; index < compareLength; index += 1) {
    if (existing[index] !== generated[index]) {
      diffs.push({
        item: index + 1,
        oldValue: existing[index],
        newValue: generated[index],
      });
    }
  }

  const lengthDelta = Math.abs(existing.length - generated.length);
  console.log(
    `[diff] ${label}: ${diffs.length} of ${generated.length} entries differ` +
      (lengthDelta > 0 ? ` (${lengthDelta} length mismatch)` : "") +
      ".",
  );

  if (diffs.length === 0) return;

  const affected = diffs.map((diff) => diff.item).join(", ");
  console.log(`  Affected ${itemName}s: ${affected}`);
  console.log("  Changed entries:");
  for (const diff of diffs.slice(0, 25)) {
    console.log(`    ${itemName} ${diff.item}: old page ${diff.oldValue} -> QUL page ${diff.newValue}`);
  }
  if (diffs.length > 25) {
    console.log(`    ... ${diffs.length - 25} more`);
  }
}

function printDiffSummary(pageToFirstVerse, surahStartPages) {
  const apiSource = readFileSync(apiMetaPath, "utf-8");
  const mobileSource = readFileSync(mobileMushafPath, "utf-8");

  printVerseTableDiff(
    "API PAGE_TO_FIRST_VERSE",
    parseVerseRefArray(apiSource, "PAGE_TO_FIRST_VERSE"),
    pageToFirstVerse,
  );
  printNumberTableDiff(
    "API SURAH_START_PAGES",
    parseNumberArray(apiSource, "SURAH_START_PAGES"),
    surahStartPages,
    "surah",
  );
  printNumberTableDiff(
    "mobile SURAH_START_PAGES",
    parseNumberArray(mobileSource, "SURAH_START_PAGES"),
    surahStartPages,
    "surah",
  );
}

function formatGeneratedFile(pageToFirstVerse, surahStartPages) {
  const pageLines = pageToFirstVerse
    .map((verse) => `  { surah: ${verse.surah}, ayah: ${verse.ayah} },`)
    .join("\n");
  const surahLines = surahStartPages.map((page) => `  ${page},`).join("\n");

  return `// AUTOGENERATED by scripts/generate-mushaf-tables.mjs from QUL KFGQPC v4 layout.
// DO NOT EDIT BY HAND. Run \`node scripts/generate-mushaf-tables.mjs\` to regenerate.
// Source: artifacts/noor-mobile/assets/qul-kfgqpc-v4-layout.json

export const PAGE_TO_FIRST_VERSE_GENERATED: ReadonlyArray<{ surah: number; ayah: number }> = [
${pageLines}
];

export const SURAH_START_PAGES_GENERATED: ReadonlyArray<number> = [
${surahLines}
];
`;
}

const layout = readJson(layoutPath);
const words = readJson(wordsPath);
const { pageToFirstVerse, surahStartPages, ayahsPerSurah } = deriveTables(layout, words);

printDiffSummary(pageToFirstVerse, surahStartPages);

const generated = formatGeneratedFile(pageToFirstVerse, surahStartPages);
const apiOut = resolve(repoRoot, "artifacts/api-server/src/data/generated-mushaf-tables.ts");
const mobileOut = resolve(repoRoot, "artifacts/noor-mobile/src/lib/generated-mushaf-tables.ts");

writeFileSync(apiOut, generated);
writeFileSync(mobileOut, generated);

console.log(`[ok] Wrote ${apiOut}`);
console.log(`[ok] Wrote ${mobileOut}`);
console.log(`[ok] ${TOTAL_PAGES} pages, ${TOTAL_SURAHS} surahs, ${ayahsPerSurah.size} surahs validated.`);
