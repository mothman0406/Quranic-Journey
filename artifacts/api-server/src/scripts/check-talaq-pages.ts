import { db } from "@workspace/db";
import { quranVersesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const rows = await db.select()
  .from(quranVersesTable)
  .where(eq(quranVersesTable.surahNumber, 65));

console.log("At-Talaq (surah 65) verses and their page numbers from DB:");
for (const r of rows) {
  console.log(`  Ayah ${r.ayahNumber}: page ${r.pageNumber}`);
}
process.exit(0);
