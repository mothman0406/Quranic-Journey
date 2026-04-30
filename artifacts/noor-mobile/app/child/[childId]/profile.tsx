import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChildProfileForm, type ChildProfileValues } from "@/src/components/child-profile-form";
import {
  ErrorState,
  LoadingState,
  ScreenContainer,
  ScreenHeader,
} from "@/src/components/screen-primitives";
import { apiFetch } from "@/src/lib/api";

type ChildProfile = {
  id: number;
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
};

function isValidChildId(childId: string | undefined) {
  return typeof childId === "string" && /^\d+$/.test(childId);
}

export default function ChildProfileScreen() {
  const { childId, intent } = useLocalSearchParams<{ childId: string; intent?: string }>();
  const router = useRouter();
  const [child, setChild] = useState<ChildProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const promptedDeleteRef = useRef(false);

  const loadChild = useCallback(async () => {
    if (!isValidChildId(childId)) {
      setError("This profile route is missing a valid child id.");
      return;
    }

    setError(null);
    try {
      const data = await apiFetch<ChildProfile>(`/api/children/${childId}`);
      setChild(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load profile.");
    }
  }, [childId]);

  useEffect(() => {
    loadChild();
  }, [loadChild]);

  async function saveChild(values: ChildProfileValues) {
    if (!isValidChildId(childId)) return;

    const updated = await apiFetch<ChildProfile>(`/api/children/${childId}`, {
      method: "PUT",
      body: JSON.stringify({
        name: values.name,
        age: values.age,
        avatarEmoji: values.avatarEmoji,
        practiceMinutesPerDay: values.practiceMinutesPerDay,
        memorizePagePerDay: values.memorizePagePerDay,
        reviewPagesPerDay: values.reviewPagesPerDay,
        readPagesPerDay: values.readPagesPerDay,
        hideStories: values.hideStories,
        hideDuas: values.hideDuas,
      }),
    });
    setChild(updated);
    router.replace({
      pathname: "/child/[childId]",
      params: { childId, name: updated.name },
    });
  }

  function confirmDelete() {
    if (!child || !isValidChildId(childId)) return;

    Alert.alert(
      `Delete ${child.name}?`,
      "This removes only this child profile and its progress from NoorPath. Other children stay untouched.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete profile",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            setError(null);
            try {
              await apiFetch<void>(`/api/children/${childId}`, {
                method: "DELETE",
              });
              router.replace("/");
            } catch (e) {
              setError(e instanceof Error ? e.message : "Failed to delete profile.");
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  }

  useEffect(() => {
    if (intent !== "delete" || !child || promptedDeleteRef.current) return;

    promptedDeleteRef.current = true;
    confirmDelete();
  }, [child, intent]);

  return (
    <ScreenContainer>
      <ScreenHeader title="Profile" onBack={() => router.back()} />

      {!child && !error ? (
        <LoadingState label="Loading profile" />
      ) : !child && error ? (
        <ErrorState message={error} onRetry={loadChild} />
      ) : child ? (
        <>
          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{error}</Text>
            </View>
          ) : null}
          <ChildProfileForm
            mode="edit"
            defaults={child}
            submitLabel="Save Profile"
            onSubmit={saveChild}
            footer={
              <Pressable
                style={[styles.deleteButton, deleting && styles.deleteButtonDisabled]}
                onPress={confirmDelete}
                disabled={deleting}
              >
                <Text style={styles.deleteButtonText}>
                  {deleting ? "Deleting..." : `Delete ${child.name}`}
                </Text>
              </Pressable>
            }
          />
        </>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  errorBanner: {
    margin: 16,
    marginBottom: 0,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
    padding: 12,
  },
  errorBannerText: {
    color: "#dc2626",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  deleteButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
    paddingVertical: 13,
    alignItems: "center",
  },
  deleteButtonDisabled: {
    opacity: 0.6,
  },
  deleteButtonText: {
    color: "#dc2626",
    fontSize: 15,
    fontWeight: "800",
  },
});
