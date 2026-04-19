import { db } from "@workspace/db";
import { quranVersesTable } from "@workspace/db/schema";

const QURAN_API = "https://api.quran.com/api/v4";

async function seed() {
  console.log("Seeding quran_verses table...");

  const existing = await db.select().from(quranVersesTable).limit(1);
  if (existing.length > 0) {
    console.log("Table already has data. Pass --force to reseed.");
    if (!process.argv.includes("--force")) process.exit(0);
    console.log("--force passed, clearing table...");
    await db.delete(quranVersesTable);
  }

  let totalInserted = 0;

  for (let surah = 1; surah <= 114; surah++) {
    process.stdout.write(`Fetching surah ${surah}/114...`);
    try {
      const res = await fetch(
        `${QURAN_API}/verses/by_chapter/${surah}?fields=text_uthmani,page_number,juz_number&per_page=300`,
        { signal: AbortSignal.timeout(15000) }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { verses?: any[] };
      const verses = data.verses ?? [];

      if (verses.length > 0) {
        await db.insert(quranVersesTable).values(
          verses.map((v: any) => ({
            surahNumber: surah,
            ayahNumber: v.verse_number,
            pageNumber: v.page_number ?? 0,
            textUthmani: v.text_uthmani ?? "",
            juzNumber: v.juz_number ?? 0,
          }))
        );
        totalInserted += verses.length;
      }
      console.log(` ✓ ${verses.length} verses`);
      await new Promise(r => setTimeout(r, 100));
    } catch (err) {
      console.error(` ✗ Failed: ${err}`);
    }
  }

  console.log(`\nDone! Inserted ${totalInserted} verses.`);
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
