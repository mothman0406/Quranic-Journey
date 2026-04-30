import { useEffect, useMemo, useState, type ComponentProps } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type GestureResponderEvent,
} from "react-native";
import { Redirect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { authClient } from "@/src/lib/auth-client";
import { apiFetch } from "@/src/lib/api";

type IconName = ComponentProps<typeof Ionicons>["name"];

type AgeGroup = "toddler" | "child" | "preteen" | "teen" | "adult";
type RoleFilter = "toddler" | "child" | "teen" | "adult";
type SortKey = "alpha" | "newest" | "age" | "active";

type Child = {
  id: number;
  name: string;
  age?: number;
  ageGroup: AgeGroup | string;
  role?: AgeGroup | string;
  avatarEmoji: string;
  streakDays?: number;
  totalPoints?: number;
  createdAt?: string;
  lastActiveDate?: string | null;
};

type ChildrenResponse = { children: Child[] };

type DailyProgressDay = {
  date: string;
  memStatus?: string | null;
  memCompletedAyahEnd?: number | null;
  reviewStatus?: string | null;
  reviewCompletedCount?: number | null;
  readingStatus?: string | null;
  readingCompletedPages?: number | null;
  readingLastPage?: number | null;
};

type WeeklyProgressResponse = { days: DailyProgressDay[] };

type ChildRoute =
  | "/child/[childId]"
  | "/child/[childId]/profile"
  | "/child/[childId]/targets";

const AGE_LABELS: Record<string, string> = {
  toddler: "Toddler",
  child: "Child",
  preteen: "Preteen",
  teen: "Teen",
  adult: "Adult",
};

const ROLE_FILTERS: Array<{ key: RoleFilter; label: string }> = [
  { key: "toddler", label: "Toddler" },
  { key: "child", label: "Child" },
  { key: "teen", label: "Teen" },
  { key: "adult", label: "Adult" },
];

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: "alpha", label: "Alphabetical" },
  { key: "newest", label: "Newest first" },
  { key: "age", label: "Age" },
  { key: "active", label: "Most active" },
];

function formatDayStreak(days: number) {
  return `${days} day${days === 1 ? "" : "s"} streak`;
}

function formatAge(age: number | undefined) {
  if (typeof age !== "number" || !Number.isFinite(age)) return "Age not set";
  return `${age} yr${age === 1 ? "" : "s"}`;
}

function getLocalDateValue() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeRoleValue(child: Child): RoleFilter {
  const source = String(child.role ?? child.ageGroup ?? "").toLowerCase();
  if (source === "toddler") return "toddler";
  if (source === "teen" || source === "preteen") return "teen";
  if (source === "adult") return "adult";
  return "child";
}

function getRoleLabel(child: Child) {
  const source = String(child.role ?? child.ageGroup ?? "child").toLowerCase();
  return AGE_LABELS[source] ?? "Child";
}

function hasProgressRecordedToday(day: DailyProgressDay, today: string) {
  if (day.date !== today) return false;

  return (
    (day.memStatus != null && day.memStatus !== "not_started") ||
    (day.memCompletedAyahEnd ?? 0) > 0 ||
    (day.reviewStatus != null && day.reviewStatus !== "not_started") ||
    (day.reviewCompletedCount ?? 0) > 0 ||
    (day.readingStatus != null && day.readingStatus !== "not_started") ||
    (day.readingCompletedPages ?? 0) > 0 ||
    (day.readingLastPage ?? 0) > 0
  );
}

function childCreatedTime(child: Child) {
  const parsed = child.createdAt ? Date.parse(child.createdAt) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : child.id;
}

function compareByName(a: Child, b: Child) {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

function getParentInitial(user: { name?: string | null; email?: string | null } | undefined) {
  const source = user?.name?.trim() || user?.email?.trim() || "P";
  return source.charAt(0).toUpperCase();
}

export default function HomeScreen() {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const router = useRouter();
  const [children, setChildren] = useState<Child[] | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("alpha");
  const [selectedRoleFilters, setSelectedRoleFilters] = useState<Set<RoleFilter>>(
    () => new Set(),
  );
  const [activeOnly, setActiveOnly] = useState(false);
  const [activeTodayIds, setActiveTodayIds] = useState<Set<number>>(() => new Set());
  const [activityLoading, setActivityLoading] = useState(false);
  const [parentMenuOpen, setParentMenuOpen] = useState(false);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);

  const user = session?.user;
  const sortStorageKey = useMemo(() => {
    const accountKey = user?.id ?? user?.email;
    return accountKey ? `noorpath:profile-picker-sort:${accountKey}` : null;
  }, [user?.email, user?.id]);

  async function loadChildren() {
    setFetchError(null);
    try {
      const data = await apiFetch<ChildrenResponse>("/api/children");
      setChildren(data.children);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Failed to load children.");
    }
  }

  useEffect(() => {
    if (session?.user) {
      loadChildren();
    }
  }, [session?.user]);

  useEffect(() => {
    if (!sortStorageKey) return;

    let cancelled = false;
    AsyncStorage.getItem(sortStorageKey)
      .then((value) => {
        if (cancelled) return;
        if (SORT_OPTIONS.some((option) => option.key === value)) {
          setSortKey(value as SortKey);
        }
      })
      .catch(() => {
        // Best-effort preference hydration.
      });

    return () => {
      cancelled = true;
    };
  }, [sortStorageKey]);

  useEffect(() => {
    if (!children) return;

    const today = getLocalDateValue();
    const fallbackActive = new Set(
      children
        .filter((child) => child.lastActiveDate === today)
        .map((child) => child.id),
    );
    setActiveTodayIds(fallbackActive);

    if (children.length === 0) {
      setActivityLoading(false);
      return;
    }

    let cancelled = false;
    setActivityLoading(true);

    Promise.all(
      children.map(async (child) => {
        try {
          const progress = await apiFetch<WeeklyProgressResponse>(
            `/api/children/${child.id}/weekly-progress`,
          );
          return [
            child.id,
            progress.days.some((day) => hasProgressRecordedToday(day, today)) ||
              child.lastActiveDate === today,
          ] as const;
        } catch {
          return [child.id, child.lastActiveDate === today] as const;
        }
      }),
    )
      .then((results) => {
        if (cancelled) return;
        setActiveTodayIds(
          new Set(
            results
              .filter(([, isActive]) => isActive)
              .map(([childId]) => childId),
          ),
        );
      })
      .finally(() => {
        if (!cancelled) setActivityLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [children]);

  function openCreateProfile() {
    router.push("/profile/new");
  }

  function openChildRoute(child: Child, pathname: ChildRoute, extras?: Record<string, string>) {
    setSelectedChild(null);
    router.push({
      pathname,
      params: {
        childId: String(child.id),
        name: child.name,
        ...extras,
      },
    });
  }

  function openAccountSettings() {
    setParentMenuOpen(false);
    router.push("/account-settings");
  }

  async function signOut() {
    setParentMenuOpen(false);
    await authClient.signOut();
  }

  function chooseSort(nextSortKey: SortKey) {
    setSortKey(nextSortKey);
    if (sortStorageKey) {
      AsyncStorage.setItem(sortStorageKey, nextSortKey).catch(() => {
        // Best-effort preference persistence.
      });
    }
  }

  function toggleRoleFilter(role: RoleFilter) {
    setSelectedRoleFilters((current) => {
      const next = new Set(current);
      if (next.has(role)) {
        next.delete(role);
      } else {
        next.add(role);
      }
      return next;
    });
  }

  function openChildActions(child: Child, event?: GestureResponderEvent) {
    event?.stopPropagation();
    setSelectedChild(child);
  }

  function navigateToChild(child: Child) {
    openChildRoute(child, "/child/[childId]");
  }

  const filteredChildren = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const selectedRoles = selectedRoleFilters;

    return [...(children ?? [])]
      .filter((child) =>
        normalizedSearch.length === 0
          ? true
          : child.name.toLowerCase().includes(normalizedSearch),
      )
      .filter((child) =>
        selectedRoles.size === 0 ? true : selectedRoles.has(normalizeRoleValue(child)),
      )
      .filter((child) => (activeOnly ? activeTodayIds.has(child.id) : true))
      .sort((a, b) => {
        if (sortKey === "newest") {
          return childCreatedTime(b) - childCreatedTime(a) || compareByName(a, b);
        }

        if (sortKey === "age") {
          const ageA = typeof a.age === "number" ? a.age : Number.MAX_SAFE_INTEGER;
          const ageB = typeof b.age === "number" ? b.age : Number.MAX_SAFE_INTEGER;
          return ageA - ageB || compareByName(a, b);
        }

        if (sortKey === "active") {
          return (
            (b.streakDays ?? 0) - (a.streakDays ?? 0) ||
            (b.totalPoints ?? 0) - (a.totalPoints ?? 0) ||
            compareByName(a, b)
          );
        }

        return compareByName(a, b);
      });
  }, [activeOnly, activeTodayIds, children, searchQuery, selectedRoleFilters, sortKey]);

  const recentlyActiveChildren = useMemo(
    () => (children ?? []).filter((child) => activeTodayIds.has(child.id)).slice(0, 3),
    [activeTodayIds, children],
  );

  if (sessionPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!session?.user) {
    return <Redirect href="/sign-in" />;
  }

  const loadedChildren = children ?? [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>NoorPath</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open parent menu"
          style={styles.parentAvatarButton}
          onPress={() => setParentMenuOpen(true)}
        >
          <Text style={styles.parentAvatarText}>{getParentInitial(user)}</Text>
        </Pressable>
      </View>

      {children === null && !fetchError ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : fetchError ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{fetchError}</Text>
          <Pressable style={styles.retryButton} onPress={loadChildren}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : loadedChildren.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Ionicons name="person-add-outline" size={24} color="#2563eb" />
          </View>
          <Text style={styles.emptyTitle}>Add your first child</Text>
          <Text style={styles.emptyText}>
            Create a profile here, then choose any surahs they already know.
          </Text>
          <Pressable style={styles.primaryButton} onPress={openCreateProfile}>
            <Text style={styles.primaryButtonText}>Add Child</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.content}>
          <View style={styles.tools}>
            {recentlyActiveChildren.length > 0 ? (
              <View style={styles.activeStrip}>
                <View style={styles.activeStripHeader}>
                  <View style={styles.activeStripRule} />
                  <Text style={styles.activeStripLabel}>Active today</Text>
                  {activityLoading ? (
                    <ActivityIndicator size="small" color="#2563eb" />
                  ) : null}
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardDismissMode="on-drag"
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.activeStripList}
                >
                  {recentlyActiveChildren.map((child) => (
                    <Pressable
                      key={child.id}
                      style={styles.activeMiniProfile}
                      onPress={() => navigateToChild(child)}
                    >
                      <View style={styles.activeMiniAvatar}>
                        <Text style={styles.activeMiniEmoji}>{child.avatarEmoji}</Text>
                      </View>
                      <Text style={styles.activeMiniName} numberOfLines={1}>
                        {child.name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            <View style={styles.listHeader}>
              <Text style={styles.subtitle}>Profiles</Text>
              <Pressable style={styles.addButton} onPress={openCreateProfile}>
                <Ionicons name="add" size={17} color="#ffffff" />
                <Text style={styles.addButtonText}>Add</Text>
              </Pressable>
            </View>

            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={18} color="#64748b" />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search profiles"
                placeholderTextColor="#94a3b8"
                returnKeyType="done"
                blurOnSubmit
                onSubmitEditing={() => Keyboard.dismiss()}
                clearButtonMode="while-editing"
                style={styles.searchInput}
              />
              <Text style={styles.searchCount}>
                {filteredChildren.length} shown
              </Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.filterRow}
            >
              {ROLE_FILTERS.map((filter) => {
                const selected = selectedRoleFilters.has(filter.key);
                return (
                  <Pressable
                    key={filter.key}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => toggleRoleFilter(filter.key)}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {filter.label}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable
                style={[styles.chip, styles.activityChip, activeOnly && styles.chipSelected]}
                onPress={() => setActiveOnly((current) => !current)}
              >
                <Ionicons
                  name="flash-outline"
                  size={14}
                  color={activeOnly ? "#ffffff" : "#2563eb"}
                />
                <Text style={[styles.chipText, activeOnly && styles.chipTextSelected]}>
                  Active today
                </Text>
              </Pressable>
            </ScrollView>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.sortRow}
            >
              {SORT_OPTIONS.map((option) => {
                const selected = sortKey === option.key;
                return (
                  <Pressable
                    key={option.key}
                    style={[styles.sortSegment, selected && styles.sortSegmentSelected]}
                    onPress={() => chooseSort(option.key)}
                  >
                    <Text
                      style={[
                        styles.sortSegmentText,
                        selected && styles.sortSegmentTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <ScrollView
            style={styles.results}
            contentContainerStyle={styles.list}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
          >
            {filteredChildren.length === 0 ? (
              <View style={styles.noResults}>
                <Ionicons name="search-outline" size={22} color="#94a3b8" />
                <Text style={styles.noResultsTitle}>No matching profiles</Text>
                <Text style={styles.noResultsText}>
                  Try a different name, role, or activity filter.
                </Text>
              </View>
            ) : (
              filteredChildren.map((child) => (
                <Pressable
                  key={child.id}
                  style={styles.row}
                  onPress={() => navigateToChild(child)}
                >
                  <View style={styles.avatarBubble}>
                    <Text style={styles.avatar}>{child.avatarEmoji}</Text>
                  </View>
                  <View style={styles.childText}>
                    <View style={styles.childNameRow}>
                      <Text style={styles.childName} numberOfLines={1}>
                        {child.name}
                      </Text>
                      <Text style={styles.agePill}>{getRoleLabel(child)}</Text>
                    </View>
                    <Text style={styles.childMeta} numberOfLines={1}>
                      {formatAge(child.age)} | {formatDayStreak(child.streakDays ?? 0)} |{" "}
                      {child.totalPoints ?? 0} pts
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${child.name} profile actions`}
                    hitSlop={8}
                    style={styles.rowIconButton}
                    onPress={(event) => openChildActions(child, event)}
                  >
                    <Ionicons name="settings-outline" size={17} color="#64748b" />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${child.name} dashboard`}
                    hitSlop={8}
                    style={styles.chevronButton}
                    onPress={(event) => {
                      event.stopPropagation();
                      navigateToChild(child);
                    }}
                  >
                    <Ionicons name="chevron-forward" size={19} color="#94a3b8" />
                  </Pressable>
                </Pressable>
              ))
            )}
          </ScrollView>
        </View>
      )}

      <ParentMenuModal
        visible={parentMenuOpen}
        onClose={() => setParentMenuOpen(false)}
        onAccountSettings={openAccountSettings}
        onSignOut={signOut}
      />

      <ChildActionsSheet
        child={selectedChild}
        onClose={() => setSelectedChild(null)}
        onOpenProfile={(child) => openChildRoute(child, "/child/[childId]/profile")}
        onOpenTargets={(child) => openChildRoute(child, "/child/[childId]/targets")}
        onDeleteProfile={(child) =>
          openChildRoute(child, "/child/[childId]/profile", { intent: "delete" })
        }
      />
    </View>
  );
}

function ParentMenuModal({
  visible,
  onClose,
  onAccountSettings,
  onSignOut,
}: {
  visible: boolean;
  onClose: () => void;
  onAccountSettings: () => void;
  onSignOut: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.menuBackdrop} onPress={onClose}>
        <Pressable style={styles.parentMenu} onPress={(event) => event.stopPropagation()}>
          <MenuAction
            icon="person-circle-outline"
            label="Account settings"
            onPress={onAccountSettings}
          />
          <View style={styles.menuDivider} />
          <MenuAction
            icon="log-out-outline"
            label="Sign out"
            tone="#dc2626"
            onPress={onSignOut}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ChildActionsSheet({
  child,
  onClose,
  onOpenProfile,
  onOpenTargets,
  onDeleteProfile,
}: {
  child: Child | null;
  onClose: () => void;
  onOpenProfile: (child: Child) => void;
  onOpenTargets: (child: Child) => void;
  onDeleteProfile: (child: Child) => void;
}) {
  return (
    <Modal
      visible={child !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{child?.name ?? "Profile"}</Text>
          <Text style={styles.sheetSubtitle}>Profile actions</Text>
          {child ? (
            <>
              <MenuAction
                icon="create-outline"
                label="Edit profile"
                onPress={() => onOpenProfile(child)}
              />
              <MenuAction
                icon="flag-outline"
                label="Set targets"
                onPress={() => onOpenTargets(child)}
              />
              <MenuAction
                icon="trash-outline"
                label="Delete profile"
                tone="#dc2626"
                onPress={() => onDeleteProfile(child)}
              />
            </>
          ) : null}
          <Pressable style={styles.sheetCancel} onPress={onClose}>
            <Text style={styles.sheetCancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function MenuAction({
  icon,
  label,
  tone = "#111827",
  onPress,
}: {
  icon: IconName;
  label: string;
  tone?: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.menuAction} onPress={onPress}>
      <Ionicons name={icon} size={19} color={tone} />
      <Text style={[styles.menuActionText, { color: tone }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#ffffff",
  },
  title: {
    fontSize: 22,
    fontWeight: "900",
    color: "#111827",
  },
  parentAvatarButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#0f766e",
    borderWidth: 1,
    borderColor: "#0f766e",
    alignItems: "center",
    justifyContent: "center",
  },
  parentAvatarText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },
  content: {
    flex: 1,
  },
  tools: {
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 10,
  },
  activeStrip: {
    gap: 8,
  },
  activeStripHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  activeStripRule: {
    flex: 1,
    height: 1,
    backgroundColor: "#e5e7eb",
  },
  activeStripLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  activeStripList: {
    gap: 10,
    paddingRight: 4,
  },
  activeMiniProfile: {
    width: 64,
    alignItems: "center",
    gap: 5,
  },
  activeMiniAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },
  activeMiniEmoji: {
    fontSize: 24,
  },
  activeMiniName: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "700",
    width: 64,
    textAlign: "center",
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  subtitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111827",
  },
  addButton: {
    backgroundColor: "#111827",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  addButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  searchBox: {
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f8fafc",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: "#111827",
    fontSize: 15,
    fontWeight: "600",
    paddingVertical: 9,
  },
  searchCount: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
  },
  filterRow: {
    gap: 8,
    paddingRight: 8,
  },
  chip: {
    minHeight: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  activityChip: {
    borderColor: "#bfdbfe",
  },
  chipSelected: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  chipText: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "800",
  },
  chipTextSelected: {
    color: "#ffffff",
  },
  sortRow: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f8fafc",
    padding: 3,
    gap: 3,
  },
  sortSegment: {
    minHeight: 30,
    borderRadius: 9,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  sortSegmentSelected: {
    backgroundColor: "#111827",
  },
  sortSegmentText: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "800",
  },
  sortSegmentTextSelected: {
    color: "#ffffff",
  },
  results: {
    flex: 1,
  },
  list: {
    padding: 16,
    gap: 8,
    paddingBottom: 36,
  },
  row: {
    minHeight: 60,
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatarBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    fontSize: 22,
  },
  childText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  childNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  childName: {
    fontSize: 15,
    fontWeight: "900",
    color: "#111827",
    flexShrink: 1,
  },
  agePill: {
    fontSize: 10,
    color: "#2563eb",
    fontWeight: "800",
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 99,
    paddingHorizontal: 7,
    paddingVertical: 2,
    overflow: "hidden",
  },
  childMeta: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "700",
  },
  rowIconButton: {
    width: 30,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  chevronButton: {
    width: 24,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 24,
  },
  errorText: {
    color: "#dc2626",
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 24,
  },
  retryButton: {
    backgroundColor: "#2563eb",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  retryText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  emptyText: {
    color: "#64748b",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 21,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },
  primaryButton: {
    backgroundColor: "#111111",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 22,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  noResults: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    padding: 18,
    alignItems: "center",
    gap: 7,
  },
  noResultsTitle: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "900",
  },
  noResultsText: {
    color: "#64748b",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.14)",
  },
  parentMenu: {
    position: "absolute",
    top: 94,
    right: 14,
    width: 218,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    padding: 6,
    shadowColor: "#0f172a",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  menuAction: {
    minHeight: 46,
    borderRadius: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  menuActionText: {
    fontSize: 14,
    fontWeight: "800",
  },
  menuDivider: {
    height: 1,
    backgroundColor: "#f1f5f9",
    marginVertical: 3,
  },
  sheetBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.28)",
  },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backgroundColor: "#ffffff",
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 28,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#cbd5e1",
    marginBottom: 14,
  },
  sheetTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "900",
  },
  sheetSubtitle: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
    marginBottom: 8,
  },
  sheetCancel: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  sheetCancelText: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "900",
  },
});
