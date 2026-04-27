export type ApiWord = {
  position: number;
  text_uthmani: string;
  char_type_name: "word" | "end";
  line_number: number;
};

export type ApiVerse = {
  verse_number: number;
  verse_key: string;
  text_uthmani: string;
  words: ApiWord[];
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
      `https://api.quran.com/api/v4/verses/by_chapter/${surahNumber}?words=true&fields=text_uthmani&word_fields=text_uthmani,line_number,char_type_name&per_page=300`,
      { signal: ac.signal },
    );
    if (!res.ok) throw new Error(`Quran.com API ${res.status}`);
    const data = (await res.json()) as { verses?: ApiVerse[] };
    return data.verses ?? [];
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchVersesByPage(pageNumber: number): Promise<ApiPageVerse[]> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 10000);
  try {
    const res = await fetch(
      `https://api.quran.com/api/v4/verses/by_page/${pageNumber}?words=true&fields=text_uthmani&word_fields=text_uthmani,line_number,char_type_name,position&per_page=50`,
      { signal: ac.signal },
    );
    if (!res.ok) throw new Error(`Quran.com API ${res.status}`);
    const data = (await res.json()) as { verses?: ApiPageVerse[] };
    return data.verses ?? [];
  } finally {
    clearTimeout(timer);
  }
}
