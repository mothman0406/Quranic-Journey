import duasData from "./duas.json" with { type: "json" };

export interface DuaCategory {
  slug: string;
  nameEnglish: string;
  nameArabic: string | null;
  orderIndex: number;
  description: string | null;
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

export const DUA_CATEGORIES: readonly DuaCategory[] = duasData.categories;
export const DUAS: readonly Dua[] = duasData.duas;

export function getDuaById(id: number): Dua | undefined {
  return DUAS.find((dua) => dua.id === id);
}

export function getDuasByCategory(slug: string): Dua[] {
  return DUAS.filter((dua) => dua.categorySlug === slug);
}

export function getCategoryBySlug(slug: string): DuaCategory | undefined {
  return DUA_CATEGORIES.find((category) => category.slug === slug);
}

export function getRandomDua(categorySlug?: string): Dua | undefined {
  const candidates = categorySlug ? getDuasByCategory(categorySlug) : DUAS;
  if (candidates.length === 0) return undefined;
  return candidates[Math.floor(Math.random() * candidates.length)];
}
