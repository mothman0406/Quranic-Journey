#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const requireFromDb = createRequire(resolve(repoRoot, "lib/db/package.json"));
const pg = requireFromDb("pg");

const EXPECTED_VERSE_COUNT = 6236;
const LARGE_UPDATE_THRESHOLD = 500;

if (!process.env.DATABASE_URL) {
  console.error("[error] DATABASE_URL not set. Source the prod env and re-run.");
  process.exit(1);
}

const args = new Set(process.argv.slice(2));
const confirmed = args.has("--confirm");

function safeDatabaseUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.password) url.password = "***";
    return url.toString();
  } catch {
    return rawUrl.replace(/:[^:@]+@/, ":***@");
  }
}

function parseWordKey(wordKey) {
  const [surah, ayah] = wordKey.split(":").map(Number);
  if (!Number.isFinite(surah) || !Number.isFinite(ayah)) return null;
  return { surah, ayah };
}

function buildExpectedPageByVerse(layout, words) {
  const wordKeyByIndex = new Map();
  for (const word of words.words ?? []) {
    if (Number.isFinite(word.word_index) && typeof word.word_key === "string") {
      wordKeyByIndex.set(word.word_index, word.word_key);
    }
  }

  const expectedPageByVerse = new Map();
  for (const line of layout.pages ?? []) {
    if (line.line_type !== "ayah" || typeof line.first_word_id !== "number") continue;
    if (!Number.isFinite(line.page_number)) continue;

    const start = line.first_word_id;
    const end = typeof line.last_word_id === "number" ? line.last_word_id : start;
    const lower = Math.min(start, end);
    const upper = Math.max(start, end);

    for (let wordIndex = lower; wordIndex <= upper; wordIndex += 1) {
      const wordKey = wordKeyByIndex.get(wordIndex);
      if (!wordKey) continue;

      const parsed = parseWordKey(wordKey);
      if (!parsed) continue;

      const key = `${parsed.surah}:${parsed.ayah}`;
      if (!expectedPageByVerse.has(key)) {
        expectedPageByVerse.set(key, line.page_number);
      }
    }
  }

  return expectedPageByVerse;
}

async function main() {
  console.log(`[info] Target DB: ${safeDatabaseUrl(process.env.DATABASE_URL)}`);

  const layoutPath = resolve(repoRoot, "artifacts/noor-mobile/assets/qul-kfgqpc-v4-layout.json");
  const wordsPath = resolve(repoRoot, "artifacts/noor-mobile/assets/qul-words.json");
  const layout = JSON.parse(readFileSync(layoutPath, "utf-8"));
  const words = JSON.parse(readFileSync(wordsPath, "utf-8"));
  const expectedPageByVerse = buildExpectedPageByVerse(layout, words);

  console.log(`[info] Loaded ${expectedPageByVerse.size} verse->page mappings from QUL.`);
  if (expectedPageByVerse.size !== EXPECTED_VERSE_COUNT) {
    console.error(
      `[error] Expected ${EXPECTED_VERSE_COUNT} QUL mappings, found ${expectedPageByVerse.size}. Aborting.`,
    );
    process.exitCode = 1;
    return;
  }

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const { rows: dbRows } = await client.query(`
      SELECT surah_number, ayah_number, page_number
      FROM quran_verses
      ORDER BY surah_number, ayah_number
    `);

    const missingExpected = [];
    const updates = [];
    for (const row of dbRows) {
      const key = `${row.surah_number}:${row.ayah_number}`;
      const expected = expectedPageByVerse.get(key);
      if (expected === undefined) {
        missingExpected.push(row);
      } else if (expected !== row.page_number) {
        updates.push({
          surah: row.surah_number,
          ayah: row.ayah_number,
          from: row.page_number,
          to: expected,
        });
      }
    }

    if (missingExpected.length > 0) {
      console.error(
        `[error] ${missingExpected.length} quran_verses rows are not present in QUL. Refusing to update.`,
      );
      for (const row of missingExpected.slice(0, 20)) {
        console.error(`  ${row.surah_number}:${row.ayah_number} page_number=${row.page_number}`);
      }
      if (missingExpected.length > 20) {
        console.error(`  ... and ${missingExpected.length - 20} more`);
      }
      process.exitCode = 1;
      return;
    }

    if (updates.length === 0) {
      console.log(`[ok] All ${dbRows.length} verses already match QUL. Nothing to do.`);
      return;
    }

    console.log(`[info] ${updates.length} of ${dbRows.length} verses need updating.`);

    if (updates.length > LARGE_UPDATE_THRESHOLD) {
      console.warn(
        `[warning] ${updates.length} page_number mismatches exceeds the ${LARGE_UPDATE_THRESHOLD}-row safety threshold.`,
      );
      if (!confirmed) {
        console.error(
          `[error] Refusing to update ${updates.length} rows without --confirm flag. Re-run with --confirm if you're sure.`,
        );
        process.exitCode = 1;
        return;
      }
    }

    console.log("[info] First 20 updates:");
    for (const update of updates.slice(0, 20)) {
      console.log(`  ${update.surah}:${update.ayah}  ${update.from} -> ${update.to}`);
    }
    if (updates.length > 20) {
      console.log(`  ... and ${updates.length - 20} more`);
    }

    await client.query("BEGIN");
    try {
      for (const update of updates) {
        const result = await client.query(
          "UPDATE quran_verses SET page_number = $1 WHERE surah_number = $2 AND ayah_number = $3",
          [update.to, update.surah, update.ayah],
        );
        if (result.rowCount !== 1) {
          throw new Error(`Expected to update 1 row for ${update.surah}:${update.ayah}, updated ${result.rowCount}.`);
        }
      }

      await client.query("COMMIT");
      console.log(`[ok] Committed ${updates.length} page_number updates.`);
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("[error] Update failed, transaction rolled back:", err);
      process.exitCode = 1;
    }
  } finally {
    await client.end();
  }
}

await main();
