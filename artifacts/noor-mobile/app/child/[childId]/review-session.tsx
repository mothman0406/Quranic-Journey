import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Audio } from "expo-av";
import { mushafPageUrl } from "@/src/lib/mushaf";
import { ayahAudioUrl } from "@/src/lib/audio";
import { findReciter } from "@/src/lib/reciters";
import { submitReview } from "@/src/lib/reviews";

const PAGE_ASPECT_RATIO = 1.45;

const QUALITY_OPTIONS: { rating: number; label: string; color: string }[] = [
  { rating: 0, label: "Forgot completely", color: "#dc2626" },
  { rating: 1, label: "Serious errors", color: "#dc2626" },
  { rating: 2, label: "Correct with difficulty", color: "#ea580c" },
  { rating: 3, label: "Correct with hesitation", color: "#ea580c" },
  { rating: 4, label: "Good", color: "#16a34a" },
  { rating: 5, label: "Excellent", color: "#16a34a" },
];

export default function ReviewSession() {
  const router = useRouter();
  const {
    childId,
    surahId,
    surahNumber,
    surahName,
    ayahStart,
    ayahEnd,
    pageStart,
    pageEnd,
  } = useLocalSearchParams<{
    childId: string;
    surahId: string;
    surahNumber: string;
    surahName: string;
    ayahStart: string;
    ayahEnd: string;
    pageStart: string;
    pageEnd: string;
    chunkIndex: string;
    chunkCount: string;
  }>();

  const ayahStartN = Number(ayahStart);
  const ayahEndN = Number(ayahEnd);
  const pageStartN = Number(pageStart);
  const pageEndN = Number(pageEnd);
  const surahNumberN = Number(surahNumber);
  const surahIdN = Number(surahId);
  const totalAyahs = ayahEndN - ayahStartN + 1;

  const screenW = Dimensions.get("window").width;
  const imageWidth = screenW - 32;
  const imageHeight = imageWidth * PAGE_ASPECT_RATIO;

  const soundRef = useRef<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAyah, setCurrentAyah] = useState(ayahStartN);
  const currentAyahRef = useRef(ayahStartN);

  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync();
    };
  }, []);

  async function playAyah(ayahNumber: number) {
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    const url = ayahAudioUrl(findReciter("husary"), surahNumberN, ayahNumber);
    const { sound } = await Audio.Sound.createAsync(
      { uri: url },
      { shouldPlay: true },
      (status) => {
        if (!status.isLoaded) return;
        if (status.didJustFinish) {
          const next = currentAyahRef.current + 1;
          if (next > ayahEndN) {
            setIsPlaying(false);
            setCurrentAyah(ayahStartN);
            currentAyahRef.current = ayahStartN;
          } else {
            setCurrentAyah(next);
            currentAyahRef.current = next;
            playAyah(next);
          }
        }
      },
    );
    soundRef.current = sound;
    setIsPlaying(true);
  }

  async function handlePlayPause() {
    if (isPlaying) {
      await soundRef.current?.pauseAsync();
      setIsPlaying(false);
    } else {
      await playAyah(currentAyah);
    }
  }

  async function handleSubmit() {
    if (selectedRating === null) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitReview(childId, surahIdN, selectedRating);
      setRatingModalVisible(false);
      Alert.alert("Review saved!", undefined, [{ text: "OK", onPress: () => router.back() }]);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  const headerTitle = `${surahName || `Surah ${surahNumberN}`} · Ayahs ${ayahStartN}–${ayahEndN}`;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {headerTitle}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {pageStartN === pageEndN ? (
          <Image
            source={{ uri: mushafPageUrl(pageStartN) }}
            style={[styles.pageImage, { width: imageWidth, height: imageHeight }]}
            resizeMode="contain"
          />
        ) : (
          <>
            <Image
              source={{ uri: mushafPageUrl(pageStartN) }}
              style={[styles.pageImage, { width: imageWidth, height: imageHeight }]}
              resizeMode="contain"
            />
            <Image
              source={{ uri: mushafPageUrl(pageEndN) }}
              style={[styles.pageImage, { width: imageWidth, height: imageHeight }]}
              resizeMode="contain"
            />
          </>
        )}

        <View style={styles.audioControls}>
          <Pressable style={styles.playButton} onPress={handlePlayPause}>
            <Text style={styles.playButtonText}>{isPlaying ? "⏸ Pause" : "▶ Play"}</Text>
          </Pressable>
          <Text style={styles.verseCounter}>
            Verse {currentAyah - ayahStartN + 1} of {totalAyahs}
          </Text>
        </View>

        <Pressable style={styles.finishButton} onPress={() => setRatingModalVisible(true)}>
          <Text style={styles.finishButtonText}>Finish &amp; Rate</Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={ratingModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRatingModalVisible(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setRatingModalVisible(false)} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>How did it go?</Text>
          {QUALITY_OPTIONS.map((opt) => (
            <Pressable
              key={opt.rating}
              style={[
                styles.ratingRow,
                selectedRating === opt.rating && styles.ratingRowSelected,
              ]}
              onPress={() => setSelectedRating(opt.rating)}
            >
              <Text style={[styles.ratingNumber, { color: opt.color }]}>{opt.rating}</Text>
              <Text style={styles.ratingLabel}>{opt.label}</Text>
              {selectedRating === opt.rating && (
                <Text style={styles.ratingCheck}>✓</Text>
              )}
            </Pressable>
          ))}
          {submitError && (
            <Text style={styles.submitError}>{submitError}</Text>
          )}
          <Pressable
            style={[
              styles.submitButton,
              (selectedRating === null || submitting) && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={selectedRating === null || submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitButtonText}>Submit</Text>
            )}
          </Pressable>
        </View>
      </Modal>
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
    width: 60,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "600",
    color: "#111111",
  },
  headerSpacer: {
    width: 60,
  },
  scrollContent: {
    padding: 16,
    alignItems: "center",
    gap: 20,
    paddingBottom: 40,
  },
  pageImage: {
    borderRadius: 8,
    backgroundColor: "#f9fafb",
  },
  audioControls: {
    alignItems: "center",
    gap: 10,
  },
  playButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 10,
  },
  playButtonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
  },
  verseCounter: {
    fontSize: 14,
    color: "#555555",
  },
  finishButton: {
    width: "100%",
    backgroundColor: "#111111",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  finishButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    gap: 10,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111111",
    marginBottom: 6,
    textAlign: "center",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
  },
  ratingRowSelected: {
    borderColor: "#2563eb",
    backgroundColor: "#eff6ff",
  },
  ratingNumber: {
    fontSize: 18,
    fontWeight: "800",
    width: 24,
    textAlign: "center",
  },
  ratingLabel: {
    flex: 1,
    fontSize: 15,
    color: "#111111",
  },
  ratingCheck: {
    fontSize: 16,
    color: "#2563eb",
    fontWeight: "700",
  },
  submitError: {
    color: "#dc2626",
    fontSize: 13,
    textAlign: "center",
  },
  submitButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 4,
  },
  submitButtonDisabled: {
    backgroundColor: "#93c5fd",
  },
  submitButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
});
