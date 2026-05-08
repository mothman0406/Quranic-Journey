import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
  type Href,
} from "expo-router";
import { ChildBottomNav } from "@/src/components/child-bottom-nav";
import {
  CardGroup,
  ErrorState,
  ListRow,
  LoadingState,
  ScreenContainer,
  ScreenHeader,
  ScreenScrollView,
} from "@/src/components/screen-primitives";
import {
  fetchChildDuas,
  fetchDuaCategory,
  type ChildDuaProgressEntry,
  type Dua,
  type DuaCategory,
} from "@/src/lib/duas";
import { useAppTheme } from "@/src/lib/app-theme";

type DuaCategoryState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      category: DuaCategory;
      duas: Dua[];
      progress: ChildDuaProgressEntry[];
    };

function isValidChildId(childId: string | undefined): childId is string {
  return typeof childId === "string" && /^\d+$/.test(childId);
}

function isValidSlug(slug: string | undefined): slug is string {
  return typeof slug === "string" && slug.trim().length > 0;
}

function describeError(error: unknown) {
  return error instanceof Error ? error.message : "This du'aa category could not load.";
}

function LearnedTrailing({ learned }: { learned: boolean }) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.trailing}>
      <Ionicons
        name={learned ? "checkmark-circle" : "bookmark-outline"}
        size={19}
        color={learned ? colors.success : colors.textSubtle}
      />
      <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
    </View>
  );
}

export default function DuaCategoryScreen() {
  const { childId, categorySlug, name } = useLocalSearchParams<{
    childId: string;
    categorySlug: string;
    name?: string;
  }>();
  const router = useRouter();
  const [state, setState] = useState<DuaCategoryState>({ status: "loading" });

  const load = useCallback(async () => {
    if (!isValidChildId(childId) || !isValidSlug(categorySlug)) {
      setState({ status: "error", message: "This du'aa category route is incomplete." });
      return;
    }

    setState((current) => current.status === "ready" ? current : { status: "loading" });
    try {
      const [categoryData, progress] = await Promise.all([
        fetchDuaCategory(categorySlug),
        fetchChildDuas(childId),
      ]);
      setState({
        status: "ready",
        category: categoryData.category,
        duas: [...categoryData.duas].sort((a, b) => a.orderInCategory - b.orderInCategory),
        progress,
      });
    } catch (error) {
      setState({ status: "error", message: describeError(error) });
    }
  }, [categorySlug, childId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const progressByDuaId = useMemo(() => {
    const progress = new Map<number, ChildDuaProgressEntry>();
    if (state.status !== "ready") return progress;
    for (const entry of state.progress) {
      progress.set(entry.dua.id, entry);
    }
    return progress;
  }, [state]);

  function openDua(dua: Dua) {
    if (!isValidChildId(childId)) return;
    router.push({
      pathname: "/child/[childId]/duas/dua/[duaId]",
      params: { childId, duaId: String(dua.id), name: name ?? "" },
    } as unknown as Href);
  }

  const title = state.status === "ready" ? state.category.nameEnglish : "Du'aas";

  return (
    <ScreenContainer>
      <ScreenHeader title={title} onBack={() => router.back()} />

      {state.status === "loading" ? (
        <LoadingState label="Loading category" />
      ) : state.status === "error" ? (
        <ErrorState message={state.message} onRetry={load} />
      ) : (
        <ScreenScrollView>
          <CardGroup>
            {state.duas.map((dua) => {
              const learned = progressByDuaId.get(dua.id)?.learned ?? false;
              return (
                <ListRow
                  key={dua.id}
                  title={dua.title}
                  detail={dua.arabic}
                  iconName="heart-outline"
                  iconColor="#0891b2"
                  detailNumberOfLines={1}
                  detailTextStyle={styles.arabicPreview}
                  trailing={<LearnedTrailing learned={learned} />}
                  onPress={() => openDua(dua)}
                />
              );
            })}
          </CardGroup>
        </ScreenScrollView>
      )}

      <ChildBottomNav active="more" childId={childId} name={name ?? ""} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  arabicPreview: {
    fontFamily: "AmiriQuran",
    fontSize: 15,
    lineHeight: 23,
    textAlign: "right",
    writingDirection: "rtl",
  },
  trailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
});
