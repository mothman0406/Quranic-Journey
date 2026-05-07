import { useCallback, useMemo, useState } from "react";
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from "expo-router";
import { ChildBottomNav } from "@/src/components/child-bottom-nav";
import {
  BadgePill,
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
  fetchDuaCategories,
  type ChildDuaProgressEntry,
  type DuaCategory,
} from "@/src/lib/duas";

type DuasState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      categories: DuaCategory[];
      progress: ChildDuaProgressEntry[];
    };

function isValidChildId(childId: string | undefined): childId is string {
  return typeof childId === "string" && /^\d+$/.test(childId);
}

function describeError(error: unknown) {
  return error instanceof Error ? error.message : "Du'aas could not load.";
}

export default function DuaCategoriesScreen() {
  const { childId, name } = useLocalSearchParams<{ childId: string; name?: string }>();
  const router = useRouter();
  const [state, setState] = useState<DuasState>({ status: "loading" });

  const load = useCallback(async () => {
    if (!isValidChildId(childId)) {
      setState({ status: "error", message: "This Du'aas route is missing a valid child id." });
      return;
    }

    setState((current) => current.status === "ready" ? current : { status: "loading" });
    try {
      const [categories, progress] = await Promise.all([
        fetchDuaCategories(),
        fetchChildDuas(childId),
      ]);
      setState({ status: "ready", categories, progress });
    } catch (error) {
      setState({ status: "error", message: describeError(error) });
    }
  }, [childId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const learnedByCategory = useMemo(() => {
    const counts = new Map<string, number>();
    if (state.status !== "ready") return counts;
    for (const entry of state.progress) {
      if (!entry.learned) continue;
      counts.set(entry.dua.categorySlug, (counts.get(entry.dua.categorySlug) ?? 0) + 1);
    }
    return counts;
  }, [state]);

  function openCategory(category: DuaCategory) {
    if (!isValidChildId(childId)) return;
    router.push({
      pathname: "/child/[childId]/duas/[categorySlug]",
      params: { childId, categorySlug: category.slug, name: name ?? "" },
    } as unknown as Href);
  }

  return (
    <ScreenContainer>
      <ScreenHeader title="Du'aas" onBack={() => router.back()} />

      {state.status === "loading" ? (
        <LoadingState label="Loading du'aas" />
      ) : state.status === "error" ? (
        <ErrorState message={state.message} onRetry={load} />
      ) : (
        <ScreenScrollView>
          <CardGroup>
            {state.categories.map((category) => {
              const learnedCount = learnedByCategory.get(category.slug) ?? 0;
              return (
                <ListRow
                  key={category.slug}
                  title={category.nameEnglish}
                  detail={`${learnedCount} of ${category.duaCount} learned`}
                  iconName="heart-outline"
                  iconColor="#0891b2"
                  trailing={<BadgePill label={String(category.duaCount)} />}
                  onPress={() => openCategory(category)}
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
