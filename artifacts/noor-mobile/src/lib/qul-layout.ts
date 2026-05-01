import qulLayoutJson from "../../assets/qul-kfgqpc-v4-layout.json";
import qulWordsJson from "../../assets/qul-words.json";

export type QulLineType = "surah_name" | "ayah" | "basmallah";

export type LineEntry = {
  lineNumber: number;
  lineType: QulLineType;
  isCentered: boolean;
  firstWordKey: string | null;
  lastWordKey: string | null;
  surahNumber: number | null;
};

type RawQulLayoutLine = {
  page_number: number;
  line_number: number;
  line_type: QulLineType;
  is_centered: boolean | number;
  first_word_id: number | null;
  last_word_id: number | null;
  surah_number: number | null;
};

type RawQulWord = {
  word_index: number;
  word_key: string;
  surah: number;
  ayah: number;
  text?: string;
};

type QulLayoutJson = {
  pages: RawQulLayoutLine[];
};

type QulWordsJson = {
  words: RawQulWord[];
};

type WordKeyParts = {
  surah: number;
  ayah: number;
  position: number;
};

let pageLayoutIndex: Map<number, LineEntry[]> | null = null;
let wordIndexByKey: Map<string, number> | null = null;
let wordKeyByIndex: Map<number, string> | null = null;

function asNullableNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseWordKey(wordKey: string): WordKeyParts | null {
  const [surah, ayah, position] = wordKey.split(":").map(Number);
  if (
    !Number.isFinite(surah) ||
    !Number.isFinite(ayah) ||
    !Number.isFinite(position)
  ) {
    return null;
  }

  return { surah, ayah, position };
}

export function compareWordKeys(left: string, right: string) {
  const a = parseWordKey(left);
  const b = parseWordKey(right);
  if (!a || !b) return left.localeCompare(right);

  if (a.surah !== b.surah) return a.surah - b.surah;
  if (a.ayah !== b.ayah) return a.ayah - b.ayah;
  return a.position - b.position;
}

function buildIndex() {
  if (pageLayoutIndex && wordIndexByKey && wordKeyByIndex) return;

  const layoutData = qulLayoutJson as QulLayoutJson;
  const wordsData = qulWordsJson as QulWordsJson;
  const nextWordKeyByIndex = new Map<number, string>();
  const nextWordIndexByKey = new Map<string, number>();

  for (const word of wordsData.words) {
    if (!Number.isFinite(word.word_index) || !word.word_key) continue;

    nextWordKeyByIndex.set(word.word_index, word.word_key);
    nextWordIndexByKey.set(word.word_key, word.word_index);
  }

  const nextPageLayoutIndex = new Map<number, LineEntry[]>();

  for (const line of layoutData.pages) {
    const pageNumber = asNullableNumber(line.page_number);
    const lineNumber = asNullableNumber(line.line_number);
    if (pageNumber === null || lineNumber === null) continue;

    const firstWordId = asNullableNumber(line.first_word_id);
    const lastWordId = asNullableNumber(line.last_word_id);
    const entry: LineEntry = {
      lineNumber,
      lineType: line.line_type,
      isCentered: line.is_centered === true || line.is_centered === 1,
      firstWordKey: firstWordId === null ? null : nextWordKeyByIndex.get(firstWordId) ?? null,
      lastWordKey: lastWordId === null ? null : nextWordKeyByIndex.get(lastWordId) ?? null,
      surahNumber: asNullableNumber(line.surah_number),
    };

    const pageLines = nextPageLayoutIndex.get(pageNumber) ?? [];
    pageLines.push(entry);
    nextPageLayoutIndex.set(pageNumber, pageLines);
  }

  for (const lines of nextPageLayoutIndex.values()) {
    lines.sort((a, b) => a.lineNumber - b.lineNumber);
  }

  pageLayoutIndex = nextPageLayoutIndex;
  wordIndexByKey = nextWordIndexByKey;
  wordKeyByIndex = nextWordKeyByIndex;
}

export function getCanonicalPageLayout(pageNumber: number): LineEntry[] {
  buildIndex();
  return pageLayoutIndex?.get(pageNumber) ?? [];
}

export function getCanonicalWordKeysInRange(
  firstWordKey: string | null,
  lastWordKey: string | null,
) {
  if (!firstWordKey || !lastWordKey) return [];

  buildIndex();
  const startIndex = wordIndexByKey?.get(firstWordKey);
  const endIndex = wordIndexByKey?.get(lastWordKey);
  if (startIndex === undefined || endIndex === undefined) return [];

  const lower = Math.min(startIndex, endIndex);
  const upper = Math.max(startIndex, endIndex);
  const wordKeys: string[] = [];

  for (let index = lower; index <= upper; index += 1) {
    const wordKey = wordKeyByIndex?.get(index);
    if (wordKey) wordKeys.push(wordKey);
  }

  return wordKeys;
}
