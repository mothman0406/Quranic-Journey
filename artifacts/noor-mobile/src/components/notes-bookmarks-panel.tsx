import type { ComponentProps, ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MUSHAF_SURAHS } from "@/src/lib/mushaf";
import {
  listMushafBookmarks,
  listMushafNotes,
  type MushafAnnotations,
  type MushafBookmarkEntry,
  type MushafNoteEntry,
} from "@/src/lib/mushaf-annotations";

type IconName = ComponentProps<typeof Ionicons>["name"];

export type NotesBookmarksEntry = MushafBookmarkEntry | MushafNoteEntry;
export type NotesBookmarksEntryKind = "bookmark" | "note";

type NotesBookmarksPanelProps = {
  annotations: MushafAnnotations;
  onPressEntry: (entry: NotesBookmarksEntry) => void;
  onViewAll: () => void;
  emptyLabel?: string;
};

const PREVIEW_LIMIT = 3;
const NOTE_PREVIEW_LIMIT = 80;
const DEFAULT_EMPTY_LABEL = "No bookmarks or notes yet. Save some while reading.";

function getSurahName(entry: NotesBookmarksEntry) {
  return MUSHAF_SURAHS[entry.surahNumber - 1]?.name ?? `Surah ${entry.surahNumber}`;
}

function truncateText(value: string, maxChars: number) {
  const chars = Array.from(value);
  if (chars.length <= maxChars) return value;
  return `${chars.slice(0, Math.max(0, maxChars - 3)).join("")}...`;
}

export function formatMushafNotePreview(text: string, maxChars = NOTE_PREVIEW_LIMIT) {
  const normalized = text.trim().replace(/\r?\n/g, " ").replace(/\s+/g, " ");
  return truncateText(normalized, maxChars);
}

export function NotesBookmarksRow({
  entry,
  kind,
  onPress,
  noteNumberOfLines = 1,
  notePreviewMode = "panel",
}: {
  entry: NotesBookmarksEntry;
  kind: NotesBookmarksEntryKind;
  onPress: () => void;
  noteNumberOfLines?: number;
  notePreviewMode?: "panel" | "full";
}) {
  const isNote = kind === "note" && "text" in entry;
  const title = `${getSurahName(entry)} · ${entry.verseKey}`;
  const iconName: IconName = kind === "bookmark" ? "bookmark" : "document-text-outline";
  const iconColor = kind === "bookmark" ? "#b45309" : "#2563eb";
  const noteText = isNote
    ? notePreviewMode === "panel"
      ? formatMushafNotePreview(entry.text)
      : entry.text.trim()
    : null;

  return (
    <Pressable
      accessibilityRole="button"
      style={styles.row}
      onPress={onPress}
    >
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1} ellipsizeMode="tail">
          {title}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1} ellipsizeMode="tail">
          Page {entry.pageNumber}
        </Text>
        {noteText ? (
          <Text
            style={styles.notePreview}
            numberOfLines={noteNumberOfLines}
            ellipsizeMode="tail"
          >
            {noteText}
          </Text>
        ) : null}
      </View>
      <View style={[styles.rowIcon, { backgroundColor: `${iconColor}14` }]}>
        <Ionicons name={iconName} size={19} color={iconColor} />
      </View>
    </Pressable>
  );
}

function PanelSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title}</Text>
      <View style={styles.sectionRows}>{children}</View>
    </View>
  );
}

export function NotesBookmarksPanel({
  annotations,
  onPressEntry,
  onViewAll,
  emptyLabel = DEFAULT_EMPTY_LABEL,
}: NotesBookmarksPanelProps) {
  const bookmarks = listMushafBookmarks(annotations);
  const notes = listMushafNotes(annotations);
  const totalCount = bookmarks.length + notes.length;
  const hasOverflow = bookmarks.length > PREVIEW_LIMIT || notes.length > PREVIEW_LIMIT;

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>Reading Mushaf</Text>
          <Text style={styles.title}>Notes & Bookmarks</Text>
        </View>
        <View style={styles.countPill}>
          <Text style={styles.countText}>{totalCount}</Text>
        </View>
      </View>

      {totalCount === 0 ? (
        <Text style={styles.emptyText}>{emptyLabel}</Text>
      ) : (
        <View style={styles.sections}>
          {bookmarks.length > 0 ? (
            <PanelSection title="Bookmarks">
              {bookmarks.slice(0, PREVIEW_LIMIT).map((bookmark) => (
                <NotesBookmarksRow
                  key={`bookmark-${bookmark.verseKey}`}
                  entry={bookmark}
                  kind="bookmark"
                  onPress={() => onPressEntry(bookmark)}
                />
              ))}
            </PanelSection>
          ) : null}

          {notes.length > 0 ? (
            <PanelSection title="Notes">
              {notes.slice(0, PREVIEW_LIMIT).map((note) => (
                <NotesBookmarksRow
                  key={`note-${note.verseKey}`}
                  entry={note}
                  kind="note"
                  onPress={() => onPressEntry(note)}
                />
              ))}
            </PanelSection>
          ) : null}
        </View>
      )}

      {hasOverflow ? (
        <Pressable
          accessibilityRole="button"
          style={styles.footer}
          onPress={onViewAll}
        >
          <Text style={styles.footerText}>View all ({totalCount})</Text>
          <Ionicons name="arrow-forward" size={16} color="#2563eb" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    gap: 12,
    shadowColor: "#0f172a",
    shadowOpacity: 0.035,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  kicker: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  title: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "900",
    marginTop: 2,
  },
  countPill: {
    minWidth: 32,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#f0fdfa",
    borderWidth: 1,
    borderColor: "#99f6e4",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 9,
  },
  countText: {
    color: "#0f766e",
    fontSize: 12,
    fontWeight: "900",
  },
  emptyText: {
    color: "#64748b",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  sections: {
    gap: 12,
  },
  section: {
    gap: 7,
  },
  sectionLabel: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  sectionRows: {
    borderWidth: 1,
    borderColor: "#f1f5f9",
    borderRadius: 10,
    overflow: "hidden",
  },
  row: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    backgroundColor: "#ffffff",
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "900",
  },
  rowMeta: {
    color: "#0f766e",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
  },
  notePreview: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
    marginTop: 3,
  },
  footer: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 2,
  },
  footerText: {
    color: "#2563eb",
    fontSize: 13,
    fontWeight: "900",
  },
});
