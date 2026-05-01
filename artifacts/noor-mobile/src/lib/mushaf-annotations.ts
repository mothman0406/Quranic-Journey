import AsyncStorage from "@react-native-async-storage/async-storage";
import { TOTAL_MUSHAF_PAGES } from "@/src/lib/mushaf";

export type MushafHighlightColor = "yellow" | "green" | "blue" | "pink";

export type MushafAyahTarget = {
  verseKey: string;
  surahNumber: number;
  ayahNumber: number;
  pageNumber: number;
  textUthmani: string;
};

export type MushafAyahAnnotationRecord = MushafAyahTarget & {
  savedAt: number;
};

export type MushafAyahHighlightRecord = MushafAyahAnnotationRecord & {
  color: MushafHighlightColor;
};

export type MushafAyahNoteRecord = MushafAyahAnnotationRecord & {
  text: string;
  updatedAt: number;
};

export type MushafAnnotations = {
  bookmarks: Record<string, MushafAyahAnnotationRecord>;
  highlights: Record<string, MushafAyahHighlightRecord>;
  notes: Record<string, MushafAyahNoteRecord>;
};

export function mushafAnnotationStorageKey(childId: string | undefined) {
  return `noorpath:mushaf:annotations:${childId ?? "unknown"}`;
}

export function emptyMushafAnnotations(): MushafAnnotations {
  return { bookmarks: {}, highlights: {}, notes: {} };
}

function parseVerseKey(verseKey: string) {
  const [surahRaw, ayahRaw] = verseKey.split(":");
  const surahNumber = Number(surahRaw);
  const ayahNumber = Number(ayahRaw);
  if (!Number.isInteger(surahNumber) || !Number.isInteger(ayahNumber)) return null;
  return { surahNumber, ayahNumber };
}

function isMushafHighlightColor(value: unknown): value is MushafHighlightColor {
  return value === "yellow" || value === "green" || value === "blue" || value === "pink";
}

function normalizeAnnotationRecord(value: unknown): MushafAyahAnnotationRecord | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const verseKey = typeof record.verseKey === "string" ? record.verseKey : "";
  const parsed = parseVerseKey(verseKey);
  const pageNumber = Number(record.pageNumber);
  const textUthmani = typeof record.textUthmani === "string" ? record.textUthmani : "";
  const savedAt = Number(record.savedAt);

  if (
    !parsed ||
    !Number.isInteger(pageNumber) ||
    pageNumber < 1 ||
    pageNumber > TOTAL_MUSHAF_PAGES ||
    !textUthmani
  ) {
    return null;
  }

  return {
    verseKey,
    surahNumber: parsed.surahNumber,
    ayahNumber: parsed.ayahNumber,
    pageNumber,
    textUthmani,
    savedAt: Number.isFinite(savedAt) ? savedAt : Date.now(),
  };
}

export function normalizeMushafAnnotations(raw: string | null): MushafAnnotations {
  if (!raw) return emptyMushafAnnotations();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return emptyMushafAnnotations();
    const record = parsed as Record<string, unknown>;
    const bookmarks: MushafAnnotations["bookmarks"] = {};
    const highlights: MushafAnnotations["highlights"] = {};
    const notes: MushafAnnotations["notes"] = {};

    for (const [verseKey, value] of Object.entries((record.bookmarks as Record<string, unknown>) ?? {})) {
      const normalized = normalizeAnnotationRecord({ ...(value as object), verseKey });
      if (normalized) bookmarks[normalized.verseKey] = normalized;
    }

    for (const [verseKey, value] of Object.entries((record.highlights as Record<string, unknown>) ?? {})) {
      const normalized = normalizeAnnotationRecord({ ...(value as object), verseKey });
      const color = value && typeof value === "object" ? (value as Record<string, unknown>).color : null;
      if (normalized && isMushafHighlightColor(color)) {
        highlights[normalized.verseKey] = { ...normalized, color };
      }
    }

    for (const [verseKey, value] of Object.entries((record.notes as Record<string, unknown>) ?? {})) {
      const normalized = normalizeAnnotationRecord({ ...(value as object), verseKey });
      const noteText = value && typeof value === "object" ? (value as Record<string, unknown>).text : null;
      const updatedAt =
        value && typeof value === "object"
          ? Number((value as Record<string, unknown>).updatedAt)
          : Date.now();
      if (normalized && typeof noteText === "string" && noteText.trim()) {
        notes[normalized.verseKey] = {
          ...normalized,
          text: noteText,
          updatedAt: Number.isFinite(updatedAt) ? updatedAt : normalized.savedAt,
        };
      }
    }

    return { bookmarks, highlights, notes };
  } catch {
    return emptyMushafAnnotations();
  }
}

export function mushafAnnotationRecordFromTarget(
  target: MushafAyahTarget,
): MushafAyahAnnotationRecord {
  return {
    ...target,
    savedAt: Date.now(),
  };
}

export async function loadMushafAnnotations(
  childId: string | undefined,
): Promise<MushafAnnotations> {
  const raw = await AsyncStorage.getItem(mushafAnnotationStorageKey(childId));
  return normalizeMushafAnnotations(raw);
}

export async function saveMushafAnnotations(
  childId: string | undefined,
  annotations: MushafAnnotations,
): Promise<void> {
  await AsyncStorage.setItem(mushafAnnotationStorageKey(childId), JSON.stringify(annotations));
}

export async function saveMushafAyahBookmark(
  childId: string | undefined,
  target: MushafAyahTarget,
): Promise<MushafAnnotations> {
  const annotations = await loadMushafAnnotations(childId);
  const next = {
    ...annotations,
    bookmarks: {
      ...annotations.bookmarks,
      [target.verseKey]: mushafAnnotationRecordFromTarget(target),
    },
  };
  await saveMushafAnnotations(childId, next);
  return next;
}
