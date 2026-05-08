import type { Reciter } from "@/src/lib/reciters";
import { reciterUsesChapterAudio } from "@/src/lib/reciters";

function pad(n: number, len: number): string {
  return String(n).padStart(len, "0");
}

export type AyahTiming = {
  surahNumber: number;
  ayahNumber: number;
  timestampFrom: number;
  timestampTo: number;
  durationMs: number;
};

export type AyahPlaybackSource = {
  uri: string;
  startMillis: number;
  endMillis: number | null;
  durationMillis: number | null;
  usesChapterAudio: boolean;
};

type ChapterTimingData = {
  audioUrl: string | null;
  timings: AyahTiming[];
};

const ayahTimingCache = new Map<string, Promise<AyahTiming[]>>();
const qdcChapterTimingCache = new Map<string, Promise<ChapterTimingData>>();

export function ayahAudioUrl(reciter: Reciter, surahNumber: number, ayahNumber: number): string {
  if (!reciter.folder) {
    throw new Error(`${reciter.fullName} uses chapter audio; resolve an ayah playback source first.`);
  }
  return `https://everyayah.com/data/${reciter.folder}/${pad(surahNumber, 3)}${pad(ayahNumber, 3)}.mp3`;
}

export function chapterAudioUrl(reciter: Reciter, surahNumber: number): string {
  if (!reciter.server) {
    throw new Error(`No chapter audio server configured for ${reciter.fullName}.`);
  }
  return `${reciter.server.replace(/\/+$/, "")}/${pad(surahNumber, 3)}.mp3`;
}

export function wbwAudioUrl(surahNumber: number, ayahNumber: number, wordPosition: number): string {
  return `https://audio.qurancdn.com/wbw/${pad(surahNumber, 3)}_${pad(ayahNumber, 3)}_${pad(wordPosition, 3)}.mp3`;
}

async function fetchMp3QuranAyahTimings(
  readId: number,
  surahNumber: number,
): Promise<AyahTiming[]> {
  const response = await fetch(
    `https://mp3quran.net/api/v3/ayat_timing?surah=${surahNumber}&read=${readId}`,
  );
  if (!response.ok) return [];
  const data = (await response.json()) as {
    ayah: number;
    start_time: number;
    end_time: number;
  }[];
  if (!Array.isArray(data)) return [];
  return data
    .map((item) => ({
      surahNumber,
      ayahNumber: item.ayah,
      timestampFrom: item.start_time,
      timestampTo: item.end_time,
      durationMs: item.end_time - item.start_time,
    }))
    .filter((item) => item.durationMs > 0);
}

async function fetchQdcChapterTimingData(
  qdcId: number,
  surahNumber: number,
): Promise<ChapterTimingData> {
  const cacheKey = `${qdcId}:${surahNumber}`;
  const cached = qdcChapterTimingCache.get(cacheKey);
  if (cached) return cached;

  const promise = (async (): Promise<ChapterTimingData> => {
    try {
      const response = await fetch(
        `https://api.qurancdn.com/api/qdc/audio/reciters/${qdcId}/audio_files?chapter=${surahNumber}&segments=true`,
      );
      if (!response.ok) return { audioUrl: null, timings: [] };
      const data = (await response.json()) as {
        audio_files?: {
          audio_url?: string;
          verse_timings?: {
            verse_key: string;
            timestamp_from: number;
            timestamp_to: number;
          }[];
        }[];
      };
      const audioFile = data.audio_files?.[0];
      const timings = audioFile?.verse_timings;
      if (!Array.isArray(timings)) {
        return { audioUrl: audioFile?.audio_url ?? null, timings: [] };
      }
      return {
        audioUrl: audioFile?.audio_url ?? null,
        timings: timings
          .map((item) => {
            const ayahNumber = Number(item.verse_key.split(":")[1]);
            return {
              surahNumber,
              ayahNumber,
              timestampFrom: item.timestamp_from,
              timestampTo: item.timestamp_to,
              durationMs: item.timestamp_to - item.timestamp_from,
            };
          })
          .filter((item) => Number.isInteger(item.ayahNumber) && item.durationMs > 0),
      };
    } catch {
      return { audioUrl: null, timings: [] };
    }
  })();

  qdcChapterTimingCache.set(cacheKey, promise);
  return promise;
}

async function fetchQdcAyahTimings(
  qdcId: number,
  surahNumber: number,
): Promise<AyahTiming[]> {
  const data = await fetchQdcChapterTimingData(qdcId, surahNumber);
  return data.timings;
}

export async function fetchAyahTimingsForReciter(
  reciter: Reciter,
  surahNumber: number,
): Promise<AyahTiming[]> {
  const cacheKey = `${reciter.id}:${surahNumber}`;
  const cached = ayahTimingCache.get(cacheKey);
  if (cached) return cached;

  const promise = (async () => {
    if (reciter.qdcId !== null) {
      const qdcTimings = await fetchQdcAyahTimings(reciter.qdcId, surahNumber);
      if (qdcTimings.length > 0) return qdcTimings;
    }
    if (reciter.mp3QuranReadId !== null && reciter.mp3QuranReadId !== undefined) {
      return fetchMp3QuranAyahTimings(reciter.mp3QuranReadId, surahNumber);
    }
    return [];
  })();

  ayahTimingCache.set(cacheKey, promise);
  return promise;
}

export async function resolveAyahAudioSource(
  reciter: Reciter,
  surahNumber: number,
  ayahNumber: number,
): Promise<AyahPlaybackSource> {
  if (!reciterUsesChapterAudio(reciter)) {
    return {
      uri: ayahAudioUrl(reciter, surahNumber, ayahNumber),
      startMillis: 0,
      endMillis: null,
      durationMillis: null,
      usesChapterAudio: false,
    };
  }

  const qdcChapter =
    reciter.qdcId !== null
      ? await fetchQdcChapterTimingData(reciter.qdcId, surahNumber)
      : null;
  const usingQdcTimings = Boolean(qdcChapter && qdcChapter.timings.length > 0);
  const timings =
    usingQdcTimings && qdcChapter
      ? qdcChapter.timings
      : await fetchAyahTimingsForReciter(reciter, surahNumber);
  const timing = timings.find((item) => item.ayahNumber === ayahNumber);
  if (!timing) {
    throw new Error(`Ayah timing unavailable for ${reciter.fullName} ${surahNumber}:${ayahNumber}.`);
  }

  return {
    uri:
      usingQdcTimings && qdcChapter?.audioUrl
        ? qdcChapter.audioUrl
        : chapterAudioUrl(reciter, surahNumber),
    startMillis: timing.timestampFrom,
    endMillis: timing.timestampTo,
    durationMillis: timing.durationMs,
    usesChapterAudio: true,
  };
}
