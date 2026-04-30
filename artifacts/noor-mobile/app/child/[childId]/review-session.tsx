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
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Audio } from "expo-av";
import { mushafPageUrl } from "@/src/lib/mushaf";
import { ayahAudioUrl } from "@/src/lib/audio";
import { DEFAULT_RECITER_ID, findReciter, RECITERS } from "@/src/lib/reciters";
import { submitReview } from "@/src/lib/reviews";
import { loadProfileSettings } from "@/src/lib/settings";

const PAGE_ASPECT_RATIO = 1.45;
const PLAYBACK_RATES = [0.75, 0.85, 1.0, 1.15, 1.25, 1.5] as const;

const QUALITY_OPTIONS: { rating: number; label: string; color: string }[] = [
  { rating: 0, label: "Forgot completely", color: "#dc2626" },
  { rating: 1, label: "Serious errors", color: "#dc2626" },
  { rating: 2, label: "Correct with difficulty", color: "#ea580c" },
  { rating: 3, label: "Correct with hesitation", color: "#ea580c" },
  { rating: 4, label: "Good", color: "#16a34a" },
  { rating: 5, label: "Excellent", color: "#16a34a" },
];

function formatRate(rate: number) {
  return rate === 1 ? "1x" : `${rate}x`;
}

function reciterShortName(fullName: string) {
  const parts = fullName.split(" ").filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1]! : fullName;
}

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
    reviewDate,
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
    reviewDate?: string;
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
  const currentAyahRef = useRef(ayahStartN);
  const playbackRateRef = useRef<number>(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [currentAyah, setCurrentAyah] = useState(ayahStartN);
  const [reciterId, setReciterId] = useState(DEFAULT_RECITER_ID);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const selectedReciter = findReciter(reciterId);

  useEffect(() => {
    currentAyahRef.current = currentAyah;
  }, [currentAyah]);

  useEffect(() => {
    playbackRateRef.current = playbackRate;
    soundRef.current?.setRateAsync(playbackRate, true).catch(() => {
      // Best-effort; some unloaded sound states reject rate updates.
    });
  }, [playbackRate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const profileSettings = await loadProfileSettings(childId);
      if (!cancelled) {
        setReciterId(profileSettings.reciterId);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [childId]);

  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    }).catch(() => {
      // Non-fatal on simulator or when the audio session is temporarily busy.
    });
  }, []);

  useEffect(() => {
    if (soundRef.current) {
      void stopAudio();
    }
  }, [reciterId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync();
    };
  }, []);

  async function stopAudio() {
    const sound = soundRef.current;
    soundRef.current = null;
    if (sound) {
      await sound.unloadAsync().catch(() => {});
    }
    setIsPlaying(false);
    setIsAudioLoading(false);
  }

  async function playAyah(ayahNumber: number) {
    setAudioError(null);
    setIsAudioLoading(true);

    const previousSound = soundRef.current;
    soundRef.current = null;
    if (previousSound) {
      await previousSound.unloadAsync().catch(() => {});
    }

    try {
      const url = ayahAudioUrl(findReciter(reciterId), surahNumberN, ayahNumber);
      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: false, volume: 1.0 },
        (status) => {
          if (!status.isLoaded) return;
          if (status.didJustFinish) {
            const next = currentAyahRef.current + 1;
            if (next > ayahEndN) {
              void stopAudio();
              setCurrentAyah(ayahStartN);
              currentAyahRef.current = ayahStartN;
            } else {
              setCurrentAyah(next);
              currentAyahRef.current = next;
              void playAyah(next);
            }
          }
        },
      );
      soundRef.current = sound;
      await sound.setRateAsync(playbackRateRef.current, true).catch(() => {});
      await sound.playAsync();
      setIsPlaying(true);
    } catch (e) {
      setAudioError(e instanceof Error ? e.message : "Audio could not start");
      setIsPlaying(false);
    } finally {
      setIsAudioLoading(false);
    }
  }

  async function handlePlayPause() {
    if (isAudioLoading) return;
    if (isPlaying) {
      await soundRef.current?.pauseAsync().catch(() => {});
      setIsPlaying(false);
    } else {
      await playAyah(currentAyah);
    }
  }

  function openRatingModal() {
    void stopAudio();
    setSubmitError(null);
    setSelectedRating(null);
    setRatingModalVisible(true);
  }

  async function handleSubmit() {
    if (selectedRating === null) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitReview(childId, surahIdN, selectedRating, reviewDate);
      await stopAudio();
      setRatingModalVisible(false);
      Alert.alert("Review saved!", undefined, [{ text: "OK", onPress: () => router.back() }]);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  const headerTitle = `${surahName || `Surah ${surahNumberN}`} · Ayahs ${ayahStartN}-${ayahEndN}`;
  const pageLabel =
    pageStartN === pageEndN ? `Page ${pageStartN}` : `Pages ${pageStartN}-${pageEndN}`;
  const currentAyahIndex = Math.max(1, currentAyah - ayahStartN + 1);

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

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.sessionCard}>
          <View style={styles.sessionIcon}>
            <Ionicons name="book-outline" size={20} color="#2563eb" />
          </View>
          <View style={styles.sessionText}>
            <Text style={styles.sessionKicker}>Review range</Text>
            <Text style={styles.sessionTitle}>{surahName || `Surah ${surahNumberN}`}</Text>
            <Text style={styles.sessionDetail}>
              Ayahs {ayahStartN}-{ayahEndN} · {pageLabel}
            </Text>
          </View>
        </View>

        {audioError ? (
          <View style={styles.audioError}>
            <Ionicons name="alert-circle-outline" size={17} color="#dc2626" />
            <Text style={styles.audioErrorText}>{audioError}</Text>
          </View>
        ) : null}

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
      </ScrollView>

      <View style={styles.stickyControls}>
        <View style={styles.controlStatus}>
          <View>
            <Text style={styles.verseCounter}>
              Verse {currentAyahIndex} of {totalAyahs}
            </Text>
            <Text style={styles.audioMeta} numberOfLines={1}>
              {reciterShortName(selectedReciter.fullName)} · {formatRate(playbackRate)}
            </Text>
          </View>
          <Pressable style={styles.settingsButton} onPress={() => setSettingsOpen(true)}>
            <Ionicons name="options-outline" size={20} color="#2563eb" />
          </Pressable>
        </View>
        <View style={styles.controlButtons}>
          <Pressable
            style={[styles.playButton, isAudioLoading && styles.playButtonDisabled]}
            onPress={handlePlayPause}
            disabled={isAudioLoading}
          >
            {isAudioLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Ionicons
                  name={isPlaying ? "pause" : "play"}
                  size={18}
                  color="#ffffff"
                />
                <Text style={styles.playButtonText}>{isPlaying ? "Pause" : "Play"}</Text>
              </>
            )}
          </Pressable>
          <Pressable style={styles.finishButton} onPress={openRatingModal}>
            <Text style={styles.finishButtonText}>Rate</Text>
          </Pressable>
        </View>
      </View>

      <Modal
        visible={settingsOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSettingsOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setSettingsOpen(false)} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Review Audio</Text>

          <Text style={styles.settingLabel}>Playback speed</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillScroller}
          >
            {PLAYBACK_RATES.map((rate) => (
              <Pressable
                key={rate}
                onPress={() => setPlaybackRate(rate)}
                style={[
                  styles.ratePill,
                  playbackRate === rate && styles.ratePillSelected,
                ]}
              >
                <Text
                  style={[
                    styles.ratePillText,
                    playbackRate === rate && styles.ratePillTextSelected,
                  ]}
                >
                  {formatRate(rate)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.settingLabel}>Reciter</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillScroller}
          >
            {RECITERS.map((reciter) => (
              <Pressable
                key={reciter.id}
                onPress={() => setReciterId(reciter.id)}
                style={[
                  styles.reciterPill,
                  reciterId === reciter.id && styles.reciterPillSelected,
                ]}
              >
                <Text
                  style={[
                    styles.reciterPillText,
                    reciterId === reciter.id && styles.reciterPillTextSelected,
                  ]}
                >
                  {reciterShortName(reciter.fullName)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Pressable style={styles.sheetDoneButton} onPress={() => setSettingsOpen(false)}>
            <Text style={styles.sheetDoneText}>Done</Text>
          </Pressable>
        </View>
      </Modal>

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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    alignItems: "center",
    gap: 14,
    paddingBottom: 20,
  },
  sessionCard: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#eff6ff",
    borderColor: "#bfdbfe",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  sessionIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
  },
  sessionText: {
    flex: 1,
    gap: 2,
  },
  sessionKicker: {
    fontSize: 11,
    color: "#1d4ed8",
    fontWeight: "800",
    textTransform: "uppercase",
  },
  sessionTitle: {
    fontSize: 16,
    color: "#111111",
    fontWeight: "800",
  },
  sessionDetail: {
    fontSize: 12,
    color: "#555555",
    fontWeight: "600",
  },
  audioError: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  audioErrorText: {
    flex: 1,
    color: "#dc2626",
    fontSize: 12,
    fontWeight: "600",
  },
  pageImage: {
    borderRadius: 8,
    backgroundColor: "#f9fafb",
  },
  stickyControls: {
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 10,
  },
  controlStatus: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  verseCounter: {
    fontSize: 14,
    color: "#111111",
    fontWeight: "800",
  },
  audioMeta: {
    fontSize: 12,
    color: "#666666",
    fontWeight: "600",
    marginTop: 2,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  controlButtons: {
    flexDirection: "row",
    gap: 10,
  },
  playButton: {
    flex: 1,
    minHeight: 48,
    backgroundColor: "#2563eb",
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  playButtonDisabled: {
    backgroundColor: "#93c5fd",
  },
  playButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  finishButton: {
    flex: 1,
    minHeight: 48,
    backgroundColor: "#111111",
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  finishButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
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
  settingLabel: {
    fontSize: 15,
    color: "#111111",
    fontWeight: "700",
    marginTop: 4,
  },
  pillScroller: {
    gap: 8,
    paddingVertical: 4,
  },
  ratePill: {
    backgroundColor: "#f9fafb",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingVertical: 8,
    paddingHorizontal: 14,
    minWidth: 56,
    alignItems: "center",
  },
  ratePillSelected: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  ratePillText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111111",
  },
  ratePillTextSelected: {
    color: "#ffffff",
  },
  reciterPill: {
    backgroundColor: "#f9fafb",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  reciterPillSelected: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  reciterPillText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111111",
  },
  reciterPillTextSelected: {
    color: "#ffffff",
  },
  sheetDoneButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 4,
  },
  sheetDoneText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
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
