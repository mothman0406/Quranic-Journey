#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const requireFromDb = createRequire(resolve(repoRoot, "lib/db/package.json"));
const pg = requireFromDb("pg");

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

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set. Source the prod env and re-run.");
  process.exit(1);
}

function parseGeneratedPageTable() {
  const generatedPath = resolve(repoRoot, "artifacts/api-server/src/data/generated-mushaf-tables.ts");
  const source = readFileSync(generatedPath, "utf-8");
  const match = source.match(
    /export\s+const\s+PAGE_TO_FIRST_VERSE_GENERATED[\s\S]*?=\s*\[([\s\S]*?)\]\s*;/,
  );
  if (!match) {
    console.error(`[ERROR] Could not find PAGE_TO_FIRST_VERSE_GENERATED in ${generatedPath}`);
    process.exit(1);
  }

  const pageToFirstVerse = [...match[1].matchAll(/\{\s*surah\s*:\s*(\d+)\s*,\s*ayah\s*:\s*(\d+)\s*\}/g)]
    .map((row) => ({ surah: Number(row[1]), ayah: Number(row[2]) }));

  if (pageToFirstVerse.length !== TOTAL_PAGES) {
    console.error(`[ERROR] Expected ${TOTAL_PAGES} generated page rows, found ${pageToFirstVerse.length}.`);
    process.exit(1);
  }

  return pageToFirstVerse;
}

function compareVerseRefs(left, right) {
  if (left.surah !== right.surah) return left.surah - right.surah;
  return left.ayah - right.ayah;
}

function previousVerse(ref) {
  if (ref.ayah > 1) return { surah: ref.surah, ayah: ref.ayah - 1 };
  if (ref.surah <= 1) return null;
  return { surah: ref.surah - 1, ayah: SURAH_VERSE_COUNTS[ref.surah - 2] };
}

function nextVerse(ref) {
  const lastAyah = SURAH_VERSE_COUNTS[ref.surah - 1];
  if (!lastAyah) return null;
  if (ref.ayah < lastAyah) return { surah: ref.surah, ayah: ref.ayah + 1 };
  if (ref.surah < TOTAL_SURAHS) return { surah: ref.surah + 1, ayah: 1 };
  return null;
}

function verseKey(ref) {
  return `${ref.surah}:${ref.ayah}`;
}

function buildExpectedPageByVerse(pageToFirstVerse) {
  const expectedPageByVerse = new Map();

  for (let page = 1; page <= TOTAL_PAGES; page += 1) {
    const start = pageToFirstVerse[page - 1];
    const end = page < TOTAL_PAGES
      ? previousVerse(pageToFirstVerse[page])
      : { surah: TOTAL_SURAHS, ayah: SURAH_VERSE_COUNTS[TOTAL_SURAHS - 1] };

    if (!end || compareVerseRefs(end, start) < 0) {
      console.error(`[ERROR] Generated table has non-monotonic page boundary at page ${page}.`);
      process.exit(1);
    }

    let current = start;
    for (let guard = 0; guard < 300; guard += 1) {
      const key = verseKey(current);
      if (!expectedPageByVerse.has(key)) {
        expectedPageByVerse.set(key, page);
      }
      if (compareVerseRefs(current, end) >= 0) break;
      const next = nextVerse(current);
      if (!next) break;
      current = next;
    }
  }

  return expectedPageByVerse;
}

const pageToFirstVerse = parseGeneratedPageTable();
const expectedPageByVerse = buildExpectedPageByVerse(pageToFirstVerse);
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

await client.connect();
const { rows } = await client.query(`
  SELECT surah_number, ayah_number, page_number
  FROM quran_verses
  ORDER BY surah_number, ayah_number
`);
await client.end();

const mismatches = [];
for (const row of rows) {
  const key = `${row.surah_number}:${row.ayah_number}`;
  const expected = expectedPageByVerse.get(key);
  if (expected === undefined || expected !== row.page_number) {
    mismatches.push({ ...row, expected });
  }
}

if (mismatches.length === 0) {
  console.log(`[ok] All ${rows.length} verses match QUL canonical pages.`);
  process.exit(0);
}

console.log(`[mismatch] ${mismatches.length} of ${rows.length} verses have wrong page numbers.`);
console.log("First 20:");
for (const mismatch of mismatches.slice(0, 20)) {
  const expected = mismatch.expected ?? "missing";
  console.log(
    `  ${mismatch.surah_number}:${mismatch.ayah_number} - db says ${mismatch.page_number}, QUL says ${expected}`,
  );
}

console.log("\nTo fix: run a separate slice that pushes corrected page numbers to quran_verses in Neon.");
process.exit(2);
