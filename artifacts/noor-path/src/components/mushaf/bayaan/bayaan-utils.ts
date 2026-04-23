export type ApiWord = {
  position: number;
  text_uthmani: string;
  char_type_name: string;
  line_number: number;
  translation?: string | { text: string; language_name: string };
};

export type PageVerseData = {
  verse_key: string;
  text_uthmani: string;
  text_uthmani_tajweed?: string;
  words?: ApiWord[];
};

export type LineWord = {
  verse_key: string;
  surahId: number;
  verseNum: number;
  position: number;
  wordIdxInVerse: number;
  text_uthmani: string;
  char_type_name: string;
  line_number: number;
  translation?: string;
};

export type MushafChapter = {
  id: number;
  name_arabic: string;
  name_simple: string;
  translated_name: { name: string };
  bismillah_pre: boolean;
};

export function getArabicSurahNamesForPage(
  verses: PageVerseData[],
  chapters: MushafChapter[],
): string {
  const surahIds = Array.from(
    new Set(verses.map((verse) => Number(verse.verse_key.split(":")[0]))),
  ).filter((surahId) => Number.isFinite(surahId));

  return surahIds
    .map(
      (surahId) =>
        chapters.find((chapter) => chapter.id === surahId)?.name_arabic ??
        `سُورَة ${surahId}`,
    )
    .join(" · ");
}

export function stripTashkeel(s: string): string {
  return (
    s
      .replace(/\u0670/g, "ا")
      .replace(
        /[\u0610-\u061A\u064B-\u065F\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/g,
        "",
      )
      .replace(/[ـ]/g, "")
      .replace(/[أإآاٱ]/g, "ا")
      .trim() || s
  );
}

export const stripVerseEndHtml = (html: string): string =>
  html
    .replace(/(<span[^>]*>[\u06DD\u0660-\u0669\s]+<\/span>\s*)+$/, "")
    .replace(/[\u06DD\u0660-\u0669\s]+$/, "")
    .trimEnd();

export function splitTajweedIntoWords(html: string): string[] {
  if (!html) return [];

  const words: string[] = [];
  const openTags: Array<{ name: string; raw: string }> = [];
  const closeActiveTags = () =>
    openTags
      .slice()
      .reverse()
      .map((tag) => `</${tag.name}>`)
      .join("");
  const reopenActiveTags = () => openTags.map((tag) => tag.raw).join("");
  const hasTextContent = (chunk: string) =>
    chunk.replace(/<[^>]+>/g, "").trim().length > 0;
  const pushWord = (chunk: string) => {
    if (!hasTextContent(chunk)) return;
    words.push(`${chunk}${closeActiveTags()}`);
  };

  let current = "";
  let i = 0;
  while (i < html.length) {
    const char = html[i];

    if (char === "<") {
      const tagEnd = html.indexOf(">", i);
      if (tagEnd === -1) {
        current += html.slice(i);
        break;
      }

      const rawTag = html.slice(i, tagEnd + 1);
      current += rawTag;

      const tagNameMatch = rawTag.match(/^<\s*\/?\s*([a-zA-Z0-9:-]+)/);
      const tagName = tagNameMatch?.[1];
      const isClosingTag = /^<\s*\//.test(rawTag);
      const isSelfClosingTag = /\/\s*>$/.test(rawTag);

      if (tagName && !isSelfClosingTag) {
        if (isClosingTag) {
          const tagIndex = openTags.map((tag) => tag.name).lastIndexOf(tagName);
          if (tagIndex >= 0) {
            openTags.splice(tagIndex, 1);
          }
        } else {
          openTags.push({ name: tagName, raw: rawTag });
        }
      }

      i = tagEnd + 1;
      continue;
    }

    if (/\s/.test(char)) {
      pushWord(current);
      current = reopenActiveTags();
      while (i < html.length && /\s/.test(html[i])) i += 1;
      continue;
    }

    current += char;
    i += 1;
  }

  pushWord(current);
  return words;
}

export function buildLineGroups(
  verses: PageVerseData[],
): Array<{ lineNum: number; words: LineWord[] }> | null {
  const all: LineWord[] = [];
  for (const pv of verses) {
    if (!pv.words?.length) return null;
    const [surahStr, verseStr] = pv.verse_key.split(":");
    const surahId = parseInt(surahStr, 10);
    const verseNum = parseInt(verseStr, 10);
    const verseTokens = (pv.text_uthmani ?? "").split(/\s+/).filter(Boolean);
    let lastMatchedJ = -1;
    for (const w of pv.words) {
      let wordIdxInVerse: number;
      if (w.char_type_name === "end") {
        wordIdxInVerse = -1;
      } else {
        const target = stripTashkeel(w.text_uthmani);
        let found = -1;
        for (let j = lastMatchedJ + 1; j < verseTokens.length; j++) {
          if (stripTashkeel(verseTokens[j]) === target) {
            found = j;
            break;
          }
        }
        if (found !== -1) {
          lastMatchedJ = found;
          wordIdxInVerse = found;
        } else {
          wordIdxInVerse = w.position - 1;
        }
      }
      all.push({
        verse_key: pv.verse_key,
        surahId,
        verseNum,
        position: w.position,
        wordIdxInVerse,
        text_uthmani: w.text_uthmani,
        char_type_name: w.char_type_name,
        line_number: w.line_number,
        translation:
          typeof w.translation === "object" && w.translation !== null
            ? ((w.translation as { text?: string }).text ?? "")
            : w.translation,
      });
    }
  }

  if (all.length === 0) return null;
  const map = new Map<number, LineWord[]>();
  for (const word of all) {
    if (!map.has(word.line_number)) map.set(word.line_number, []);
    map.get(word.line_number)!.push(word);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a - b)
    .map(([lineNum, words]) => ({ lineNum, words }));
}
