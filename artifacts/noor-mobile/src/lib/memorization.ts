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

export type WorkStatus = "not_started" | "in_progress" | "completed";

export type DashboardChild = {
  name: string;
  avatarEmoji?: string;
  memorizePagePerDay?: number;
  practiceMinutesPerDay?: number;
};

export type TodayProgress = {
  memStatus: WorkStatus;
  memTargetSurah: number | null;
  memTargetAyahStart: number | null;
  memTargetAyahEnd: number | null;
  memCompletedAyahEnd: number | null;
  reviewStatus: WorkStatus;
  reviewTargetCount: number | null;
  reviewCompletedCount: number;
};

export type DashboardResponse = {
  child?: DashboardChild;
  todaysPlan: {
    newMemorization: NewMemorization | null;
    totalEstimatedMinutes?: number;
  };
  todayProgress?: TodayProgress;
  upNextMemorization?: NewMemorization | null;
  nextSurah?: SurahSummary | null;
};

export type MemorizationStatus = "not_started" | "in_progress" | "memorized" | "needs_review";

export type MemorizationProgress = {
  id: number;
  childId: number;
  surahId: number;
  surahName: string;
  surahNumber: number;
  status: MemorizationStatus;
  versesMemorized: number;
  memorizedAyahs: number[];
  totalVerses: number;
  percentComplete: number;
  lastPracticed?: string | null;
  nextReviewDate?: string | null;
  reviewCount: number;
  strength: number;
  ayahStrengths?: Record<string, number>;
};

export type SurahSummary = {
  id: number;
  number: number;
  nameArabic: string;
  nameTransliteration: string;
  nameTranslation: string;
  verseCount: number;
  juzStart: number;
  revelationType: "meccan" | "medinan";
  difficulty: "beginner" | "intermediate" | "advanced";
  ageGroup: "toddler" | "child" | "preteen" | "teen" | "all";
  recommendedOrder: number;
  tajweedNotes?: string[];
};

const qdcCache = new Map<string, Promise<Map<string, Segment[]>>>();

export async function fetchDashboard(childId: string): Promise<DashboardResponse> {
  return apiFetch<DashboardResponse>(`/api/children/${childId}/dashboard`);
}

export async function fetchMemorizationProgress(
  childId: string,
): Promise<MemorizationProgress[]> {
  const response = await apiFetch<{ progress: MemorizationProgress[] }>(
    `/api/children/${childId}/memorization`,
  );
  return response.progress;
}

export async function fetchSurahs(): Promise<SurahSummary[]> {
  const response = await apiFetch<{ surahs: SurahSummary[] }>("/api/surahs");
  return response.surahs;
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

const v4VerseCache = new Map<string, Segment[]>();
const v4InflightCache = new Map<string, Promise<Segment[]>>();

export async function fetchQuranComV4VerseTiming(
  quranComId: number,
  surah: number,
  verse: number,
): Promise<Segment[]> {
  const key = `${quranComId}:${surah}:${verse}`;
  const cached = v4VerseCache.get(key);
  if (cached) return cached;
  const inflight = v4InflightCache.get(key);
  if (inflight) return inflight;

  const promise = (async (): Promise<Segment[]> => {
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
  })();

  v4InflightCache.set(key, promise);
  promise.then((segs) => {
    v4VerseCache.set(key, segs);
    v4InflightCache.delete(key);
  });
  return promise;
}

export type ChapterTimings =
  | { kind: "chapter"; map: Map<string, Segment[]> }
  | { kind: "ondemand"; fetch: (verse: number) => Promise<Segment[]> };

export async function fetchTimingsForReciter(
  reciter: Reciter,
  surah: number,
): Promise<ChapterTimings> {
  if (reciter.qdcId !== null) {
    const map = await fetchQdcChapterTimings(reciter.qdcId, surah);
    return { kind: "chapter", map };
  }
  if (reciter.quranComId !== null) {
    const id = reciter.quranComId;
    return {
      kind: "ondemand",
      fetch: (verse: number) => fetchQuranComV4VerseTiming(id, surah, verse),
    };
  }
  return { kind: "chapter", map: new Map() };
}

export async function submitMemorization(
  childId: string,
  payload: {
    surahId: number; // canonical 1-114
    memorizedAyahs: number[];
    ratedAyahs: number[];
    qualityRating: number;
    status: "memorized" | "in_progress";
  },
): Promise<void> {
  await apiFetch(`/api/children/${childId}/memorization`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function submitDailyProgress(
  childId: string,
  payload: {
    memStatus: WorkStatus;
    memCompletedAyahEnd: number;
    memTargetSurah?: number;
    memTargetAyahStart?: number;
    memTargetAyahEnd?: number;
    memTargetEndSurah?: number;
  },
): Promise<void> {
  await apiFetch(`/api/children/${childId}/daily-progress`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
