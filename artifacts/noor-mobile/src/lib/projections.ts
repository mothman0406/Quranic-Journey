import { apiFetch } from "@/src/lib/api";

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

export const HAFIDH_TIERS: ReadonlyArray<HafidhTierDefinition> = [
  { tier: "juz_amma", label: "Juz Amma", pageStart: 582, pageEnd: 604, totalPages: 23 },
  { tier: "last_10_juz", label: "Last 10 Juz", pageStart: 402, pageEnd: 604, totalPages: 203 },
  { tier: "half_quran", label: "Half Quran", pageStart: 302, pageEnd: 604, totalPages: 303 },
  { tier: "full_hafidh", label: "Full Hafidh", pageStart: 1, pageEnd: 604, totalPages: 604 },
];

const TIER_LABELS = Object.fromEntries(
  HAFIDH_TIERS.map((tier) => [tier.tier, tier.label]),
) as Record<HafidhTier, string>;
const TIER_TOTALS = Object.fromEntries(
  HAFIDH_TIERS.map((tier) => [tier.tier, tier.totalPages]),
) as Record<HafidhTier, number>;

function isHafidhTier(value: unknown): value is HafidhTier {
  return (
    value === "juz_amma" ||
    value === "last_10_juz" ||
    value === "half_quran" ||
    value === "full_hafidh"
  );
}

function asNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asNullableNumber(value: unknown) {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asNullableString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNullableBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

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

function normalizeTier(raw: unknown): ProjectionTier | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<ProjectionTier>;
  if (!isHafidhTier(value.tier)) return null;
  const totalPages = Math.max(0, Math.round(asNumber(value.totalPages, TIER_TOTALS[value.tier])));
  return {
    tier: value.tier,
    label: typeof value.label === "string" && value.label.length > 0
      ? value.label
      : TIER_LABELS[value.tier],
    totalPages,
    pagesRemaining: Math.max(0, Math.round(asNumber(value.pagesRemaining, totalPages))),
    projectedCompletionDate: asNullableString(value.projectedCompletionDate),
    meetsExplicitTarget: asNullableBoolean(value.meetsExplicitTarget),
  };
}

export function computeProjectedCompletionDate(
  pagesRemaining: number,
  pacePagesPerWeek: number,
): string | null {
  const pace = Math.max(0, asNumber(pacePagesPerWeek));
  if (pace <= 0) return null;
  if (pagesRemaining <= 0) return getLocalDateValue();
  return addDaysToIsoDate(getLocalDateValue(), Math.ceil((pagesRemaining / pace) * 7));
}

export function normalizeProjectionResponse(raw: Partial<ProjectionResponse>): ProjectionResponse {
  const tiers = Array.isArray(raw.tiers)
    ? raw.tiers.map(normalizeTier).filter((tier): tier is ProjectionTier => tier != null)
    : [];

  return {
    pacePagesPerWeek: Math.max(0, asNumber(raw.pacePagesPerWeek)),
    pagesAlreadyMemorized: Math.max(0, Math.round(asNumber(raw.pagesAlreadyMemorized))),
    tiers,
    activeTier: isHafidhTier(raw.activeTier) ? raw.activeTier : null,
    targetDate: asNullableString(raw.targetDate),
    recentPacePagesPerWeek: asNullableNumber(raw.recentPacePagesPerWeek),
  };
}

export async function fetchHafidhProjections(childId: string): Promise<ProjectionResponse> {
  const response = await apiFetch<ProjectionResponse>(`/api/children/${childId}/projections`);
  return normalizeProjectionResponse(response);
}
