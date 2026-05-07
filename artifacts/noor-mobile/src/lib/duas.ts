import { apiFetch } from "@/src/lib/api";

export interface DuaCategory {
  slug: string;
  nameEnglish: string;
  nameArabic: string | null;
  orderIndex: number;
  description: string | null;
  duaCount: number;
}

export interface Dua {
  id: number;
  categorySlug: string;
  orderInCategory: number;
  title: string;
  arabic: string;
  transliteration: string;
  translation: string;
  reference: string | null;
  repetitions: number | null;
  notes: string | null;
  benefits: string | null;
  audioUrl: string | null;
}

export interface ChildDuaProgressEntry {
  dua: Dua;
  learned: boolean;
  learnedAt: string | null;
  practicedCount: number;
}

export async function fetchDuaCategories(): Promise<DuaCategory[]> {
  const response = await apiFetch<{ categories: DuaCategory[] }>("/api/duas/categories");
  return response.categories;
}

export async function fetchDuaCategory(
  slug: string,
): Promise<{ category: DuaCategory; duas: Dua[] }> {
  return apiFetch<{ category: DuaCategory; duas: Dua[] }>(`/api/duas/categories/${slug}`);
}

export async function fetchDua(id: number): Promise<Dua> {
  const response = await apiFetch<{ dua: Dua }>(`/api/duas/${id}`);
  return response.dua;
}

export async function fetchChildDuas(childId: string): Promise<ChildDuaProgressEntry[]> {
  const response = await apiFetch<{ duas: ChildDuaProgressEntry[] }>(
    `/api/children/${childId}/duas`,
  );
  return response.duas;
}

export async function markDuaLearned(
  childId: string,
  duaId: number,
  learned: boolean,
): Promise<ChildDuaProgressEntry> {
  // Existing backend semantics increment practicedCount as a side effect of every POST.
  return apiFetch<ChildDuaProgressEntry>(`/api/children/${childId}/duas`, {
    method: "POST",
    body: JSON.stringify({ duaId, learned }),
  });
}
