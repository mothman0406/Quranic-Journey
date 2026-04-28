import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { apiFetch } from "@/src/lib/api";

type TargetKey = "memorizePagePerDay" | "reviewPagesPerDay" | "readPagesPerDay";

type ChildTargets = {
  id: number;
  name: string;
  avatarEmoji: string;
  memorizePagePerDay: number;
  reviewPagesPerDay: number;
  readPagesPerDay: number;
};

type TargetDefinition = {
  key: TargetKey;
  title: string;
  detail: string;
  color: string;
  soft: string;
  border: string;
  min: number;
  max: number;
  step: number;
  options: Array<{ value: number; label: string }>;
};

const TARGETS: TargetDefinition[] = [
  {
    key: "memorizePagePerDay",
    title: "New Memorization",
    detail: "How much new Quran to memorize each day.",
    color: "#2563eb",
    soft: "#eff6ff",
    border: "#bfdbfe",
    min: 0.25,
    max: 5,
    step: 0.25,
    options: [
      { value: 0.25, label: "0.25 page" },
      { value: 0.5, label: "0.5 page" },
      { value: 1, label: "1 page" },
      { value: 2, label: "2 pages" },
    ],
  },
  {
    key: "reviewPagesPerDay",
    title: "Review Amount",
    detail: "How much memorized Quran to review each day.",
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
    title: "Daily Reading",
    detail: "Pages to read from the Mushaf each day.",
    color: "#0f766e",
    soft: "#f0fdfa",
    border: "#99f6e4",
    min: 0,
    max: 10,
    step: 0.5,
    options: [
      { value: 0, label: "Off" },
      { value: 0.5, label: "0.5 page" },
      { value: 1, label: "1 page" },
      { value: 2, label: "2 pages" },
      { value: 3, label: "3 pages" },
      { value: 4, label: "4 pages" },
      { value: 5, label: "5 pages" },
    ],
  },
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeValue(value: number) {
  return Math.round(value * 100) / 100;
}

function formatPages(value: number) {
  if (value === 0) return "Off";
  const formatted = Number.isInteger(value) ? String(value) : String(value).replace(/\.0$/, "");
  return `${formatted} page${value === 1 ? "" : "s"}`;
}

function isSameValue(a: number, b: number) {
  return Math.abs(a - b) < 0.001;
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
          <Text style={[styles.iconText, { color: definition.color }]}>
            {definition.title.charAt(0)}
          </Text>
        </View>
        <View style={styles.titleBlock}>
          <Text style={styles.sectionTitle}>{definition.title}</Text>
          <Text style={styles.sectionDetail}>{definition.detail}</Text>
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
          <Text style={styles.stepHint}>
            {definition.step} page step
          </Text>
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
  const [child, setChild] = useState<ChildTargets | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<TargetKey | null>(null);
  const [savedKey, setSavedKey] = useState<TargetKey | null>(null);

  const loadChild = useCallback(async () => {
    setError(null);
    try {
      const data = await apiFetch<ChildTargets>(`/api/children/${childId}`);
      setChild(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load targets.");
    }
  }, [childId]);

  useEffect(() => {
    loadChild();
  }, [loadChild]);

  async function updateTarget(definition: TargetDefinition, nextValue: number) {
    const value = normalizeValue(clamp(nextValue, definition.min, definition.max));
    setSavingKey(definition.key);
    setSavedKey(null);
    setError(null);
    try {
      const updated = await apiFetch<ChildTargets>(`/api/children/${childId}`, {
        method: "PUT",
        body: JSON.stringify({ [definition.key]: value }),
      });
      setChild(updated);
      setSavedKey(definition.key);
      setTimeout(() => {
        setSavedKey((current) => (current === definition.key ? null : current));
      }, 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save target.");
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Targets</Text>
        <View style={styles.headerSpacer} />
      </View>

      {child === null && !error ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : error && child === null ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={loadChild}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : child ? (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.summaryBand}>
            <Text style={styles.summaryAvatar}>{child.avatarEmoji}</Text>
            <View style={styles.summaryText}>
              <Text style={styles.summaryKicker}>Daily targets</Text>
              <Text style={styles.summaryName}>{child.name || name || "Child"}</Text>
            </View>
          </View>

          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{error}</Text>
            </View>
          )}

          {TARGETS.map((definition) => (
            <TargetSection
              key={definition.key}
              definition={definition}
              value={child[definition.key]}
              saving={savingKey === definition.key}
              saved={savedKey === definition.key}
              onChange={updateTarget}
            />
          ))}
        </ScrollView>
      ) : null}
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
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  back: {
    fontSize: 16,
    color: "#2563eb",
    fontWeight: "500",
    width: 70,
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "700",
    color: "#111111",
  },
  headerSpacer: {
    width: 70,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 16,
  },
  content: {
    padding: 20,
    gap: 14,
    paddingBottom: 32,
  },
  summaryBand: {
    backgroundColor: "#111111",
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
    fontWeight: "700",
    marginTop: 2,
  },
  card: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 16,
    gap: 14,
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
  iconText: {
    fontSize: 18,
    fontWeight: "800",
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
  },
  sectionTitle: {
    fontSize: 16,
    color: "#111111",
    fontWeight: "700",
  },
  sectionDetail: {
    fontSize: 13,
    color: "#666666",
    marginTop: 2,
    lineHeight: 18,
  },
  statusText: {
    fontSize: 13,
    color: "#666666",
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
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: "#ffffff",
  },
  optionText: {
    fontSize: 14,
    color: "#444444",
    fontWeight: "700",
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 14,
  },
  stepButton: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: "#111111",
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
    color: "#111111",
  },
  stepHint: {
    fontSize: 12,
    color: "#666666",
    marginTop: 2,
  },
  errorBanner: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 10,
    padding: 12,
  },
  errorBannerText: {
    fontSize: 13,
    color: "#dc2626",
    fontWeight: "600",
  },
  errorText: {
    fontSize: 15,
    color: "#dc2626",
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
});
