export type ApiWord = {
  position: number;
  text_uthmani: string;
  text_uthmani_tajweed?: string;
  translation?: { text: string; language_name: string } | string;
  char_type_name: "word" | "end";
  line_number: number;
};

const QURAN_TRANSLATION_ID = 20;

export type ApiVerse = {
  verse_number: number;
  verse_key: string;
  text_uthmani: string;
  page_number?: number;
  words: ApiWord[];
  translations?: Array<{ text?: string }>;
};

export type ApiPageVerse = {
  verse_key: string;
  verse_number: number;
  text_uthmani: string;
  words: ApiWord[];
};

export async function fetchSurahVerses(surahNumber: number): Promise<ApiVerse[]> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 10000);
  try {
    const res = await fetch(
      `https://api.quran.com/api/v4/verses/by_chapter/${surahNumber}?words=true&fields=text_uthmani,page_number&word_fields=text_uthmani,text_uthmani_tajweed,translation,line_number,char_type_name,position&per_page=300&translations=${QURAN_TRANSLATION_ID}`,
      { signal: ac.signal },
    );
    if (!res.ok) throw new Error(`Quran.com API ${res.status}`);
    const data = (await res.json()) as { verses?: ApiVerse[] };
    return data.verses ?? [];
  } finally {
    clearTimeout(timer);
  }
}

export function cleanTranslationHtml(raw: string): string {
  return raw
    .replace(/<sup[^>]*>.*?<\/sup>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#\d+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const ayahTranslationCache = new Map<string, string>();

export async function fetchAyahTranslation(
  verseKey: string,
  translationId = QURAN_TRANSLATION_ID,
): Promise<string> {
  const cacheKey = `${translationId}:${verseKey}`;
  const cached = ayahTranslationCache.get(cacheKey);
  if (cached) return cached;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 10000);
  try {
    const res = await fetch(
      `https://api.quran.com/api/v4/verses/by_key/${verseKey}?translations=${translationId}`,
      { signal: ac.signal },
    );
    if (!res.ok) throw new Error(`Translation unavailable (${res.status})`);
    const data = (await res.json()) as { verse?: { translations?: Array<{ text?: string }> } };
    const text = cleanTranslationHtml(data.verse?.translations?.[0]?.text ?? "");
    if (!text) throw new Error("Translation unavailable");
    ayahTranslationCache.set(cacheKey, text);
    return text;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchVersesByPage(pageNumber: number): Promise<ApiPageVerse[]> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 10000);
  try {
    const res = await fetch(
      `https://api.quran.com/api/v4/verses/by_page/${pageNumber}?words=true&fields=text_uthmani&word_fields=text_uthmani,text_uthmani_tajweed,translation,line_number,char_type_name,position&per_page=50&translations=${QURAN_TRANSLATION_ID}`,
      { signal: ac.signal },
    );
    if (!res.ok) throw new Error(`Quran.com API ${res.status}`);
    const data = (await res.json()) as { verses?: ApiPageVerse[] };
    return data.verses ?? [];
  } finally {
    clearTimeout(timer);
  }
}

export type ApiChapter = {
  id: number;
  name_arabic: string;
  name_simple: string;
  verses_count: number;
};

// Module-level cache — fetched once per app session, resolves to [] on error.
let chaptersPromise: Promise<ApiChapter[]> | null = null;

export function fetchAllChapters(): Promise<ApiChapter[]> {
  if (chaptersPromise) return chaptersPromise;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 10000);
  chaptersPromise = (async (): Promise<ApiChapter[]> => {
    try {
      const res = await fetch("https://api.quran.com/api/v4/chapters?language=en", {
        signal: ac.signal,
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { chapters?: ApiChapter[] };
      return data.chapters ?? [];
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
    }
  })();
  return chaptersPromise;
}
