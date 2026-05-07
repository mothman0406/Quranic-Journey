import { useCallback, useState, type ReactNode } from "react";
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
  return (
    <View style={styles.section}>
      <SectionLabel>{title}</SectionLabel>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function EmptyNotesBookmarksState() {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>No bookmarks or notes yet</Text>
      <Text style={styles.emptyText}>Save some while reading.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 8,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    overflow: "hidden",
  },
  emptyCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    paddingVertical: 30,
    paddingHorizontal: 18,
    alignItems: "center",
  },
  emptyTitle: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "900",
    textAlign: "center",
  },
  emptyText: {
    color: "#64748b",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    marginTop: 6,
    textAlign: "center",
  },
});
