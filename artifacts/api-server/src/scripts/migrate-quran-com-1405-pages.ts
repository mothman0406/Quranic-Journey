import { pool } from "@workspace/db";
import {
  QURAN_COM_1405_PAGE_BY_AYAH,
  QURAN_COM_1405_SURAH_VERSE_COUNTS,
  QURAN_COM_1405_TOTAL_AYAHS,
  QURAN_COM_1405_TOTAL_PAGES,
} from "../data/quran-com-1405-pages.js";

type QuranVersePageRow = {
  surah_number: number;
  ayah_number: number;
  page_number: number;
};

type PageUpdate = {
  surah: number;
  ayah: number;
  from: number;
  to: number;
};

function safeDatabaseUrl(rawUrl: string | undefined) {
  if (!rawUrl) return "(not set)";
  try {
    const url = new URL(rawUrl);
    if (url.password) url.password = "***";
    return url.toString();
  } catch {
    return rawUrl.replace(/:[^:@]+@/, ":***@");
  }
}

function validateQuranCom1405Table() {
  const entries = Object.entries(QURAN_COM_1405_PAGE_BY_AYAH);
  if (entries.length !== QURAN_COM_1405_TOTAL_AYAHS) {
    throw new Error(
      `Expected ${QURAN_COM_1405_TOTAL_AYAHS} ayah mappings, found ${entries.length}.`,
    );
  }

  const pages = new Set<number>();
  const missing: string[] = [];
  for (let surah = 1; surah <= QURAN_COM_1405_SURAH_VERSE_COUNTS.length; surah += 1) {
    const ayahCount = QURAN_COM_1405_SURAH_VERSE_COUNTS[surah - 1];
    for (let ayah = 1; ayah <= ayahCount; ayah += 1) {
      const key = `${surah}:${ayah}`;
      const page = QURAN_COM_1405_PAGE_BY_AYAH[key];
      if (page === undefined) {
        missing.push(key);
        continue;
      }
      if (!Number.isInteger(page) || page < 1 || page > QURAN_COM_1405_TOTAL_PAGES) {
        throw new Error(`Invalid page ${page} for ayah ${key}.`);
      }
      pages.add(page);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing ${missing.length} ayah mappings. First missing: ${missing.slice(0, 10).join(", ")}`);
  }
  if (pages.size !== QURAN_COM_1405_TOTAL_PAGES) {
    throw new Error(`Expected mappings to cover ${QURAN_COM_1405_TOTAL_PAGES} pages, found ${pages.size}.`);
  }
}

async function main() {
  validateQuranCom1405Table();
  console.log(`[info] Target DB: ${safeDatabaseUrl(process.env.DATABASE_URL)}`);
  console.log(
    `[info] Loaded ${QURAN_COM_1405_TOTAL_AYAHS} Quran.com 1405 ayah→page mappings across ${QURAN_COM_1405_TOTAL_PAGES} pages.`,
  );

  const client = await pool.connect();
  try {
    const { rows } = await client.query<QuranVersePageRow>(`
      SELECT surah_number, ayah_number, page_number
      FROM quran_verses
      ORDER BY surah_number, ayah_number
    `);

    const updates: PageUpdate[] = [];
    const dbKeys = new Set<string>();
    for (const row of rows) {
      const key = `${row.surah_number}:${row.ayah_number}`;
      dbKeys.add(key);
      const expectedPage = QURAN_COM_1405_PAGE_BY_AYAH[key];
      if (expectedPage === undefined) {
        throw new Error(`quran_verses row ${key} is not present in the Quran.com 1405 table.`);
      }
      if (expectedPage !== row.page_number) {
        updates.push({
          surah: row.surah_number,
          ayah: row.ayah_number,
          from: row.page_number,
          to: expectedPage,
        });
      }
    }

    if (rows.length !== QURAN_COM_1405_TOTAL_AYAHS || dbKeys.size !== QURAN_COM_1405_TOTAL_AYAHS) {
      throw new Error(
        `Expected ${QURAN_COM_1405_TOTAL_AYAHS} quran_verses rows, found ${rows.length} rows / ${dbKeys.size} unique keys.`,
      );
    }

    const unchangedCount = rows.length - updates.length;
    console.log(`[info] Changed rows: ${updates.length}`);
    console.log(`[info] Unchanged rows: ${unchangedCount}`);

    if (updates.length > 0) {
      console.log("[info] First 20 updates:");
      for (const update of updates.slice(0, 20)) {
        console.log(`  ${update.surah}:${update.ayah}  ${update.from} -> ${update.to}`);
      }
      if (updates.length > 20) {
        console.log(`  ... and ${updates.length - 20} more`);
      }
    }

    await client.query("BEGIN");
    try {
      for (const update of updates) {
        const result = await client.query(
          `
            UPDATE quran_verses
            SET page_number = $1
            WHERE surah_number = $2
              AND ayah_number = $3
              AND page_number IS DISTINCT FROM $1
          `,
          [update.to, update.surah, update.ayah],
        );

        if (result.rowCount !== 1) {
          throw new Error(
            `Expected to update 1 row for ${update.surah}:${update.ayah}, updated ${result.rowCount}.`,
          );
        }
      }

      await client.query("COMMIT");
      console.log(`[ok] Committed ${updates.length} quran_verses.page_number updates.`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  } finally {
    client.release();
    await pool.end();
  }
}

await main().catch((error) => {
  console.error("[error] Quran.com 1405 page migration failed:", error);
  process.exitCode = 1;
});
