import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { apiFetch } from "@/src/lib/api";
import { mushafPageUrl, TOTAL_MUSHAF_PAGES } from "@/src/lib/mushaf";

const PAGE_ASPECT_RATIO = 1.45;

type DashboardResponse = {
  readingGoal: {
    lastPage: number | null;
    status: string;
    completedPages: number;
    targetPages: number;
    isEnabled: boolean;
  } | null;
};

function PageView({ pageNumber, width }: { pageNumber: number; width: number }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const height = width * PAGE_ASPECT_RATIO;

  return (
    <View style={[styles.pageWrap, { width }]}>
      <View style={[styles.pageCard, { width: width - 32, height: height - 80 }]}>
        {!loaded && !error && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color="#2563eb" />
            <Text style={styles.loadingText}>page {pageNumber}</Text>
          </View>
        )}
        {error && (
          <View style={styles.errorOverlay}>
            <Text style={styles.errorTitle}>Failed</Text>
            <Text style={styles.errorBody}>{error}</Text>
          </View>
        )}
        <Image
          source={{ uri: mushafPageUrl(pageNumber) }}
          style={styles.pageImage}
          resizeMode="contain"
          onLoad={() => setLoaded(true)}
          onError={(e) => setError(e.nativeEvent.error ?? "unknown error")}
        />
      </View>
      <Text style={styles.pageNumberLabel}>
        {pageNumber} / {TOTAL_MUSHAF_PAGES}
      </Text>
    </View>
  );
}

export default function MushafScreen() {
  const { childId } = useLocalSearchParams<{ childId: string; name: string }>();
  const router = useRouter();
  const screenW = Dimensions.get("window").width;

  const [initialPage, setInitialPage] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  const listRef = useRef<FlatList<number>>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const data = Array.from({ length: TOTAL_MUSHAF_PAGES }, (_, i) => i + 1);

  useEffect(() => {
    async function loadInitialPage() {
      try {
        const dashboard = await apiFetch<DashboardResponse>(
          `/api/children/${childId}/dashboard`
        );
        const goal = dashboard.readingGoal;
        if (goal?.isEnabled && goal.lastPage != null && goal.lastPage >= 1) {
          setCurrentPage(goal.lastPage);
          setInitialPage(goal.lastPage);
        } else {
          setInitialPage(1);
        }
      } catch {
        setInitialPage(1);
      }
    }
    loadInitialPage();
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [childId]);

  const goToPage = (page: number) => {
    setCurrentPage(page);
    listRef.current?.scrollToIndex({ index: page - 1, animated: false });
  };

  async function savePage(page: number) {
    setSaveStatus("saving");
    setSaveError(null);
    try {
      await apiFetch(`/api/children/${childId}/reading-progress`, {
        method: "POST",
        body: JSON.stringify({ currentPage: page }),
      });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 1500);
    } catch (e) {
      setSaveStatus("error");
      setSaveError(e instanceof Error ? e.message : "Save failed");
    }
  }

  function scheduleAutoSave(page: number) {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      savePage(page);
    }, 2000);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerLeft}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>
          {currentPage} / {TOTAL_MUSHAF_PAGES}
        </Text>
        <Pressable
          style={styles.headerRight}
          onPress={() => savePage(currentPage)}
          disabled={saveStatus === "saving"}
        >
          <Text
            style={[
              styles.saveText,
              saveStatus === "saving" && styles.saveTextMuted,
              saveStatus === "saved" && styles.saveTextConfirm,
            ]}
          >
            {saveStatus === "saving"
              ? "Saving…"
              : saveStatus === "saved"
              ? "Saved ✓"
              : "Save Page"}
          </Text>
        </Pressable>
      </View>

      {saveStatus === "error" && saveError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{saveError}</Text>
        </View>
      )}

      {initialPage === null ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={data}
          keyExtractor={(n) => String(n)}
          horizontal
          pagingEnabled
          inverted
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialPage - 1}
          getItemLayout={(_, index) => ({
            length: screenW,
            offset: screenW * index,
            index,
          })}
          windowSize={3}
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / screenW);
            const page = idx + 1;
            setCurrentPage(page);
            scheduleAutoSave(page);
          }}
          renderItem={({ item }) => <PageView pageNumber={item} width={screenW} />}
        />
      )}

      <View style={styles.footer}>
        <Pressable style={styles.jumpButton} onPress={() => goToPage(1)}>
          <Text style={styles.jumpButtonText}>Page 1</Text>
        </Pressable>
        <Pressable style={styles.jumpButton} onPress={() => goToPage(50)}>
          <Text style={styles.jumpButtonText}>Page 50</Text>
        </Pressable>
        <Pressable style={styles.jumpButton} onPress={() => goToPage(300)}>
          <Text style={styles.jumpButtonText}>Page 300</Text>
        </Pressable>
        <Pressable style={styles.jumpButton} onPress={() => goToPage(604)}>
          <Text style={styles.jumpButtonText}>Page 604</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 20,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  headerLeft: {
    width: 80,
  },
  backText: {
    fontSize: 16,
    color: "#2563eb",
    fontWeight: "500",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "600",
    color: "#111111",
  },
  headerRight: {
    width: 80,
    alignItems: "flex-end",
  },
  saveText: {
    fontSize: 14,
    color: "#2563eb",
    fontWeight: "500",
  },
  saveTextMuted: {
    color: "#999999",
  },
  saveTextConfirm: {
    color: "#16a34a",
  },
  errorBanner: {
    backgroundColor: "#fef2f2",
    borderBottomWidth: 1,
    borderBottomColor: "#fecaca",
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  errorBannerText: {
    color: "#dc2626",
    fontSize: 13,
    textAlign: "center",
  },
  loadingCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  pageWrap: {
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  pageCard: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  pageImage: {
    width: "100%",
    height: "100%",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  loadingText: {
    fontSize: 11,
    color: "#666666",
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#fef2f2",
  },
  errorTitle: {
    fontSize: 14,
    color: "#dc2626",
    fontWeight: "600",
    marginBottom: 4,
  },
  errorBody: {
    fontSize: 11,
    color: "#dc2626",
    textAlign: "center",
  },
  pageNumberLabel: {
    fontSize: 11,
    color: "#666666",
    marginTop: 6,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#f9fafb",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  jumpButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  jumpButtonText: {
    fontSize: 12,
    color: "#2563eb",
    fontWeight: "500",
  },
});
