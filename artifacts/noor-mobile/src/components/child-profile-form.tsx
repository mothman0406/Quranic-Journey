import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  InputAccessoryView,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { InlineError, SectionLabel } from "@/src/components/screen-primitives";
import { apiFetch } from "@/src/lib/api";

export type InitialSurahLevel = "very_strong" | "solid" | "learning" | "just_started";

export type ChildProfileValues = {
  name: string;
  age: number;
  gender: "male" | "female";
  avatarEmoji: string;
  practiceMinutesPerDay: number;
  memorizePagePerDay: number;
  reviewPagesPerDay: number;
  readPagesPerDay: number;
  hideStories: boolean;
  hideDuas: boolean;
  initialSurahSetups: Array<{
    surahId: number;
    level: InitialSurahLevel;
    knownAyahCount: number | null;
  }>;
};

export type ChildProfileDefaults = Partial<Omit<ChildProfileValues, "initialSurahSetups">> & {
  initialSurahSetups?: ChildProfileValues["initialSurahSetups"];
};

type SurahSummary = {
  id: number;
  number: number;
  nameArabic: string;
  nameTransliteration: string;
  nameTranslation: string;
  verseCount: number;
  difficulty: "beginner" | "intermediate" | "advanced";
};

type SurahsResponse = { surahs: SurahSummary[] };

type SelectedSurah = {
  level: InitialSurahLevel;
  knownAyahCount: number;
};

const INPUT_ACCESSORY_ID = "child-profile-form-inputs";
const AVATARS = ["⭐", "🌙", "🌸", "🕌", "📖", "✨", "🦋", "🌿"];

const STRENGTHS: Array<{
  value: InitialSurahLevel;
  label: string;
  detail: string;
  color: string;
  soft: string;
}> = [
  {
    value: "very_strong",
    label: "Very strong",
    detail: "Review later",
    color: "#0f766e",
    soft: "#f0fdfa",
  },
  {
    value: "solid",
    label: "Solid",
    detail: "Review soon",
    color: "#2563eb",
    soft: "#eff6ff",
  },
  {
    value: "learning",
    label: "Learning",
    detail: "Needs practice",
    color: "#ea580c",
    soft: "#fff7ed",
  },
  {
    value: "just_started",
    label: "Just started",
    detail: "Keep in progress",
    color: "#be123c",
    soft: "#fff1f2",
  },
];

const PAGE_TARGETS: Array<{
  key: "memorizePagePerDay" | "reviewPagesPerDay" | "readPagesPerDay";
  title: string;
  min: number;
  max: number;
  step: number;
  presets: number[];
  color: string;
}> = [
  {
    key: "memorizePagePerDay",
    title: "Memorize",
    min: 0.25,
    max: 5,
    step: 0.25,
    presets: [0.25, 0.5, 1, 2],
    color: "#2563eb",
  },
  {
    key: "reviewPagesPerDay",
    title: "Review",
    min: 0.5,
    max: 20,
    step: 0.5,
    presets: [1, 2, 4, 10],
    color: "#ea580c",
  },
  {
    key: "readPagesPerDay",
    title: "Read",
    min: 0,
    max: 10,
    step: 0.5,
    presets: [0, 0.5, 1, 2, 5],
    color: "#0f766e",
  },
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeNumber(value: number) {
  return Math.round(value * 100) / 100;
}

function formatPages(value: number) {
  if (value === 0) return "Off";
  const label = Number.isInteger(value) ? String(value) : String(value).replace(/\.0$/, "");
  return `${label} page${value === 1 ? "" : "s"}`;
}

function buildInitialSelected(
  setups: ChildProfileValues["initialSurahSetups"] | undefined,
  surahs: SurahSummary[],
) {
  const byId = new Map(surahs.map((surah) => [surah.id, surah]));
  const selected: Record<number, SelectedSurah> = {};

  for (const setup of setups ?? []) {
    const surah = byId.get(setup.surahId);
    if (!surah) continue;
    selected[setup.surahId] = {
      level: setup.level,
      knownAyahCount: clamp(
        setup.knownAyahCount ?? surah.verseCount,
        1,
        surah.verseCount,
      ),
    };
  }

  return selected;
}

function defaultsToValues(defaults?: ChildProfileDefaults): ChildProfileValues {
  return {
    name: defaults?.name ?? "",
    age: defaults?.age ?? 7,
    gender: defaults?.gender ?? "male",
    avatarEmoji: defaults?.avatarEmoji ?? "⭐",
    practiceMinutesPerDay: defaults?.practiceMinutesPerDay ?? 20,
    memorizePagePerDay: defaults?.memorizePagePerDay ?? 1,
    reviewPagesPerDay: defaults?.reviewPagesPerDay ?? 2,
    readPagesPerDay: defaults?.readPagesPerDay ?? 0,
    hideStories: defaults?.hideStories ?? false,
    hideDuas: defaults?.hideDuas ?? false,
    initialSurahSetups: defaults?.initialSurahSetups ?? [],
  };
}

export function ChildProfileForm({
  mode,
  defaults,
  submitLabel,
  onSubmit,
  footer,
}: {
  mode: "create" | "edit";
  defaults?: ChildProfileDefaults;
  submitLabel: string;
  onSubmit: (values: ChildProfileValues) => Promise<void>;
  footer?: ReactNode;
}) {
  const [values, setValues] = useState<ChildProfileValues>(() => defaultsToValues(defaults));
  const [ageText, setAgeText] = useState(String(defaults?.age ?? 7));
  const [practiceText, setPracticeText] = useState(String(defaults?.practiceMinutesPerDay ?? 20));
  const [surahs, setSurahs] = useState<SurahSummary[]>([]);
  const [selectedSurahs, setSelectedSurahs] = useState<Record<number, SelectedSurah>>({});
  const [rangeFromId, setRangeFromId] = useState<number | null>(null);
  const [rangeToId, setRangeToId] = useState<number | null>(null);
  const [loadingSurahs, setLoadingSurahs] = useState(mode === "create");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValues(defaultsToValues(defaults));
    setAgeText(String(defaults?.age ?? 7));
    setPracticeText(String(defaults?.practiceMinutesPerDay ?? 20));
  }, [defaults]);

  async function loadSurahs() {
    if (mode !== "create") return;

    setLoadingSurahs(true);
    setLoadError(null);
    try {
      const data = await apiFetch<SurahsResponse>("/api/surahs");
      setSurahs(data.surahs);
      setSelectedSurahs(buildInitialSelected(defaults?.initialSurahSetups, data.surahs));
      setRangeFromId(data.surahs[0]?.id ?? null);
      setRangeToId(data.surahs[0]?.id ?? null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load surahs.");
    } finally {
      setLoadingSurahs(false);
    }
  }

  useEffect(() => {
    loadSurahs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const selectedCount = useMemo(
    () => Object.keys(selectedSurahs).length,
    [selectedSurahs],
  );

  function patch(next: Partial<ChildProfileValues>) {
    setValues((current) => ({ ...current, ...next }));
  }

  function updateNumericField(
    key: "memorizePagePerDay" | "reviewPagesPerDay" | "readPagesPerDay",
    value: number,
  ) {
    const definition = PAGE_TARGETS.find((target) => target.key === key);
    if (!definition) return;
    patch({ [key]: normalizeNumber(clamp(value, definition.min, definition.max)) });
  }

  function toggleSurah(surah: SurahSummary) {
    Keyboard.dismiss();
    setSelectedSurahs((current) => {
      const next = { ...current };
      if (next[surah.id]) {
        delete next[surah.id];
      } else {
        next[surah.id] = {
          level: "solid",
          knownAyahCount: surah.verseCount,
        };
      }
      return next;
    });
  }

  function updateSelectedSurah(surah: SurahSummary, nextSetup: Partial<SelectedSurah>) {
    Keyboard.dismiss();
    setSelectedSurahs((current) => {
      const existing = current[surah.id];
      if (!existing) return current;
      return {
        ...current,
        [surah.id]: {
          ...existing,
          ...nextSetup,
          knownAyahCount: clamp(
            nextSetup.knownAyahCount ?? existing.knownAyahCount,
            1,
            surah.verseCount,
          ),
        },
      };
    });
  }

  function applyRangeSelection() {
    Keyboard.dismiss();
    if (rangeFromId == null || rangeToId == null) return;

    const fromIndex = surahs.findIndex((surah) => surah.id === rangeFromId);
    const toIndex = surahs.findIndex((surah) => surah.id === rangeToId);
    if (fromIndex === -1 || toIndex === -1) return;

    const start = Math.min(fromIndex, toIndex);
    const end = Math.max(fromIndex, toIndex);
    const inRange = surahs.slice(start, end + 1);

    setSelectedSurahs((current) => {
      const next = { ...current };
      for (const surah of inRange) {
        if (!next[surah.id]) {
          next[surah.id] = {
            level: "solid",
            knownAyahCount: surah.verseCount,
          };
        }
      }
      return next;
    });
  }

  function clearSelectedSurahs() {
    Keyboard.dismiss();
    setSelectedSurahs({});
  }

  async function handleSubmit() {
    Keyboard.dismiss();
    const age = Number(ageText);
    const practiceMinutes = Number(practiceText);

    if (!values.name.trim()) {
      setFormError("Add the child's name before saving.");
      return;
    }

    if (!Number.isFinite(age) || age < 3 || age > 18) {
      setFormError("Age must be between 3 and 18.");
      return;
    }

    if (!Number.isFinite(practiceMinutes) || practiceMinutes < 5 || practiceMinutes > 120) {
      setFormError("Practice time must be between 5 and 120 minutes.");
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      await onSubmit({
        ...values,
        name: values.name.trim(),
        age: Math.round(age),
        practiceMinutesPerDay: Math.round(practiceMinutes),
        initialSurahSetups: Object.entries(selectedSurahs).map(([surahId, setup]) => ({
          surahId: Number(surahId),
          level: setup.level,
          knownAyahCount: setup.knownAyahCount,
        })),
      });
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.formShell}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      {formError ? <InlineError message={formError} /> : null}

      <SectionLabel>Profile</SectionLabel>
      <View style={styles.card}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          value={values.name}
          onChangeText={(name) => patch({ name })}
          placeholder="Child name"
          placeholderTextColor="#9ca3af"
          style={styles.input}
          autoCapitalize="words"
          returnKeyType="done"
          blurOnSubmit
          onSubmitEditing={Keyboard.dismiss}
          inputAccessoryViewID={Platform.OS === "ios" ? INPUT_ACCESSORY_ID : undefined}
        />

        <View style={styles.twoColumn}>
          <View style={styles.flexField}>
            <Text style={styles.label}>Age</Text>
            <TextInput
              value={ageText}
              onChangeText={setAgeText}
              keyboardType="number-pad"
              style={styles.input}
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={Keyboard.dismiss}
              inputAccessoryViewID={Platform.OS === "ios" ? INPUT_ACCESSORY_ID : undefined}
            />
          </View>
          <View style={styles.flexField}>
            <Text style={styles.label}>Avatar</Text>
            <View style={styles.avatarRow}>
              {AVATARS.slice(0, 4).map((emoji) => (
                <Pressable
                  key={emoji}
                  style={[
                    styles.avatarButton,
                    values.avatarEmoji === emoji && styles.avatarButtonActive,
                  ]}
                  onPress={() => patch({ avatarEmoji: emoji })}
                >
                  <Text style={styles.avatarText}>{emoji}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.avatarRow}>
          {AVATARS.slice(4).map((emoji) => (
            <Pressable
              key={emoji}
              style={[
                styles.avatarButton,
                values.avatarEmoji === emoji && styles.avatarButtonActive,
              ]}
              onPress={() => patch({ avatarEmoji: emoji })}
            >
              <Text style={styles.avatarText}>{emoji}</Text>
            </Pressable>
          ))}
        </View>

        {mode === "create" ? (
          <>
            <Text style={styles.label}>Gender</Text>
            <View style={styles.segmentRow}>
              {(["male", "female"] as const).map((gender) => (
                <Pressable
                  key={gender}
                  style={[
                    styles.segment,
                    values.gender === gender && styles.segmentActive,
                  ]}
                  onPress={() => patch({ gender })}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      values.gender === gender && styles.segmentTextActive,
                    ]}
                  >
                    {gender === "male" ? "Boy" : "Girl"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}
      </View>

      <SectionLabel>Daily rhythm</SectionLabel>
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={styles.rowText}>
            <Text style={styles.cardTitle}>Practice time</Text>
            <Text style={styles.cardDetail}>Used for planning and goal estimates.</Text>
          </View>
          <TextInput
            value={practiceText}
            onChangeText={setPracticeText}
            keyboardType="number-pad"
            style={styles.minutesInput}
            returnKeyType="done"
            blurOnSubmit
            onSubmitEditing={Keyboard.dismiss}
            inputAccessoryViewID={Platform.OS === "ios" ? INPUT_ACCESSORY_ID : undefined}
          />
        </View>
        <View style={styles.chipRow}>
          {[10, 15, 20, 30, 45].map((minutes) => {
            const active = Number(practiceText) === minutes;
            return (
              <Pressable
                key={minutes}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setPracticeText(String(minutes))}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {minutes} min
                </Text>
              </Pressable>
            );
          })}
        </View>

        {PAGE_TARGETS.map((target) => {
          const value = values[target.key];
          return (
            <View key={target.key} style={styles.targetBlock}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>{target.title}</Text>
                <Text style={[styles.targetValue, { color: target.color }]}>
                  {formatPages(value)}
                </Text>
              </View>
              <View style={styles.chipRow}>
                {target.presets.map((preset) => {
                  const active = Math.abs(value - preset) < 0.001;
                  return (
                    <Pressable
                      key={preset}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => updateNumericField(target.key, preset)}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {formatPages(preset)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.stepperRow}>
                <Pressable
                  style={styles.stepButton}
                  onPress={() => updateNumericField(target.key, value - target.step)}
                >
                  <Text style={styles.stepButtonText}>-</Text>
                </Pressable>
                <Text style={styles.stepperHint}>{target.step} page step</Text>
                <Pressable
                  style={styles.stepButton}
                  onPress={() => updateNumericField(target.key, value + target.step)}
                >
                  <Text style={styles.stepButtonText}>+</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>

      <SectionLabel>Visibility</SectionLabel>
      <View style={styles.card}>
        <View style={styles.toggleRow}>
          <View style={styles.rowText}>
            <Text style={styles.cardTitle}>Stories</Text>
            <Text style={styles.cardDetail}>Show story suggestions on child surfaces.</Text>
          </View>
          <Switch
            value={!values.hideStories}
            onValueChange={(enabled) => patch({ hideStories: !enabled })}
            trackColor={{ false: "#e5e7eb", true: "#bfdbfe" }}
            thumbColor={!values.hideStories ? "#2563eb" : "#f9fafb"}
          />
        </View>
        <View style={styles.toggleRow}>
          <View style={styles.rowText}>
            <Text style={styles.cardTitle}>Du'aas</Text>
            <Text style={styles.cardDetail}>Show du'aa suggestions and practice links.</Text>
          </View>
          <Switch
            value={!values.hideDuas}
            onValueChange={(enabled) => patch({ hideDuas: !enabled })}
            trackColor={{ false: "#e5e7eb", true: "#99f6e4" }}
            thumbColor={!values.hideDuas ? "#0f766e" : "#f9fafb"}
          />
        </View>
      </View>

      {mode === "create" ? (
        <>
          <SectionLabel>Already memorized</SectionLabel>
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <View style={styles.rowText}>
                <Text style={styles.cardTitle}>Prior surahs</Text>
                <Text style={styles.cardDetail}>
                  Pick known surahs so reviews and next work start in the right place.
                </Text>
              </View>
              <Text style={styles.selectedCount}>{selectedCount} selected</Text>
            </View>

            {loadingSurahs ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#2563eb" />
                <Text style={styles.cardDetail}>Loading surahs</Text>
              </View>
            ) : loadError ? (
              <InlineError message={loadError} onRetry={loadSurahs} />
            ) : (
              <>
                <View style={styles.rangeBox}>
                  <View style={styles.rowBetween}>
                    <View style={styles.rowText}>
                      <Text style={styles.rangeTitle}>Range selection</Text>
                      <Text style={styles.cardDetail}>
                        Add every surah between two choices in learning order.
                      </Text>
                    </View>
                    <Pressable
                      style={[
                        styles.applyRangeButton,
                        (rangeFromId == null || rangeToId == null) && styles.applyRangeButtonDisabled,
                      ]}
                      onPress={applyRangeSelection}
                      disabled={rangeFromId == null || rangeToId == null}
                    >
                      <Text style={styles.applyRangeText}>Apply</Text>
                    </Pressable>
                  </View>

                  <Text style={styles.rangeLabel}>From</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={styles.rangeChipRow}
                  >
                    {surahs.map((surah) => {
                      const active = rangeFromId === surah.id;
                      return (
                        <Pressable
                          key={`from-${surah.id}`}
                          style={[styles.rangeChip, active && styles.rangeChipActive]}
                          onPress={() => {
                            Keyboard.dismiss();
                            setRangeFromId(surah.id);
                          }}
                        >
                          <Text style={[styles.rangeChipText, active && styles.rangeChipTextActive]}>
                            {surah.number}. {surah.nameTransliteration}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  <Text style={styles.rangeLabel}>To</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={styles.rangeChipRow}
                  >
                    {surahs.map((surah) => {
                      const active = rangeToId === surah.id;
                      return (
                        <Pressable
                          key={`to-${surah.id}`}
                          style={[styles.rangeChip, active && styles.rangeChipActive]}
                          onPress={() => {
                            Keyboard.dismiss();
                            setRangeToId(surah.id);
                          }}
                        >
                          <Text style={[styles.rangeChipText, active && styles.rangeChipTextActive]}>
                            {surah.number}. {surah.nameTransliteration}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  {selectedCount > 0 ? (
                    <Pressable style={styles.clearSelectionButton} onPress={clearSelectedSurahs}>
                      <Text style={styles.clearSelectionText}>Clear all selected surahs</Text>
                    </Pressable>
                  ) : null}
                </View>

                <View style={styles.surahList}>
                  {surahs.map((surah) => {
                    const selected = selectedSurahs[surah.id];
                    const strength = selected
                      ? STRENGTHS.find((item) => item.value === selected.level)
                      : null;
                    return (
                      <View
                        key={surah.id}
                        style={[styles.surahCard, selected && styles.surahCardActive]}
                      >
                        <Pressable
                          style={styles.surahTopRow}
                          onPress={() => toggleSurah(surah)}
                        >
                          <View style={styles.checkBox}>
                            <Text style={styles.checkMark}>{selected ? "✓" : ""}</Text>
                          </View>
                          <View style={styles.rowText}>
                            <Text style={styles.surahName}>
                              {surah.nameTransliteration}
                            </Text>
                            <Text style={styles.cardDetail}>
                              Surah {surah.number} · {surah.verseCount} ayahs
                            </Text>
                          </View>
                        </Pressable>

                        {selected ? (
                          <View style={styles.surahSetup}>
                            <View style={styles.rowBetween}>
                              <Text style={styles.cardTitle}>Known ayahs</Text>
                              <Text style={styles.targetValue}>
                                {selected.knownAyahCount}/{surah.verseCount}
                              </Text>
                            </View>
                            <View style={styles.stepperRow}>
                              <Pressable
                                style={styles.stepButton}
                                onPress={() =>
                                  updateSelectedSurah(surah, {
                                    knownAyahCount: selected.knownAyahCount - 1,
                                  })
                                }
                              >
                                <Text style={styles.stepButtonText}>-</Text>
                              </Pressable>
                              <Pressable
                                style={styles.fullButton}
                                onPress={() =>
                                  updateSelectedSurah(surah, {
                                    knownAyahCount: surah.verseCount,
                                  })
                                }
                              >
                                <Text style={styles.fullButtonText}>Full surah</Text>
                              </Pressable>
                              <Pressable
                                style={styles.stepButton}
                                onPress={() =>
                                  updateSelectedSurah(surah, {
                                    knownAyahCount: selected.knownAyahCount + 1,
                                  })
                                }
                              >
                                <Text style={styles.stepButtonText}>+</Text>
                              </Pressable>
                            </View>
                            <View style={styles.strengthGrid}>
                              {STRENGTHS.map((item) => {
                                const active = selected.level === item.value;
                                return (
                                  <Pressable
                                    key={item.value}
                                    style={[
                                      styles.strengthChip,
                                      active && {
                                        backgroundColor: item.soft,
                                        borderColor: item.color,
                                      },
                                    ]}
                                    onPress={() =>
                                      updateSelectedSurah(surah, { level: item.value })
                                    }
                                  >
                                    <Text
                                      style={[
                                        styles.strengthLabel,
                                        active && { color: item.color },
                                      ]}
                                    >
                                      {item.label}
                                    </Text>
                                    <Text style={styles.strengthDetail}>
                                      {item.detail}
                                    </Text>
                                  </Pressable>
                                );
                              })}
                            </View>
                            {strength ? (
                              <Text style={[styles.setupHint, { color: strength.color }]}>
                                Starts as {strength.label.toLowerCase()} with{" "}
                                {selected.knownAyahCount} known ayah
                                {selected.knownAyahCount === 1 ? "" : "s"}.
                              </Text>
                            ) : null}
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </>
            )}
          </View>
        </>
      ) : null}

      {footer}
    </ScrollView>
    <View style={styles.stickyFooter}>
      <Pressable
        style={[styles.submitButton, saving && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={saving}
      >
        <Text style={styles.submitButtonText}>
          {saving ? "Saving..." : submitLabel}
        </Text>
      </Pressable>
    </View>
    {Platform.OS === "ios" ? (
      <InputAccessoryView nativeID={INPUT_ACCESSORY_ID}>
        <View style={styles.keyboardAccessory}>
          <Pressable style={styles.keyboardDoneButton} onPress={Keyboard.dismiss}>
            <Text style={styles.keyboardDoneText}>Done</Text>
          </Pressable>
        </View>
      </InputAccessoryView>
    ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  formShell: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 126,
  },
  card: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 16,
    gap: 12,
    shadowColor: "#0f172a",
    shadowOpacity: 0.035,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  label: {
    fontSize: 13,
    color: "#475569",
    fontWeight: "800",
  },
  input: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 16,
    color: "#111827",
    fontWeight: "600",
  },
  minutesInput: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 72,
    textAlign: "center",
    fontSize: 16,
    color: "#111827",
    fontWeight: "800",
  },
  twoColumn: {
    flexDirection: "row",
    gap: 12,
  },
  flexField: {
    flex: 1,
    gap: 8,
  },
  avatarRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  avatarButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarButtonActive: {
    borderColor: "#2563eb",
    backgroundColor: "#eff6ff",
  },
  avatarText: {
    fontSize: 24,
  },
  segmentRow: {
    flexDirection: "row",
    gap: 8,
  },
  segment: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
  },
  segmentActive: {
    backgroundColor: "#eff6ff",
    borderColor: "#2563eb",
  },
  segmentText: {
    fontSize: 14,
    color: "#475569",
    fontWeight: "800",
  },
  segmentTextActive: {
    color: "#2563eb",
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  rowText: {
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
    lineHeight: 18,
    marginTop: 2,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: "#eff6ff",
    borderColor: "#2563eb",
  },
  chipText: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "800",
  },
  chipTextActive: {
    color: "#2563eb",
  },
  targetBlock: {
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 13,
    gap: 10,
  },
  targetValue: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "900",
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stepButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },
  stepButtonText: {
    color: "#ffffff",
    fontSize: 20,
    lineHeight: 22,
    fontWeight: "800",
  },
  stepperHint: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    color: "#64748b",
    fontWeight: "700",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  selectedCount: {
    fontSize: 13,
    color: "#2563eb",
    fontWeight: "800",
  },
  rangeBox: {
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  rangeTitle: {
    color: "#1d4ed8",
    fontSize: 14,
    fontWeight: "800",
  },
  applyRangeButton: {
    borderRadius: 10,
    backgroundColor: "#2563eb",
    paddingVertical: 9,
    paddingHorizontal: 13,
  },
  applyRangeButtonDisabled: {
    opacity: 0.45,
  },
  applyRangeText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  rangeLabel: {
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: "800",
  },
  rangeChipRow: {
    gap: 8,
    paddingRight: 2,
  },
  rangeChip: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  rangeChipActive: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  rangeChipText: {
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: "800",
  },
  rangeChipTextActive: {
    color: "#ffffff",
  },
  clearSelectionButton: {
    alignSelf: "flex-start",
    paddingVertical: 4,
  },
  clearSelectionText: {
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: "800",
    textDecorationLine: "underline",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  surahList: {
    gap: 10,
  },
  surahCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  surahCardActive: {
    borderColor: "#bfdbfe",
    backgroundColor: "#f8fbff",
  },
  surahTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  checkMark: {
    color: "#2563eb",
    fontSize: 16,
    fontWeight: "900",
  },
  surahName: {
    fontSize: 15,
    color: "#111827",
    fontWeight: "900",
  },
  surahSetup: {
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 10,
    gap: 10,
  },
  fullButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center",
  },
  fullButtonText: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "800",
  },
  strengthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  strengthChip: {
    width: "48%",
    minHeight: 58,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    padding: 9,
  },
  strengthLabel: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "800",
  },
  strengthDetail: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  setupHint: {
    fontSize: 12,
    fontWeight: "700",
  },
  submitButton: {
    backgroundColor: "#111827",
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
  },
  submitButtonDisabled: {
    backgroundColor: "#9ca3af",
  },
  submitButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  stickyFooter: {
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  keyboardAccessory: {
    alignItems: "flex-end",
    borderTopWidth: 1,
    borderTopColor: "#d1d5db",
    backgroundColor: "#f9fafb",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  keyboardDoneButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  keyboardDoneText: {
    color: "#2563eb",
    fontSize: 16,
    fontWeight: "800",
  },
});
