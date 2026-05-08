import { useCallback, useMemo, useState, type ReactNode } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import {
  NotesBookmarksRow,
  type NotesBookmarksEntry,
} from "@/src/components/notes-bookmarks-panel";
import {
  emptyMushafAnnotations,
  listMushafBookmarks,
  listMushafNotes,
  loadStandaloneMushafAnnotations,
  type MushafAnnotations,
  type MushafBookmarkEntry,
  type MushafNoteEntry,
} from "@/src/lib/mushaf-annotations";
import {
  ScreenContainer,
  ScreenHeader,
  ScreenScrollView,
  SectionLabel,
} from "@/src/components/screen-primitives";
import { useAppTheme, type AppThemeColors } from "@/src/lib/app-theme";

export default function StandaloneNotesBookmarksScreen() {
  const router = useRouter();
  const [annotations, setAnnotations] = useState<MushafAnnotations>(() => emptyMushafAnnotations());

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadStandaloneMushafAnnotations()
        .then((loadedAnnotations) => {
          if (!cancelled) setAnnotations(loadedAnnotations);
        })
        .catch(() => {
          if (!cancelled) setAnnotations(emptyMushafAnnotations());
        });

      return () => {
        cancelled = true;
      };
    }, []),
  );

  const bookmarks = listMushafBookmarks(annotations);
  const notes = listMushafNotes(annotations);
  const totalCount = bookmarks.length + notes.length;

  function openEntry(entry: NotesBookmarksEntry) {
    router.push({
      pathname: "/mushaf",
      params: { page: String(entry.pageNumber) },
    });
  }

  return (
    <ScreenContainer>
      <ScreenHeader title="Notes & Bookmarks" onBack={() => router.back()} />
      <ScreenScrollView>
        {totalCount === 0 ? (
          <EmptyNotesBookmarksState />
        ) : (
          <>
            {bookmarks.length > 0 ? (
              <AnnotationSection title="Bookmarks">
                <FlatList
                  data={bookmarks}
                  keyExtractor={(item) => item.verseKey}
                  renderItem={({ item }: { item: MushafBookmarkEntry }) => (
                    <NotesBookmarksRow
                      entry={item}
                      kind="bookmark"
                      onPress={() => openEntry(item)}
                    />
                  )}
                  scrollEnabled={false}
                />
              </AnnotationSection>
            ) : null}

            {notes.length > 0 ? (
              <AnnotationSection title="Notes">
                <FlatList
                  data={notes}
                  keyExtractor={(item) => item.verseKey}
                  renderItem={({ item }: { item: MushafNoteEntry }) => (
                    <NotesBookmarksRow
                      entry={item}
                      kind="note"
                      noteNumberOfLines={3}
                      notePreviewMode="full"
                      onPress={() => openEntry(item)}
                    />
                  )}
                  scrollEnabled={false}
                />
              </AnnotationSection>
            ) : null}
          </>
        )}
      </ScreenScrollView>
    </ScreenContainer>
  );
}

function AnnotationSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.section}>
      <SectionLabel>{title}</SectionLabel>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function EmptyNotesBookmarksState() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>No bookmarks or notes yet</Text>
      <Text style={styles.emptyText}>Save some while reading.</Text>
    </View>
  );
}

function makeStyles(colors: AppThemeColors) {
  return StyleSheet.create({
  section: {
    gap: 8,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  emptyCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 30,
    paddingHorizontal: 18,
    alignItems: "center",
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
    textAlign: "center",
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    marginTop: 6,
    textAlign: "center",
  },
  });
}
