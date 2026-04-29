export const TOTAL_MUSHAF_PAGES = 604;

export function mushafPageUrl(page: number): string {
  const padded = String(page).padStart(3, "0");
  return `https://raw.githubusercontent.com/GovarJabbar/Quran-PNG/master/${padded}.png`;
}

export type MushafSurah = {
  number: number;
  name: string;
  translation: string;
  verseCount: number;
  startPage: number;
  endPage: number;
  juzStart: number;
  searchText: string;
};

export type MushafJuz = {
  number: number;
  startPage: number;
  endPage: number;
};

const SURAH_NAMES = [
  "Al-Fatihah",
  "Al-Baqarah",
  "Al-Imran",
  "An-Nisa",
  "Al-Ma'idah",
  "Al-An'am",
  "Al-A'raf",
  "Al-Anfal",
  "At-Tawbah",
  "Yunus",
  "Hud",
  "Yusuf",
  "Ar-Ra'd",
  "Ibrahim",
  "Al-Hijr",
  "An-Nahl",
  "Al-Isra",
  "Al-Kahf",
  "Maryam",
  "Ta-Ha",
  "Al-Anbiya",
  "Al-Hajj",
  "Al-Mu'minun",
  "An-Nur",
  "Al-Furqan",
  "Ash-Shu'ara",
  "An-Naml",
  "Al-Qasas",
  "Al-'Ankabut",
  "Ar-Rum",
  "Luqman",
  "As-Sajdah",
  "Al-Ahzab",
  "Saba",
  "Fatir",
  "Ya-Sin",
  "As-Saffat",
  "Sad",
  "Az-Zumar",
  "Ghafir",
  "Fussilat",
  "Ash-Shura",
  "Az-Zukhruf",
  "Ad-Dukhan",
  "Al-Jathiyah",
  "Al-Ahqaf",
  "Muhammad",
  "Al-Fath",
  "Al-Hujurat",
  "Qaf",
  "Adh-Dhariyat",
  "At-Tur",
  "An-Najm",
  "Al-Qamar",
  "Ar-Rahman",
  "Al-Waqi'ah",
  "Al-Hadid",
  "Al-Mujadila",
  "Al-Hashr",
  "Al-Mumtahanah",
  "As-Saf",
  "Al-Jumu'ah",
  "Al-Munafiqun",
  "At-Taghabun",
  "At-Talaq",
  "At-Tahrim",
  "Al-Mulk",
  "Al-Qalam",
  "Al-Haqqah",
  "Al-Ma'arij",
  "Nuh",
  "Al-Jinn",
  "Al-Muzzammil",
  "Al-Muddaththir",
  "Al-Qiyamah",
  "Al-Insan",
  "Al-Mursalat",
  "An-Naba",
  "An-Nazi'at",
  "'Abasa",
  "At-Takwir",
  "Al-Infitar",
  "Al-Mutaffifin",
  "Al-Inshiqaq",
  "Al-Buruj",
  "At-Tariq",
  "Al-A'la",
  "Al-Ghashiyah",
  "Al-Fajr",
  "Al-Balad",
  "Ash-Shams",
  "Al-Layl",
  "Ad-Duha",
  "Ash-Sharh",
  "At-Tin",
  "Al-'Alaq",
  "Al-Qadr",
  "Al-Bayyinah",
  "Az-Zalzalah",
  "Al-'Adiyat",
  "Al-Qari'ah",
  "At-Takathur",
  "Al-'Asr",
  "Al-Humazah",
  "Al-Fil",
  "Quraysh",
  "Al-Ma'un",
  "Al-Kawthar",
  "Al-Kafirun",
  "An-Nasr",
  "Al-Masad",
  "Al-Ikhlas",
  "Al-Falaq",
  "An-Nas",
] as const;

const SURAH_TRANSLATIONS = [
  "The Opening",
  "The Cow",
  "The Family of Imran",
  "The Women",
  "The Table Spread",
  "The Cattle",
  "The Heights",
  "The Spoils of War",
  "The Repentance",
  "Jonah",
  "Hud",
  "Joseph",
  "The Thunder",
  "Abraham",
  "The Rocky Tract",
  "The Bee",
  "The Night Journey",
  "The Cave",
  "Mary",
  "Ta-Ha",
  "The Prophets",
  "The Pilgrimage",
  "The Believers",
  "The Light",
  "The Criterion",
  "The Poets",
  "The Ant",
  "The Stories",
  "The Spider",
  "The Romans",
  "Luqman",
  "The Prostration",
  "The Confederates",
  "Sheba",
  "Originator",
  "Ya-Sin",
  "Those Who Set The Ranks",
  "Sad",
  "The Troops",
  "The Forgiver",
  "Explained In Detail",
  "The Consultation",
  "The Ornaments of Gold",
  "The Smoke",
  "The Crouching",
  "The Wind-Curved Sandhills",
  "Muhammad",
  "The Victory",
  "The Rooms",
  "Qaf",
  "The Winnowing Winds",
  "The Mount",
  "The Star",
  "The Moon",
  "The Most Merciful",
  "The Inevitable",
  "The Iron",
  "The Pleading Woman",
  "The Exile",
  "She That Is To Be Examined",
  "The Ranks",
  "The Congregation",
  "The Hypocrites",
  "The Mutual Disillusion",
  "The Divorce",
  "The Prohibition",
  "The Sovereignty",
  "The Pen",
  "The Reality",
  "The Ascending Stairways",
  "Noah",
  "The Jinn",
  "The Enshrouded One",
  "The Cloaked One",
  "The Resurrection",
  "Man",
  "The Emissaries",
  "The Tidings",
  "Those Who Drag Forth",
  "He Frowned",
  "The Overthrowing",
  "The Cleaving",
  "The Defrauding",
  "The Sundering",
  "The Mansions of the Stars",
  "The Nightcomer",
  "The Most High",
  "The Overwhelming",
  "The Dawn",
  "The City",
  "The Sun",
  "The Night",
  "The Morning Hours",
  "The Relief",
  "The Fig",
  "The Clot",
  "The Power",
  "The Clear Proof",
  "The Earthquake",
  "The Courser",
  "The Calamity",
  "The Rivalry in World Increase",
  "The Declining Day",
  "The Slanderer",
  "The Elephant",
  "Quraysh",
  "The Small Kindnesses",
  "The Abundance",
  "The Disbelievers",
  "The Divine Support",
  "The Palm Fiber",
  "Sincerity",
  "The Daybreak",
  "Mankind",
] as const;

export const SURAH_VERSE_COUNTS = [
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
  5, 4, 5, 6,
] as const;

export const SURAH_START_PAGES = [
  1, 2, 50, 77, 106, 128, 151, 177, 187, 208,
  221, 235, 249, 255, 262, 267, 282, 293, 305, 312,
  322, 332, 342, 350, 359, 367, 377, 385, 396, 404,
  411, 415, 418, 428, 434, 440, 446, 453, 458, 467,
  477, 483, 489, 496, 499, 502, 507, 511, 515, 518,
  520, 523, 526, 528, 531, 534, 537, 542, 545, 549,
  551, 553, 554, 556, 558, 560, 562, 564, 566, 568,
  570, 572, 574, 575, 577, 578, 580, 582, 583, 585,
  586, 587, 587, 589, 590, 591, 591, 592, 593, 594,
  595, 595, 596, 596, 597, 597, 598, 598, 599, 599,
  600, 600, 601, 601, 601, 602, 602, 602, 603, 603,
  603, 604, 604, 604,
] as const;

export const JUZ_START_PAGES = [
  1, 22, 42, 62, 82, 102, 121, 142, 162, 182,
  201, 222, 242, 262, 282, 302, 322, 342, 362, 382,
  402, 422, 442, 462, 482, 502, 522, 542, 562, 582,
] as const;

export function clampMushafPage(page: number): number {
  if (!Number.isFinite(page)) return 1;
  return Math.max(1, Math.min(TOTAL_MUSHAF_PAGES, Math.round(page)));
}

export function getJuzForMushafPage(pageNumber: number): number {
  const page = clampMushafPage(pageNumber);
  for (let i = JUZ_START_PAGES.length - 1; i >= 0; i -= 1) {
    if (page >= JUZ_START_PAGES[i]) return i + 1;
  }
  return 1;
}

export function getJuzStartPage(juzNumber: number): number | null {
  if (!Number.isInteger(juzNumber) || juzNumber < 1 || juzNumber > JUZ_START_PAGES.length) {
    return null;
  }
  return JUZ_START_PAGES[juzNumber - 1];
}

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export const MUSHAF_SURAHS: MushafSurah[] = SURAH_NAMES.map((name, index) => {
  const number = index + 1;
  const startPage = SURAH_START_PAGES[index];
  const nextStartPage = SURAH_START_PAGES[index + 1] ?? TOTAL_MUSHAF_PAGES + 1;
  const endPage = Math.max(startPage, nextStartPage - 1);
  const translation = SURAH_TRANSLATIONS[index];
  const verseCount = SURAH_VERSE_COUNTS[index];
  const juzStart = getJuzForMushafPage(startPage);
  return {
    number,
    name,
    translation,
    verseCount,
    startPage,
    endPage,
    juzStart,
    searchText: normalizeSearchText(`${number} ${name} ${translation} surah ${number} juz ${juzStart}`),
  };
});

export const MUSHAF_JUZS: MushafJuz[] = JUZ_START_PAGES.map((startPage, index) => ({
  number: index + 1,
  startPage,
  endPage: JUZ_START_PAGES[index + 1] ? JUZ_START_PAGES[index + 1] - 1 : TOTAL_MUSHAF_PAGES,
}));

export function getMushafSurahForPage(pageNumber: number): MushafSurah {
  const page = clampMushafPage(pageNumber);
  for (let i = MUSHAF_SURAHS.length - 1; i >= 0; i -= 1) {
    if (page >= MUSHAF_SURAHS[i].startPage) return MUSHAF_SURAHS[i];
  }
  return MUSHAF_SURAHS[0];
}

export function searchMushafSurahs(query: string): MushafSurah[] {
  const normalized = normalizeSearchText(query);
  if (!normalized) return MUSHAF_SURAHS;
  return MUSHAF_SURAHS.filter((surah) => surah.searchText.includes(normalized));
}
