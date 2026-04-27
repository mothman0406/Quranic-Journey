import { apiFetch } from "@/src/lib/api";
import type { Reciter } from "@/src/lib/reciters";

export type Segment = [number, number, number]; // [wordIdx1based, startFrac, endFrac]

export type NewMemorization = {
  surahName: string;
  surahNumber: number;
  currentWorkSurahNumber: number;
  currentWorkSurahName: string;
  currentWorkAyahStart: number;
  currentWorkAyahEnd: number;
  surahNameArabic: string;
  ayahStart: number;
  ayahEnd: number;
  endSurahNumber: number;
  pageStart: number;
  pageEnd: number;
  workType: string;
  workLabel: string;
  isReviewOnly: boolean;
  estimatedMinutes: number;
};

export type DashboardResponse = {
  todaysPlan: {
    newMemorization: NewMemorization | null;
  };
};

const qdcCache = new Map<string, Promise<Map<string, Segment[]>>>();

export async function fetchDashboard(childId: string): Promise<DashboardResponse> {
  return apiFetch<DashboardResponse>(`/api/children/${childId}/dashboard`);
}

export async function fetchQdcChapterTimings(
  qdcId: number,
  surah: number,
): Promise<Map<string, Segment[]>> {
  const key = `${qdcId}:${surah}`;
  const cached = qdcCache.get(key);
  if (cached) return cached;

  const promise = (async (): Promise<Map<string, Segment[]>> => {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 8000);
    try {
      const res = await fetch(
        `https://api.qurancdn.com/api/qdc/audio/reciters/${qdcId}/audio_files?chapter=${surah}&segments=true`,
        { signal: ac.signal },
      );
      if (!res.ok) return new Map();
      const data = (await res.json()) as {
        audio_files?: Array<{
          verse_timings?: Array<{
            verse_key: string;
            timestamp_from: number;
            timestamp_to: number;
            segments?: Array<[number, number, number]>;
          }>;
        }>;
      };
      const timings = data.audio_files?.[0]?.verse_timings;
      if (!Array.isArray(timings)) return new Map();

      const result = new Map<string, Segment[]>();
      for (const vt of timings) {
        const offset = vt.timestamp_from;
        const verseDur = vt.timestamp_to - offset;
        if (verseDur <= 0) continue;

        const raw: Segment[] = (vt.segments ?? []).map(
          (s) => [s[0], (s[1] - offset) / verseDur, (s[2] - offset) / verseDur] as Segment,
        );

        // de-dupe consecutive same-word entries
        const segs: Segment[] = [];
        for (const seg of raw) {
          if (segs.length > 0 && segs[segs.length - 1][0] === seg[0]) continue;
          segs.push(seg);
        }
        // trim overlapping end/start boundaries
        for (let i = 0; i < segs.length - 1; i++) {
          if (segs[i][2] > segs[i + 1][1]) {
            segs[i] = [segs[i][0], segs[i][1], segs[i + 1][1]];
          }
        }
        // re-index 1-based contiguous so seg[0]-1 === 0-based display index
        const reindexed = segs.map((s, i) => [i + 1, s[1], s[2]] as Segment);
        result.set(vt.verse_key, reindexed);
      }
      return result;
    } catch {
      return new Map();
    } finally {
      clearTimeout(timer);
    }
  })();

  qdcCache.set(key, promise);
  return promise;
}

const v4Cache = new Map<string, Promise<Map<string, Segment[]>>>();

async function fetchQuranComV4VerseTiming(
  quranComId: number,
  surah: number,
  verse: number,
): Promise<Segment[]> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 4000);
  try {
    const res = await fetch(
      `https://api.quran.com/api/v4/recitations/${quranComId}/by_ayah/${surah}:${verse}`,
      { signal: ac.signal },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      audio_files?: Array<{ segments?: Array<[number, number, number]> }>;
    };
    const segs = data.audio_files?.[0]?.segments;
    if (!Array.isArray(segs) || segs.length === 0) return [];
    const last = segs[segs.length - 1];
    if (!last) return [];
    const span = last[2];
    if (span <= 0) {
      return segs.map((s, i) => [i + 1, s[1], s[2]] as Segment);
    }
    return segs.map((s, i) => [i + 1, s[1] / span, s[2] / span] as Segment);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function fetchQuranComV4ChapterTimings(
  quranComId: number,
  surah: number,
  verseCount: number,
): Promise<Map<string, Segment[]>> {
  const key = `${quranComId}:${surah}`;
  const cached = v4Cache.get(key);
  if (cached) return cached;

  const promise = (async (): Promise<Map<string, Segment[]>> => {
    const result = new Map<string, Segment[]>();
    const fetches = Array.from({ length: verseCount }, (_, i) =>
      fetchQuranComV4VerseTiming(quranComId, surah, i + 1).then((segs) => {
        if (segs.length > 0) result.set(`${surah}:${i + 1}`, segs);
      }),
    );
    await Promise.all(fetches);
    return result;
  })();

  v4Cache.set(key, promise);
  return promise;
}

export async function fetchTimingsForReciter(
  reciter: Reciter,
  surah: number,
  verseCount: number,
): Promise<Map<string, Segment[]>> {
  if (reciter.qdcId !== null) {
    return fetchQdcChapterTimings(reciter.qdcId, surah);
  }
  if (reciter.quranComId !== null) {
    return fetchQuranComV4ChapterTimings(reciter.quranComId, surah, verseCount);
  }
  return new Map();
}

export async function submitMemorization(
  childId: string,
  payload: {
    surahId: number; // canonical 1-114
    memorizedAyahs: number[];
    ratedAyahs: number[];
    qualityRating: number;
    status: "memorized";
  },
): Promise<void> {
  await apiFetch(`/api/children/${childId}/memorization`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
