import { SURAHS } from "../data/surahs.js";
import { getPageForVerse } from "../data/quran-meta.js";

export type HafidhTier = "juz_amma" | "last_10_juz" | "half_quran" | "full_hafidh";

export type HafidhTierDefinition = {
  tier: HafidhTier;
  label: string;
  pageStart: number;
  pageEnd: number;
  totalPages: number;
};

export type ProjectionTier = {
  tier: HafidhTier;
  label: string;
  totalPages: number;
  pagesRemaining: number;
  projectedCompletionDate: string | null;
  meetsExplicitTarget: boolean | null;
};

export type ProjectionResponse = {
  pacePagesPerWeek: number;
  pagesAlreadyMemorized: number;
  tiers: ProjectionTier[];
  activeTier: HafidhTier | null;
  targetDate: string | null;
  recentPacePagesPerWeek: number | null;
};

type MemorizationProgressLike = {
  surahId: number;
  versesMemorized: number;
  memorizedAyahs?: string | null;
};

type VerseKey = `${number}:${number}`;

// Derived from quran-meta JUZ_STARTS plus the generated 604-page Medina Mushaf table:
// Juz 30 starts page 582, Juz 21 starts page 402, and Juz 16 starts page 302.
export const HAFIDH_TIERS: ReadonlyArray<HafidhTierDefinition> = [
  { tier: "juz_amma", label: "Juz Amma", pageStart: 582, pageEnd: 604, totalPages: 23 },
  { tier: "last_10_juz", label: "Last 10 Juz", pageStart: 402, pageEnd: 604, totalPages: 203 },
  { tier: "half_quran", label: "Half Quran", pageStart: 302, pageEnd: 604, totalPages: 303 },
  { tier: "full_hafidh", label: "Full Hafidh", pageStart: 1, pageEnd: 604, totalPages: 604 },
];

const VALID_TIERS = new Set<HafidhTier>(HAFIDH_TIERS.map((tier) => tier.tier));
let pageVerseRefsCache: Map<number, VerseKey[]> | null = null;

function getLocalDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDaysToIsoDate(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return getLocalDateValue(date);
}

function parseMemorizedAyahs(
  raw: string | null | undefined,
  versesMemorized: number,
  verseCount: number,
): number[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    if (Array.isArray(parsed) && parsed.length > 0) {
      return Array.from(
        new Set(
          parsed
            .map((value) => Number(value))
            .filter((value) => Number.isInteger(value) && value >= 1 && value <= verseCount),
        ),
      ).sort((a, b) => a - b);
    }
  } catch {
    // Fall back to the legacy consecutive-count representation below.
  }

  const count = Math.max(0, Math.min(Math.floor(versesMemorized || 0), verseCount));
  return Array.from({ length: count }, (_, index) => index + 1);
}

function getPageVerseRefs(): Map<number, VerseKey[]> {
  if (pageVerseRefsCache) return pageVerseRefsCache;

  const refs = new Map<number, VerseKey[]>();
  for (const surah of SURAHS) {
    for (let ayah = 1; ayah <= surah.verseCount; ayah += 1) {
      const page = getPageForVerse(surah.number, ayah);
      const pageRefs = refs.get(page) ?? [];
      pageRefs.push(`${surah.number}:${ayah}`);
      refs.set(page, pageRefs);
    }
  }

  pageVerseRefsCache = refs;
  return refs;
}

function countMemorizedPagesInRange(
  memorizedPagesSet: Set<number>,
  pageStart: number,
  pageEnd: number,
) {
  let count = 0;
  for (let page = pageStart; page <= pageEnd; page += 1) {
    if (memorizedPagesSet.has(page)) count += 1;
  }
  return count;
}

function normalizePace(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function normalizeTargetDate(value: string | null) {
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

export function isHafidhTier(value: unknown): value is HafidhTier {
  return typeof value === "string" && VALID_TIERS.has(value as HafidhTier);
}

export function buildMemorizedPagesSet(
  progressRows: MemorizationProgressLike[],
): Set<number> {
  const memorizedVerseKeys = new Set<VerseKey>();

  for (const row of progressRows) {
    const surah = SURAHS.find((candidate) => candidate.id === row.surahId);
    if (!surah) continue;

    const ayahs = parseMemorizedAyahs(
      row.memorizedAyahs,
      row.versesMemorized,
      surah.verseCount,
    );
    for (const ayah of ayahs) {
      memorizedVerseKeys.add(`${surah.number}:${ayah}`);
    }
  }

  const memorizedPages = new Set<number>();
  for (const [page, verseRefs] of getPageVerseRefs()) {
    if (verseRefs.every((verseRef) => memorizedVerseKeys.has(verseRef))) {
      memorizedPages.add(page);
    }
  }

  return memorizedPages;
}

export function computeProjectedCompletionDate(
  pagesRemaining: number,
  pacePagesPerWeek: number,
): string | null {
  const pace = normalizePace(pacePagesPerWeek);
  if (pace <= 0) return null;
  if (pagesRemaining <= 0) return getLocalDateValue();

  const daysRemaining = Math.ceil((pagesRemaining / pace) * 7);
  return addDaysToIsoDate(getLocalDateValue(), daysRemaining);
}

export function computeProjections(input: {
  memorizedPagesSet: Set<number>;
  pacePagesPerWeek: number;
  recentPacePagesPerWeek: number | null;
  activeTier: HafidhTier | null;
  targetDate: string | null;
}): ProjectionResponse {
  const pacePagesPerWeek = normalizePace(input.pacePagesPerWeek);
  const targetDate = normalizeTargetDate(input.targetDate);

  return {
    pacePagesPerWeek,
    pagesAlreadyMemorized: input.memorizedPagesSet.size,
    activeTier: input.activeTier,
    targetDate,
    recentPacePagesPerWeek:
      input.recentPacePagesPerWeek == null
        ? null
        : normalizePace(input.recentPacePagesPerWeek),
    tiers: HAFIDH_TIERS.map((tier) => {
      const pagesMemorizedForTier = countMemorizedPagesInRange(
        input.memorizedPagesSet,
        tier.pageStart,
        tier.pageEnd,
      );
      const pagesRemaining = Math.max(0, tier.totalPages - pagesMemorizedForTier);
      const projectedCompletionDate = computeProjectedCompletionDate(
        pagesRemaining,
        pacePagesPerWeek,
      );

      return {
        tier: tier.tier,
        label: tier.label,
        totalPages: tier.totalPages,
        pagesRemaining,
        projectedCompletionDate,
        meetsExplicitTarget:
          targetDate == null
            ? null
            : projectedCompletionDate != null && projectedCompletionDate <= targetDate,
      };
    }),
  };
}
