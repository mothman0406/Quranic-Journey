export type Reciter = {
  id: string;
  fullName: string;
  style: string;
  folder: string;        // everyayah.com data folder
  quranComId: number | null; // Quran.com /api/v4 recitation ID for per-ayah word timing
  qdcId: number | null;      // qurancdn.com /api/qdc reciter ID for chapter-level word timing
};

export const RECITERS: Reciter[] = [
  { id: "husary",    fullName: "Mahmoud Khalil Al-Husary",       style: "Murattal",  folder: "Husary_128kbps",                 quranComId: null, qdcId: 6  },
  { id: "afasy",     fullName: "Mishary Rashid Al-Afasy",         style: "Murattal",  folder: "Alafasy_128kbps",                quranComId: 4,    qdcId: null },
  { id: "sudais",    fullName: "Abdul Rahman Al-Sudais",          style: "Murattal",  folder: "Sudais_192kbps",                 quranComId: 9,    qdcId: null },
  { id: "basit",     fullName: "Abdul Basit Abdul Samad",         style: "Murattal",  folder: "Abdul_Basit_Murattal_192kbps",   quranComId: 2,    qdcId: null },
  { id: "minshawi",  fullName: "Muhammad Siddiq Al-Minshawi",     style: "Murattal",  folder: "Minshawi_Murattal_128kbps",      quranComId: 3,    qdcId: null },
  { id: "ghamdi",    fullName: "Sa'd Al-Ghamdi",                  style: "Murattal",  folder: "Ghamadi_40kbps",                 quranComId: 5,    qdcId: null },
  { id: "ajmi",      fullName: "Ahmad Al-Ajmi",                   style: "Murattal",  folder: "ahmed_ibn_ali_al-ajmy128kbps",   quranComId: 6,    qdcId: null },
];

export const DEFAULT_RECITER_ID = "husary";

export function findReciter(id: string): Reciter {
  return RECITERS.find((r) => r.id === id) ?? RECITERS[0]!;
}
