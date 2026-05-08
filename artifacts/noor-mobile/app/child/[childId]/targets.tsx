import { useCallback, useEffect, useMemo, useState, type ComponentProps } from "react";
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  CardGroup,
  ErrorState,
  InlineError,
  ListRow,
  LoadingState,
  ScreenContainer,
  ScreenHeader,
  ScreenScrollView,
  SectionLabel,
} from "@/src/components/screen-primitives";
import { apiFetch } from "@/src/lib/api";
import {
  DEFAULT_PROFILE_SETTINGS,
  DEFAULT_SESSION_SETTINGS,
  loadDefaultSessionSettings,
  loadProfileSettings,
  saveDefaultSessionSettings,
  saveProfileSettings,
  type DefaultSessionSettings,
  type ProfileSettings,
} from "@/src/lib/settings";
import { RECITERS } from "@/src/lib/reciters";
import { THEMES, THEME_DISPLAY_NAMES, type ThemeKey } from "@/src/lib/mushaf-theme";
import {
  HAFIDH_TIERS,
  computeProjectedCompletionDate,
  fetchHafidhProjections,
  type HafidhTier,
  type ProjectionResponse,
  type ProjectionTier,
} from "@/src/lib/projections";

type IconName = ComponentProps<typeof Ionicons>["name"];
type TargetKey = "memorizePagePerDay" | "reviewPagesPerDay" | "readPagesPerDay";
type ChildPatchKey =
  | TargetKey
  | "practiceMinutesPerDay"
  | "memorizeDaysPerWeek"
  | "hafidhTier"
  | "hafidhTargetDate"
  | "hideStories"
  | "hideDuas";

type ChildSettings = {
  id: number;
  name: string;
  age: number;
  avatarEmoji: string;
  streakDays: number;
  totalPoints: number;
  practiceMinutesPerDay: number;
  memorizePagePerDay: number;
  memorizeDaysPerWeek: number;
  reviewPagesPerDay: number;
  readPagesPerDay: number;
  hafidhTier: HafidhTier | null;
  hafidhTargetDate: string | null;
  hideStories: boolean;
  hideDuas: boolean;
};

type TargetDefinition = {
  key: TargetKey;
  title: string;
  detail: string;
  icon: IconName;
  color: string;
  soft: string;
  border: string;
  min: number;
  max: number;
  step: number;
  options: Array<{ value: number; label: string }>;
};

type TargetPreset = {
  label: string;
  detail: string;
  values: Pick<
    ChildSettings,
    "memorizePagePerDay" | "reviewPagesPerDay" | "readPagesPerDay"
  >;
};

const TARGETS: TargetDefinition[] = [
  {
    key: "memorizePagePerDay",
    title: "New memorization",
    detail: "How much new Quran to memorize each day.",
    icon: "school-outline",
    color: "#2563eb",
    soft: "#eff6ff",
    border: "#bfdbfe",
    min: 0.25,
    max: 5,
    step: 0.25,
    options: [
      { value: 0.25, label: "Quarter" },
      { value: 0.5, label: "Half" },
      { value: 1, label: "1 page" },
      { value: 2, label: "2 pages" },
    ],
  },
  {
    key: "reviewPagesPerDay",
    title: "Review amount",
    detail: "How much memorized Quran to review each day.",
    icon: "refresh-outline",
    color: "#ea580c",
    soft: "#fff7ed",
    border: "#fed7aa",
    min: 0.5,
    max: 20,
    step: 0.5,
    options: [
      { value: 1, label: "1 page" },
      { value: 2, label: "2 pages" },
      { value: 4, label: "4 pages" },
      { value: 10, label: "10 pages" },
      { value: 20, label: "20 pages" },
    ],
  },
  {
    key: "readPagesPerDay",
    title: "Daily reading",
    detail: "Pages to read from the Mushaf each day.",
    icon: "reader-outline",
    color: "#0f766e",
    soft: "#f0fdfa",
    border: "#99f6e4",
    min: 0,
    max: 10,
    step: 0.5,
    options: [
      { value: 0, label: "Off" },
      { value: 0.5, label: "Half" },
      { value: 1, label: "1 page" },
      { value: 2, label: "2 pages" },
      { value: 5, label: "5 pages" },
    ],
  },
];

const TARGET_PRESETS: TargetPreset[] = [
  {
    label: "Gentle",
    detail: "Short daily habit",
    values: {
      memorizePagePerDay: 0.25,
      reviewPagesPerDay: 1,
      readPagesPerDay: 0.5,
    },
  },
  {
    label: "Steady",
    detail: "Balanced school-day pace",
    values: {
      memorizePagePerDay: 0.5,
      reviewPagesPerDay: 2,
      readPagesPerDay: 1,
    },
  },
  {
    label: "Focused",
    detail: "Stronger hifz rhythm",
    values: {
      memorizePagePerDay: 1,
      reviewPagesPerDay: 4,
      readPagesPerDay: 2,
    },
  },
  {
    label: "Ambitious",
    detail: "For heavier practice days",
    values: {
      memorizePagePerDay: 2,
      reviewPagesPerDay: 10,
      readPagesPerDay: 5,
    },
  },
];

const PRACTICE_PRESETS = [10, 15, 20, 30, 45, 60];
const VIEW_MODE_OPTIONS: Array<{ value: ProfileSettings["viewMode"]; label: string }> = [
  { value: "ayah", label: "Ayah view" },
  { value: "test-mushaf", label: "Full Mushaf" },
];
const MUSHAF_VIEW_MODE_OPTIONS: Array<{
  value: ProfileSettings["mushafViewMode"];
  label: string;
}> = [
  { value: "swipe", label: "Swipe" },
  { value: "scroll", label: "Scroll" },
];
const THEME_OPTIONS = Object.keys(THEMES) as ThemeKey[];
const DAYS_PER_WEEK_OPTIONS = [1, 2, 3, 4, 5, 6, 7];
const HAFIDH_GOAL_OPTIONS: Array<{
  tier: HafidhTier | null;
  label: string;
  detail: string;
}> = [
  { tier: null, label: "No specific tier", detail: "Show all milestones" },
  ...HAFIDH_TIERS.map((tier) => ({
    tier: tier.tier,
    label: tier.label,
    detail: `${tier.totalPages} pages`,
  })),
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeValue(value: number) {
  return Math.round(value * 100) / 100;
}

function formatPages(value: number) {
  if (value === 0) return "Off";
  if (value === 0.25) return "Quarter page";
  if (value === 0.5) return "Half page";
  const formatted = Number.isInteger(value) ? String(value) : String(value).replace(/\.0$/, "");
  return `${formatted} page${value === 1 ? "" : "s"}`;
}

function formatDayStreak(days: number) {
  return `${days} day${days === 1 ? "" : "s"}`;
}

function formatDaysPerWeek(days: number) {
  return `${days} day${days === 1 ? "" : "s"}/week`;
}

function formatProjectedDate(value: string | null) {
  if (!value) return "Not enough pace";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "Not enough pace";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getFutureDate(years: number) {
  const date = new Date();
  date.setFullYear(date.getFullYear() + years);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateInputIsValid(value: string) {
  return value.trim() === "" || /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

function isSameValue(a: number, b: number) {
  return Math.abs(a - b) < 0.001;
}

function isValidChildId(childId: string | undefined) {
  return typeof childId === "string" && /^\d+$/.test(childId);
}

function normalizeSessionDefaults(settings: DefaultSessionSettings): DefaultSessionSettings {
  return {
    repeatCount: Math.round(clamp(settings.repeatCount, 1, 10)),
    autoAdvanceDelayMs: Math.round(clamp(settings.autoAdvanceDelayMs, 0, 5000) / 500) * 500,
    autoplayThroughRange: settings.autoplayThroughRange,
    blurMode: settings.blurMode,
    blindMode: settings.blindMode,
    cumulativeReview: settings.cumulativeReview,
    reviewRepeatCount: Math.round(clamp(settings.reviewRepeatCount, 1, 10)),
    confetti: settings.confetti,
  };
}

function normalizeProfileDefaults(settings: ProfileSettings): ProfileSettings {
  const themeKey = Object.prototype.hasOwnProperty.call(THEMES, settings.themeKey)
    ? settings.themeKey
    : DEFAULT_PROFILE_SETTINGS.themeKey;
  const reciterId = RECITERS.some((reciter) => reciter.id === settings.reciterId)
    ? settings.reciterId
    : DEFAULT_PROFILE_SETTINGS.reciterId;

  return {
    themeKey,
    reciterId,
    viewMode:
      settings.viewMode === "page" || settings.viewMode === "test-mushaf"
        ? "test-mushaf"
        : "ayah",
    mushafViewMode: settings.mushafViewMode === "scroll" ? "scroll" : "swipe",
  };
}

function targetPresetIsActive(child: ChildSettings, preset: TargetPreset) {
  return (
    isSameValue(child.memorizePagePerDay, preset.values.memorizePagePerDay) &&
    isSameValue(child.reviewPagesPerDay, preset.values.reviewPagesPerDay) &&
    isSameValue(child.readPagesPerDay, preset.values.readPagesPerDay)
  );
}

function ProjectionPreviewCard({
  childName,
  activeTier,
  tiers,
  pacePagesPerWeek,
}: {
  childName: string;
  activeTier: HafidhTier | null;
  tiers: ProjectionTier[];
  pacePagesPerWeek: number;
}) {
  const selectedTier =
    tiers.find((tier) => tier.tier === activeTier) ??
    tiers.find((tier) => tier.tier === "full_hafidh") ??
    tiers[tiers.length - 1];
  if (!selectedTier) return null;

  return (
    <View style={styles.previewCard}>
      <View style={styles.previewHeader}>
        <View style={styles.titleBlock}>
          <Text style={styles.previewKicker}>Plan preview</Text>
          <Text style={styles.previewTitle}>
            {childName} by {formatProjectedDate(selectedTier.projectedCompletionDate)}
          </Text>
        </View>
        <View style={styles.previewIcon}>
          <Ionicons name="calendar-outline" size={18} color="#0f766e" />
        </View>
      </View>
      <Text style={styles.previewDetail}>
        {pacePagesPerWeek.toFixed(2).replace(/\.00$/, "")} pages/week toward {selectedTier.label}.
      </Text>

      {activeTier ? (
        <View style={styles.previewMilestones}>
          {tiers.map((tier) => (
            <View key={tier.tier} style={styles.previewMilestoneRow}>
              <Text style={styles.previewMilestoneTitle}>{tier.label}</Text>
              <Text style={styles.previewMilestoneDate}>
                {formatProjectedDate(tier.projectedCompletionDate)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function TargetSection({
  definition,
  value,
  saving,
  saved,
  onChange,
}: {
  definition: TargetDefinition;
  value: number;
  saving: boolean;
  saved: boolean;
  onChange: (definition: TargetDefinition, value: number) => void;
}) {
  const canDecrease = value > definition.min;
  const canIncrease = value < definition.max;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconBadge, { backgroundColor: definition.soft }]}>
          <Ionicons name={definition.icon} size={19} color={definition.color} />
        </View>
        <View style={styles.titleBlock}>
          <Text style={styles.cardTitle}>{definition.title}</Text>
          <Text style={styles.cardDetail}>{definition.detail}</Text>
        </View>
        <Text
          style={[
            styles.statusText,
            saved && styles.statusSaved,
            saving && styles.statusSaving,
          ]}
        >
          {saving ? "Saving" : saved ? "Saved" : formatPages(value)}
        </Text>
      </View>

      <View style={styles.optionGrid}>
        {definition.options.map((option) => {
          const active = isSameValue(value, option.value);
          return (
            <Pressable
              key={option.value}
              style={[
                styles.optionButton,
                active && {
                  backgroundColor: definition.soft,
                  borderColor: definition.border,
                },
              ]}
              onPress={() => onChange(definition, option.value)}
              disabled={saving}
            >
              <Text
                style={[
                  styles.optionText,
                  active && { color: definition.color },
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.stepperRow}>
        <Pressable
          style={[styles.stepButton, (!canDecrease || saving) && styles.stepButtonDisabled]}
          onPress={() =>
            onChange(
              definition,
              normalizeValue(clamp(value - definition.step, definition.min, definition.max)),
            )
          }
          disabled={!canDecrease || saving}
        >
          <Text style={styles.stepButtonText}>-</Text>
        </Pressable>
        <View style={styles.stepValueWrap}>
          <Text style={styles.stepValue}>{formatPages(value)}</Text>
          <Text style={styles.stepHint}>{definition.step} page step</Text>
        </View>
        <Pressable
          style={[styles.stepButton, (!canIncrease || saving) && styles.stepButtonDisabled]}
          onPress={() =>
            onChange(
              definition,
              normalizeValue(clamp(value + definition.step, definition.min, definition.max)),
            )
          }
          disabled={!canIncrease || saving}
        >
          <Text style={styles.stepButtonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function TargetsScreen() {
  const { childId, name } = useLocalSearchParams<{ childId: string; name: string }>();
  const router = useRouter();
  const [child, setChild] = useState<ChildSettings | null>(null);
  const [sessionDefaults, setSessionDefaults] =
    useState<DefaultSessionSettings>(DEFAULT_SESSION_SETTINGS);
  const [profileDefaults, setProfileDefaults] =
    useState<ProfileSettings>(DEFAULT_PROFILE_SETTINGS);
  const [projection, setProjection] = useState<ProjectionResponse | null>(null);
  const [draftTier, setDraftTier] = useState<HafidhTier | null>(null);
  const [draftTargetDate, setDraftTargetDate] = useState("");
  const [draftMemorizeDaysPerWeek, setDraftMemorizeDaysPerWeek] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    if (!isValidChildId(childId)) {
      setError("This settings route is missing a valid child id.");
      return;
    }

    setError(null);
    try {
      const [childData, defaults, profile, projectionData] = await Promise.all([
        apiFetch<ChildSettings>(`/api/children/${childId}`),
        loadDefaultSessionSettings(childId),
        loadProfileSettings(childId),
        fetchHafidhProjections(childId).catch(() => null),
      ]);
      setChild(childData);
      setSessionDefaults(defaults);
      setProfileDefaults(normalizeProfileDefaults(profile));
      setProjection(projectionData);
      setDraftTier(childData.hafidhTier ?? null);
      setDraftTargetDate(childData.hafidhTargetDate ?? "");
      setDraftMemorizeDaysPerWeek(
        Math.round(clamp(childData.memorizeDaysPerWeek ?? 5, 1, 7)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load settings.");
    }
  }, [childId]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  function markSaved(key: string) {
    setSavedKey(key);
    setTimeout(() => {
      setSavedKey((current) => (current === key ? null : current));
    }, 1800);
  }

  async function updateChildSettings(
    patch: Partial<Pick<ChildSettings, ChildPatchKey>>,
    key: string,
  ) {
    if (!isValidChildId(childId)) return;

    setSavingKey(key);
    setSavedKey(null);
    setError(null);
    try {
      const updated = await apiFetch<ChildSettings>(`/api/children/${childId}`, {
        method: "PUT",
        body: JSON.stringify(patch),
      });
      setChild(updated);
      markSaved(key);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save settings.");
    } finally {
      setSavingKey(null);
    }
  }

  function updateTarget(definition: TargetDefinition, nextValue: number) {
    const value = normalizeValue(clamp(nextValue, definition.min, definition.max));
    void updateChildSettings({ [definition.key]: value }, definition.key);
  }

  async function saveHafidhSettings() {
    if (!isValidChildId(childId)) return;

    const targetDate = draftTargetDate.trim();
    if (!dateInputIsValid(targetDate)) {
      setError("Use YYYY-MM-DD for the target date, or leave it blank.");
      return;
    }

    setSavingKey("hafidh");
    setSavedKey(null);
    setError(null);
    try {
      const updated = await apiFetch<ChildSettings>(`/api/children/${childId}`, {
        method: "PUT",
        body: JSON.stringify({
          memorizeDaysPerWeek: Math.round(clamp(draftMemorizeDaysPerWeek, 1, 7)),
          hafidhTier: draftTier,
          hafidhTargetDate: targetDate === "" ? null : targetDate,
        }),
      });
      setChild(updated);
      setProjection(await fetchHafidhProjections(childId).catch(() => projection));
      markSaved("hafidh");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save Hafidh goal.");
    } finally {
      setSavingKey(null);
    }
  }

  function applyTargetPreset(preset: TargetPreset) {
    void updateChildSettings(preset.values, `preset:${preset.label}`);
  }

  function updatePracticeMinutes(nextValue: number) {
    const value = Math.round(clamp(nextValue, 5, 120));
    void updateChildSettings({ practiceMinutesPerDay: value }, "practiceMinutesPerDay");
  }

  function updateVisibility(key: "hideStories" | "hideDuas", visible: boolean) {
    void updateChildSettings({ [key]: !visible }, key);
  }

  async function updateSessionDefaults(
    patch: Partial<DefaultSessionSettings>,
    key: string,
  ) {
    if (!isValidChildId(childId)) return;
    const next = normalizeSessionDefaults({ ...sessionDefaults, ...patch });
    setSessionDefaults(next);
    setSavingKey(key);
    setSavedKey(null);
    setError(null);
    try {
      await saveDefaultSessionSettings(childId, next);
      markSaved(key);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save session defaults.");
    } finally {
      setSavingKey(null);
    }
  }

  async function updateProfileDefaults(
    patch: Partial<ProfileSettings>,
    key: string,
  ) {
    if (!isValidChildId(childId)) return;
    const next = normalizeProfileDefaults({ ...profileDefaults, ...patch });
    setProfileDefaults(next);
    setSavingKey(key);
    setSavedKey(null);
    setError(null);
    try {
      await saveProfileSettings(childId, next);
      markSaved(key);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save memorization defaults.");
    } finally {
      setSavingKey(null);
    }
  }

  function openProfile() {
    if (!isValidChildId(childId)) return;
    router.push({
      pathname: "/child/[childId]/profile",
      params: { childId, name: child?.name ?? name ?? "" },
    });
  }

  const previewPacePagesPerWeek = useMemo(
    () => Math.max(0, (child?.memorizePagePerDay ?? 1) * draftMemorizeDaysPerWeek),
    [child?.memorizePagePerDay, draftMemorizeDaysPerWeek],
  );
  const previewTiers = useMemo<ProjectionTier[]>(() => {
    const baseTiers =
      projection?.tiers.length
        ? projection.tiers
        : HAFIDH_TIERS.map((tier) => ({
            tier: tier.tier,
            label: tier.label,
            totalPages: tier.totalPages,
            pagesRemaining: tier.totalPages,
            projectedCompletionDate: null,
            meetsExplicitTarget: null,
          }));

    return baseTiers.map((tier) => ({
      ...tier,
      projectedCompletionDate: computeProjectedCompletionDate(
        tier.pagesRemaining,
        previewPacePagesPerWeek,
      ),
      meetsExplicitTarget:
        draftTargetDate.trim() === "" || !dateInputIsValid(draftTargetDate)
          ? null
          : computeProjectedCompletionDate(tier.pagesRemaining, previewPacePagesPerWeek) != null &&
            computeProjectedCompletionDate(tier.pagesRemaining, previewPacePagesPerWeek)! <=
              draftTargetDate.trim(),
    }));
  }, [draftTargetDate, previewPacePagesPerWeek, projection?.tiers]);
  const hafidhDateValid = dateInputIsValid(draftTargetDate);
  const hafidhSaving = savingKey === "hafidh";
  const hafidhSaved = savedKey === "hafidh";
  const hasHafidhChanges =
    child != null &&
    (draftTier !== (child.hafidhTier ?? null) ||
      draftTargetDate.trim() !== (child.hafidhTargetDate ?? "") ||
      draftMemorizeDaysPerWeek !== child.memorizeDaysPerWeek);

  if (child === null && !error) {
    return (
      <ScreenContainer>
        <ScreenHeader title="Settings" onBack={() => router.back()} />
        <LoadingState label="Loading settings" />
      </ScreenContainer>
    );
  }

  if (child === null && error) {
    return (
      <ScreenContainer>
        <ScreenHeader title="Settings" onBack={() => router.back()} />
        <ErrorState message={error} onRetry={loadSettings} />
      </ScreenContainer>
    );
  }

  if (!child) return null;

  const practiceSaving = savingKey === "practiceMinutesPerDay";
  const sessionSaving = savingKey?.startsWith("session:");
  const sessionSaved = savedKey?.startsWith("session:");
  const profileSaving = savingKey?.startsWith("profile:");
  const profileSaved = savedKey?.startsWith("profile:");

  return (
    <ScreenContainer>
      <ScreenHeader title="Settings" onBack={() => router.back()} />
      <ScreenScrollView>
        <View style={styles.summaryBand}>
          <Text style={styles.summaryAvatar}>{child.avatarEmoji}</Text>
          <View style={styles.summaryText}>
            <Text style={styles.summaryKicker}>Parent settings</Text>
            <Text style={styles.summaryName}>{child.name || name || "Child"}</Text>
            <Text style={styles.summarySubline}>
              Age {child.age} - {formatDayStreak(child.streakDays)} - {child.totalPoints} pts
            </Text>
          </View>
        </View>

        {error ? <InlineError message={error} /> : null}

        <SectionLabel>Hafidh Goal</SectionLabel>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconBadge, { backgroundColor: "#fff7ed" }]}>
              <Ionicons name="map-outline" size={19} color="#ea580c" />
            </View>
            <View style={styles.titleBlock}>
              <Text style={styles.cardTitle}>Hafidh goal</Text>
              <Text style={styles.cardDetail}>Pick a milestone and optional target date.</Text>
            </View>
            {hafidhSaving || hafidhSaved ? (
              <Text style={[styles.statusText, hafidhSaved && styles.statusSaved]}>
                {hafidhSaving ? "Saving" : "Saved"}
              </Text>
            ) : null}
          </View>

          <View style={styles.optionGrid}>
            {HAFIDH_GOAL_OPTIONS.map((option) => {
              const active = draftTier === option.tier;
              return (
                <Pressable
                  key={option.tier ?? "none"}
                  style={[styles.goalOption, active && styles.goalOptionActive]}
                  onPress={() => setDraftTier(option.tier)}
                  disabled={hafidhSaving}
                >
                  <Text style={[styles.goalOptionTitle, active && styles.goalOptionTitleActive]}>
                    {option.label}
                  </Text>
                  <Text style={styles.goalOptionDetail}>{option.detail}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.dateBlock}>
            <Text style={styles.settingGroupLabel}>Target date</Text>
            <TextInput
              value={draftTargetDate}
              onChangeText={setDraftTargetDate}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="numbers-and-punctuation"
              style={[styles.dateInput, !hafidhDateValid && styles.dateInputInvalid]}
            />
            <View style={styles.optionGrid}>
              <Pressable
                style={[styles.optionButton, draftTargetDate.trim() === "" && styles.goalChipActive]}
                onPress={() => setDraftTargetDate("")}
              >
                <Text style={styles.optionText}>No date</Text>
              </Pressable>
              {[1, 2, 3].map((years) => (
                <Pressable
                  key={years}
                  style={styles.optionButton}
                  onPress={() => setDraftTargetDate(getFutureDate(years))}
                >
                  <Text style={styles.optionText}>{years} yr</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <ProjectionPreviewCard
            childName={child.name || name || "Child"}
            activeTier={draftTier}
            tiers={previewTiers}
            pacePagesPerWeek={previewPacePagesPerWeek}
          />

          <Pressable
            style={[
              styles.saveButton,
              (!hasHafidhChanges || !hafidhDateValid || hafidhSaving) && styles.saveButtonDisabled,
            ]}
            onPress={() => void saveHafidhSettings()}
            disabled={!hasHafidhChanges || !hafidhDateValid || hafidhSaving}
          >
            <Text style={styles.saveButtonText}>
              {hafidhSaving ? "Saving" : hasHafidhChanges ? "Save" : "Saved"}
            </Text>
          </Pressable>
        </View>

        <SectionLabel>Profile</SectionLabel>
        <CardGroup>
          <ListRow
            title="Profile settings"
            detail="Name, age, avatar, and delete flow"
            iconName="person-circle-outline"
            iconColor="#4f46e5"
            onPress={openProfile}
          />
        </CardGroup>

        <SectionLabel>Daily presets</SectionLabel>
        <View style={styles.presetGrid}>
          {TARGET_PRESETS.map((preset) => {
            const active = targetPresetIsActive(child, preset);
            const key = `preset:${preset.label}`;
            const saving = savingKey === key;
            const saved = savedKey === key;
            return (
              <Pressable
                key={preset.label}
                style={[styles.presetCard, active && styles.presetCardActive]}
                onPress={() => applyTargetPreset(preset)}
                disabled={savingKey !== null}
              >
                <View style={styles.presetTop}>
                  <Text style={[styles.presetTitle, active && styles.presetTitleActive]}>
                    {preset.label}
                  </Text>
                  {saving || saved ? (
                    <Text style={[styles.presetStatus, saved && styles.statusSaved]}>
                      {saving ? "Saving" : "Saved"}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.presetDetail}>{preset.detail}</Text>
                <Text style={styles.presetMeta}>
                  {formatPages(preset.values.memorizePagePerDay)} mem -{" "}
                  {formatPages(preset.values.reviewPagesPerDay)} review -{" "}
                  {formatPages(preset.values.readPagesPerDay)} read
                </Text>
              </Pressable>
            );
          })}
        </View>

        <SectionLabel>Daily rhythm</SectionLabel>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconBadge, { backgroundColor: "#fef3c7" }]}>
              <Ionicons name="time-outline" size={19} color="#b45309" />
            </View>
            <View style={styles.titleBlock}>
              <Text style={styles.cardTitle}>Practice time</Text>
              <Text style={styles.cardDetail}>Used for planning and goal estimates.</Text>
            </View>
            <Text
              style={[
                styles.statusText,
                savedKey === "practiceMinutesPerDay" && styles.statusSaved,
                practiceSaving && styles.statusSaving,
              ]}
            >
              {practiceSaving
                ? "Saving"
                : savedKey === "practiceMinutesPerDay"
                ? "Saved"
                : `${child.practiceMinutesPerDay} min`}
            </Text>
          </View>

          <View style={styles.optionGrid}>
            {PRACTICE_PRESETS.map((minutes) => {
              const active = child.practiceMinutesPerDay === minutes;
              return (
                <Pressable
                  key={minutes}
                  style={[styles.optionButton, active && styles.practiceOptionActive]}
                  onPress={() => updatePracticeMinutes(minutes)}
                  disabled={practiceSaving}
                >
                  <Text style={[styles.optionText, active && styles.practiceOptionTextActive]}>
                    {minutes} min
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.stepperRow}>
            <Pressable
              style={[
                styles.stepButton,
                (child.practiceMinutesPerDay <= 5 || practiceSaving) && styles.stepButtonDisabled,
              ]}
              onPress={() => updatePracticeMinutes(child.practiceMinutesPerDay - 5)}
              disabled={child.practiceMinutesPerDay <= 5 || practiceSaving}
            >
              <Text style={styles.stepButtonText}>-</Text>
            </Pressable>
            <View style={styles.stepValueWrap}>
              <Text style={styles.stepValue}>{child.practiceMinutesPerDay} minutes</Text>
              <Text style={styles.stepHint}>5 minute step</Text>
            </View>
            <Pressable
              style={[
                styles.stepButton,
                (child.practiceMinutesPerDay >= 120 || practiceSaving) && styles.stepButtonDisabled,
              ]}
              onPress={() => updatePracticeMinutes(child.practiceMinutesPerDay + 5)}
              disabled={child.practiceMinutesPerDay >= 120 || practiceSaving}
            >
              <Text style={styles.stepButtonText}>+</Text>
            </Pressable>
          </View>
        </View>

        <SectionLabel>Memorization pace</SectionLabel>
        <TargetSection
          definition={TARGETS[0]}
          value={child[TARGETS[0].key]}
          saving={savingKey === TARGETS[0].key}
          saved={savedKey === TARGETS[0].key}
          onChange={updateTarget}
        />

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconBadge, { backgroundColor: "#ecfeff" }]}>
              <Ionicons name="calendar-number-outline" size={19} color="#0891b2" />
            </View>
            <View style={styles.titleBlock}>
              <Text style={styles.cardTitle}>Memorization days</Text>
              <Text style={styles.cardDetail}>Days each week planned for new memorization.</Text>
            </View>
            <Text style={[styles.statusText, hasHafidhChanges && styles.statusSaving]}>
              {formatDaysPerWeek(draftMemorizeDaysPerWeek)}
            </Text>
          </View>
          <View style={styles.optionGrid}>
            {DAYS_PER_WEEK_OPTIONS.map((days) => {
              const active = draftMemorizeDaysPerWeek === days;
              return (
                <Pressable
                  key={days}
                  style={[styles.optionButton, active && styles.daysOptionActive]}
                  onPress={() => setDraftMemorizeDaysPerWeek(days)}
                  disabled={hafidhSaving}
                >
                  <Text style={[styles.optionText, active && styles.daysOptionTextActive]}>
                    {days}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.stepperRow}>
            <Pressable
              style={[
                styles.stepButton,
                (draftMemorizeDaysPerWeek <= 1 || hafidhSaving) && styles.stepButtonDisabled,
              ]}
              onPress={() => setDraftMemorizeDaysPerWeek((current) => Math.max(1, current - 1))}
              disabled={draftMemorizeDaysPerWeek <= 1 || hafidhSaving}
            >
              <Text style={styles.stepButtonText}>-</Text>
            </Pressable>
            <View style={styles.stepValueWrap}>
              <Text style={styles.stepValue}>{formatDaysPerWeek(draftMemorizeDaysPerWeek)}</Text>
              <Text style={styles.stepHint}>Saved with Hafidh goal</Text>
            </View>
            <Pressable
              style={[
                styles.stepButton,
                (draftMemorizeDaysPerWeek >= 7 || hafidhSaving) && styles.stepButtonDisabled,
              ]}
              onPress={() => setDraftMemorizeDaysPerWeek((current) => Math.min(7, current + 1))}
              disabled={draftMemorizeDaysPerWeek >= 7 || hafidhSaving}
            >
              <Text style={styles.stepButtonText}>+</Text>
            </Pressable>
          </View>
        </View>

        <SectionLabel>Daily pages</SectionLabel>
        {TARGETS.slice(1).map((definition) => (
          <TargetSection
            key={definition.key}
            definition={definition}
            value={child[definition.key]}
            saving={savingKey === definition.key}
            saved={savedKey === definition.key}
            onChange={updateTarget}
          />
        ))}

        <SectionLabel>Content visibility</SectionLabel>
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={styles.titleBlock}>
              <Text style={styles.cardTitle}>Stories</Text>
              <Text style={styles.cardDetail}>Show story suggestions on the dashboard.</Text>
            </View>
            <Switch
              value={!child.hideStories}
              onValueChange={(enabled) => updateVisibility("hideStories", enabled)}
              disabled={savingKey === "hideStories"}
              trackColor={{ false: "#e5e7eb", true: "#bfdbfe" }}
              thumbColor={!child.hideStories ? "#2563eb" : "#f9fafb"}
            />
          </View>
          <View style={styles.toggleDivider} />
          <View style={styles.toggleRow}>
            <View style={styles.titleBlock}>
              <Text style={styles.cardTitle}>Du'aas</Text>
              <Text style={styles.cardDetail}>Show du'aa suggestions on the dashboard.</Text>
            </View>
            <Switch
              value={!child.hideDuas}
              onValueChange={(enabled) => updateVisibility("hideDuas", enabled)}
              disabled={savingKey === "hideDuas"}
              trackColor={{ false: "#e5e7eb", true: "#99f6e4" }}
              thumbColor={!child.hideDuas ? "#0f766e" : "#f9fafb"}
            />
          </View>
        </View>

        <SectionLabel>Memorization defaults</SectionLabel>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconBadge, { backgroundColor: "#f5f3ff" }]}>
              <Ionicons name="options-outline" size={19} color="#7c3aed" />
            </View>
            <View style={styles.titleBlock}>
              <Text style={styles.cardTitle}>Session start settings</Text>
              <Text style={styles.cardDetail}>
                Applied when a memorization session opens; in-session changes stay temporary.
              </Text>
            </View>
            {sessionSaving || sessionSaved ? (
              <Text style={[styles.statusText, sessionSaved && styles.statusSaved]}>
                {sessionSaving ? "Saving" : "Saved"}
              </Text>
            ) : null}
          </View>

          <View style={styles.settingRow}>
            <View style={styles.titleBlock}>
              <Text style={styles.cardTitle}>Repeat each ayah</Text>
              <Text style={styles.cardDetail}>Default listening repeats.</Text>
            </View>
            <View style={styles.compactStepper}>
              <Pressable
                style={styles.compactStepButton}
                onPress={() =>
                  updateSessionDefaults(
                    { repeatCount: sessionDefaults.repeatCount - 1 },
                    "session:repeatCount",
                  )
                }
              >
                <Text style={styles.compactStepText}>-</Text>
              </Pressable>
              <Text style={styles.compactValue}>{sessionDefaults.repeatCount}</Text>
              <Pressable
                style={styles.compactStepButton}
                onPress={() =>
                  updateSessionDefaults(
                    { repeatCount: sessionDefaults.repeatCount + 1 },
                    "session:repeatCount",
                  )
                }
              >
                <Text style={styles.compactStepText}>+</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.settingRow}>
            <View style={styles.titleBlock}>
              <Text style={styles.cardTitle}>Delay between ayahs</Text>
              <Text style={styles.cardDetail}>Pause before moving to the next ayah.</Text>
            </View>
            <View style={styles.compactStepper}>
              <Pressable
                style={styles.compactStepButton}
                onPress={() =>
                  updateSessionDefaults(
                    { autoAdvanceDelayMs: sessionDefaults.autoAdvanceDelayMs - 500 },
                    "session:autoAdvanceDelayMs",
                  )
                }
              >
                <Text style={styles.compactStepText}>-</Text>
              </Pressable>
              <Text style={styles.compactValue}>
                {(sessionDefaults.autoAdvanceDelayMs / 1000).toFixed(1)}s
              </Text>
              <Pressable
                style={styles.compactStepButton}
                onPress={() =>
                  updateSessionDefaults(
                    { autoAdvanceDelayMs: sessionDefaults.autoAdvanceDelayMs + 500 },
                    "session:autoAdvanceDelayMs",
                  )
                }
              >
                <Text style={styles.compactStepText}>+</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.toggleDivider} />
          <View style={styles.toggleRow}>
            <View style={styles.titleBlock}>
              <Text style={styles.cardTitle}>Auto-advance range</Text>
              <Text style={styles.cardDetail}>Continue through the assigned range after each ayah.</Text>
            </View>
            <Switch
              value={sessionDefaults.autoplayThroughRange}
              onValueChange={(enabled) =>
                updateSessionDefaults(
                  { autoplayThroughRange: enabled },
                  "session:autoplayThroughRange",
                )
              }
              trackColor={{ false: "#e5e7eb", true: "#ddd6fe" }}
              thumbColor={sessionDefaults.autoplayThroughRange ? "#7c3aed" : "#f9fafb"}
            />
          </View>
          <View style={styles.toggleRow}>
            <View style={styles.titleBlock}>
              <Text style={styles.cardTitle}>Start with blind mode</Text>
              <Text style={styles.cardDetail}>Hide words until a verse is revealed.</Text>
            </View>
            <Switch
              value={sessionDefaults.blindMode}
              onValueChange={(enabled) =>
                updateSessionDefaults({ blindMode: enabled }, "session:blindMode")
              }
              trackColor={{ false: "#e5e7eb", true: "#ddd6fe" }}
              thumbColor={sessionDefaults.blindMode ? "#7c3aed" : "#f9fafb"}
            />
          </View>
          <View style={styles.toggleRow}>
            <View style={styles.titleBlock}>
              <Text style={styles.cardTitle}>Start with blur mode</Text>
              <Text style={styles.cardDetail}>Blur other verses during page-mode playback.</Text>
            </View>
            <Switch
              value={sessionDefaults.blurMode}
              onValueChange={(enabled) =>
                updateSessionDefaults({ blurMode: enabled }, "session:blurMode")
              }
              trackColor={{ false: "#e5e7eb", true: "#ddd6fe" }}
              thumbColor={sessionDefaults.blurMode ? "#7c3aed" : "#f9fafb"}
            />
          </View>
          <View style={styles.toggleDivider} />
          <View style={styles.toggleRow}>
            <View style={styles.titleBlock}>
              <Text style={styles.cardTitle}>Cumulative review</Text>
              <Text style={styles.cardDetail}>Replay from the start after each new ayah.</Text>
            </View>
            <Switch
              value={sessionDefaults.cumulativeReview}
              onValueChange={(enabled) =>
                updateSessionDefaults(
                  { cumulativeReview: enabled },
                  "session:cumulativeReview",
                )
              }
              trackColor={{ false: "#e5e7eb", true: "#ddd6fe" }}
              thumbColor={sessionDefaults.cumulativeReview ? "#7c3aed" : "#f9fafb"}
            />
          </View>
          {sessionDefaults.cumulativeReview ? (
            <View style={styles.settingRow}>
              <View style={styles.titleBlock}>
                <Text style={styles.cardTitle}>Review repeat count</Text>
                <Text style={styles.cardDetail}>Default cumulative loop count.</Text>
              </View>
              <View style={styles.compactStepper}>
                <Pressable
                  style={styles.compactStepButton}
                  onPress={() =>
                    updateSessionDefaults(
                      { reviewRepeatCount: sessionDefaults.reviewRepeatCount - 1 },
                      "session:reviewRepeatCount",
                    )
                  }
                >
                  <Text style={styles.compactStepText}>-</Text>
                </Pressable>
                <Text style={styles.compactValue}>{sessionDefaults.reviewRepeatCount}x</Text>
                <Pressable
                  style={styles.compactStepButton}
                  onPress={() =>
                    updateSessionDefaults(
                      { reviewRepeatCount: sessionDefaults.reviewRepeatCount + 1 },
                      "session:reviewRepeatCount",
                    )
                  }
                >
                  <Text style={styles.compactStepText}>+</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
          <View style={styles.toggleRow}>
            <View style={styles.titleBlock}>
              <Text style={styles.cardTitle}>Celebration confetti</Text>
              <Text style={styles.cardDetail}>Show celebration after completed memorization work.</Text>
            </View>
            <Switch
              value={sessionDefaults.confetti}
              onValueChange={(enabled) =>
                updateSessionDefaults({ confetti: enabled }, "session:confetti")
              }
              trackColor={{ false: "#e5e7eb", true: "#ddd6fe" }}
              thumbColor={sessionDefaults.confetti ? "#7c3aed" : "#f9fafb"}
            />
          </View>
        </View>

        <SectionLabel>Mushaf and audio defaults</SectionLabel>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconBadge, { backgroundColor: "#ecfeff" }]}>
              <Ionicons name="volume-high-outline" size={19} color="#0891b2" />
            </View>
            <View style={styles.titleBlock}>
              <Text style={styles.cardTitle}>Memorization player</Text>
              <Text style={styles.cardDetail}>
                Default view, reciter, and Mushaf theme for new sessions.
              </Text>
            </View>
            {profileSaving || profileSaved ? (
              <Text style={[styles.statusText, profileSaved && styles.statusSaved]}>
                {profileSaving ? "Saving" : "Saved"}
              </Text>
            ) : null}
          </View>

          <View>
            <Text style={styles.settingGroupLabel}>View mode</Text>
            <View style={styles.optionGrid}>
              {VIEW_MODE_OPTIONS.map((option) => {
                const active = profileDefaults.viewMode === option.value;
                return (
                  <Pressable
                    key={option.value}
                    style={[styles.optionButton, active && styles.memorizationOptionActive]}
                    onPress={() =>
                      updateProfileDefaults({ viewMode: option.value }, "profile:viewMode")
                    }
                  >
                    <Text
                      style={[
                        styles.optionText,
                        active && styles.memorizationOptionTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View>
            <Text style={styles.settingGroupLabel}>Mushaf view</Text>
            <View style={styles.optionGrid}>
              {MUSHAF_VIEW_MODE_OPTIONS.map((option) => {
                const active = profileDefaults.mushafViewMode === option.value;
                return (
                  <Pressable
                    key={option.value}
                    style={[styles.optionButton, active && styles.memorizationOptionActive]}
                    onPress={() =>
                      updateProfileDefaults(
                        { mushafViewMode: option.value },
                        "profile:mushafViewMode",
                      )
                    }
                  >
                    <Text
                      style={[
                        styles.optionText,
                        active && styles.memorizationOptionTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View>
            <Text style={styles.settingGroupLabel}>Reciter</Text>
            <View style={styles.optionGrid}>
              {RECITERS.map((reciter) => {
                const active = profileDefaults.reciterId === reciter.id;
                const label = reciter.fullName.split(" ").slice(-1)[0] ?? reciter.fullName;
                return (
                  <Pressable
                    key={reciter.id}
                    style={[styles.optionButton, active && styles.memorizationOptionActive]}
                    onPress={() =>
                      updateProfileDefaults({ reciterId: reciter.id }, "profile:reciterId")
                    }
                  >
                    <Text
                      style={[
                        styles.optionText,
                        active && styles.memorizationOptionTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View>
            <Text style={styles.settingGroupLabel}>Mushaf theme</Text>
            <View style={styles.optionGrid}>
              {THEME_OPTIONS.map((themeKey) => {
                const active = profileDefaults.themeKey === themeKey;
                return (
                  <Pressable
                    key={themeKey}
                    style={[styles.optionButton, active && styles.memorizationOptionActive]}
                    onPress={() => updateProfileDefaults({ themeKey }, "profile:themeKey")}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        active && styles.memorizationOptionTextActive,
                      ]}
                    >
                      {THEME_DISPLAY_NAMES[themeKey]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </ScreenScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  summaryBand: {
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  summaryAvatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    overflow: "hidden",
    textAlign: "center",
    lineHeight: 48,
    fontSize: 28,
  },
  summaryText: {
    flex: 1,
    minWidth: 0,
  },
  summaryKicker: {
    fontSize: 12,
    color: "#d1d5db",
    fontWeight: "700",
    textTransform: "uppercase",
  },
  summaryName: {
    fontSize: 20,
    color: "#ffffff",
    fontWeight: "900",
    marginTop: 2,
  },
  summarySubline: {
    fontSize: 12,
    color: "#d1d5db",
    fontWeight: "600",
    marginTop: 3,
  },
  presetGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  presetCard: {
    width: "48%",
    minHeight: 122,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 13,
    gap: 7,
  },
  presetCardActive: {
    backgroundColor: "#eff6ff",
    borderColor: "#bfdbfe",
  },
  presetTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  presetTitle: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "900",
  },
  presetTitleActive: {
    color: "#2563eb",
  },
  presetStatus: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "800",
  },
  presetDetail: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
  presetMeta: {
    color: "#475569",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 16,
    gap: 14,
    shadowColor: "#0f172a",
    shadowOpacity: 0.035,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: 15,
    color: "#111827",
    fontWeight: "900",
  },
  cardDetail: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
    lineHeight: 18,
  },
  goalOption: {
    width: "48%",
    minHeight: 76,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    padding: 12,
    justifyContent: "center",
    gap: 4,
  },
  goalOptionActive: {
    borderColor: "#fed7aa",
    backgroundColor: "#fff7ed",
  },
  goalOptionTitle: {
    color: "#111827",
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
  },
  goalOptionTitleActive: {
    color: "#ea580c",
  },
  goalOptionDetail: {
    color: "#64748b",
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
  },
  dateBlock: {
    gap: 9,
  },
  dateInput: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 12,
    color: "#111827",
    fontSize: 15,
    fontWeight: "800",
  },
  dateInputInvalid: {
    borderColor: "#fca5a5",
    backgroundColor: "#fff7f7",
  },
  goalChipActive: {
    backgroundColor: "#fff7ed",
    borderColor: "#fed7aa",
  },
  previewCard: {
    borderWidth: 1,
    borderColor: "#ccfbf1",
    borderRadius: 12,
    backgroundColor: "#f0fdfa",
    padding: 13,
    gap: 10,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  previewKicker: {
    color: "#0f766e",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  previewTitle: {
    color: "#111827",
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900",
  },
  previewIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  previewDetail: {
    color: "#0f766e",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
  },
  previewMilestones: {
    borderTopWidth: 1,
    borderTopColor: "#99f6e4",
    paddingTop: 4,
  },
  previewMilestoneRow: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  previewMilestoneTitle: {
    flex: 1,
    minWidth: 0,
    color: "#115e59",
    fontSize: 12,
    fontWeight: "900",
  },
  previewMilestoneDate: {
    flexShrink: 0,
    maxWidth: 126,
    color: "#111827",
    fontSize: 12,
    fontWeight: "900",
    textAlign: "right",
  },
  saveButton: {
    minHeight: 46,
    borderRadius: 10,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  saveButtonDisabled: {
    backgroundColor: "#cbd5e1",
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },
  statusText: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "700",
  },
  statusSaved: {
    color: "#16a34a",
  },
  statusSaving: {
    color: "#999999",
  },
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionButton: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: "#f8fafc",
  },
  optionText: {
    fontSize: 14,
    color: "#475569",
    fontWeight: "800",
  },
  memorizationOptionActive: {
    backgroundColor: "#f5f3ff",
    borderColor: "#c4b5fd",
  },
  memorizationOptionTextActive: {
    color: "#7c3aed",
  },
  practiceOptionActive: {
    backgroundColor: "#fffbeb",
    borderColor: "#fde68a",
  },
  practiceOptionTextActive: {
    color: "#b45309",
  },
  daysOptionActive: {
    backgroundColor: "#ecfeff",
    borderColor: "#a5f3fc",
  },
  daysOptionTextActive: {
    color: "#0891b2",
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 14,
  },
  stepButton: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },
  stepButtonDisabled: {
    backgroundColor: "#d1d5db",
  },
  stepButtonText: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 24,
  },
  stepValueWrap: {
    flex: 1,
    alignItems: "center",
  },
  stepValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  stepHint: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  toggleDivider: {
    height: 1,
    backgroundColor: "#e2e8f0",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  settingGroupLabel: {
    marginBottom: 8,
    fontSize: 12,
    color: "#64748b",
    fontWeight: "800",
    textTransform: "uppercase",
  },
  compactStepper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    overflow: "hidden",
  },
  compactStepButton: {
    width: 34,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  compactStepText: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "800",
  },
  compactValue: {
    minWidth: 44,
    textAlign: "center",
    color: "#111827",
    fontSize: 14,
    fontWeight: "800",
  },
});
