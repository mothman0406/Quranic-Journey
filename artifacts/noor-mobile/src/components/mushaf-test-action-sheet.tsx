import React, { useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  fetchAyahTranslation,
  fetchAyahWithWords,
  fetchWordTranslation,
  type ApiWord,
} from "@/src/lib/quran";

type LoadState =
  | { status: "idle"; text: string | null; error: null }
  | { status: "loading"; text: string | null; error: null }
  | { status: "ready"; text: string; error: null }
  | { status: "error"; text: string | null; error: string };

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

type AudioWordPointer = {
  surah: number;
  ayah: number;
  position: number;
};

type AyahWordInfo = {
  position: number;
  text: string;
};

type MushafTestActionSheetProps = {
  visible: boolean;
  onClose: () => void;
  surah: number;
  ayah: number;
  surahName: string;
  currentAudioWord?: AudioWordPointer | null;
  isAudioActive?: boolean;
  onListen: () => void;
  onPlayFromHere: () => void;
  onBookmark: () => void;
  onViewInFullMushaf: () => void;
  onCopy: () => void;
};

function buildAyahWords(words: ApiWord[]): AyahWordInfo[] {
  return words
    .filter((word) => word.char_type_name === "word")
    .map((word, index) => ({
      position: Number.isFinite(word.position) && word.position > 0
        ? word.position
        : index + 1,
      text: word.text_uthmani,
    }))
    .filter((word) => word.text.trim().length > 0);
}

function ActionRow({
  label,
  icon,
  color,
  onPress,
}: {
  label: string;
  icon: IoniconName;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.actionRow} onPress={onPress} accessibilityRole="button">
      <Ionicons name={icon} size={20} color={color} />
      <Text style={styles.actionRowText}>{label}</Text>
    </Pressable>
  );
}

export function MushafTestActionSheet({
  visible,
  onClose,
  surah,
  ayah,
  surahName,
  currentAudioWord,
  onListen,
  onPlayFromHere,
  onBookmark,
  onViewInFullMushaf,
  onCopy,
}: MushafTestActionSheetProps) {
  const verseKey = `${surah}:${ayah}`;
  const [ayahTextState, setAyahTextState] = useState<LoadState>({
    status: "idle",
    text: null,
    error: null,
  });
  const [translationState, setTranslationState] = useState<LoadState>({
    status: "idle",
    text: null,
    error: null,
  });
  const [ayahWords, setAyahWords] = useState<AyahWordInfo[]>([]);
  const [selectedTranslationWord, setSelectedTranslationWord] =
    useState<AyahWordInfo | null>(null);
  const [wordTranslationState, setWordTranslationState] = useState<LoadState>({
    status: "idle",
    text: null,
    error: null,
  });
  const [translationExpanded, setTranslationExpanded] = useState(false);
  const sheetOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(24)).current;
  const wordTranslationRequestRef = useRef(0);

  useEffect(() => {
    if (!visible) return;
    sheetOpacity.setValue(0);
    sheetTranslateY.setValue(24);
    Animated.parallel([
      Animated.timing(sheetOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [sheetOpacity, sheetTranslateY, visible]);

  useEffect(() => {
    if (!visible) return;

    let cancelled = false;
    setTranslationExpanded(false);
    setSelectedTranslationWord(null);
    setWordTranslationState({ status: "idle", text: null, error: null });
    setAyahWords([]);
    setAyahTextState({ status: "loading", text: null, error: null });
    setTranslationState({ status: "loading", text: null, error: null });

    fetchAyahWithWords(verseKey)
      .then((verse) => {
        if (cancelled) return;
        setAyahTextState({
          status: "ready",
          text: verse.text_uthmani,
          error: null,
        });
        setAyahWords(buildAyahWords(verse.words));
      })
      .catch((error) => {
        if (cancelled) return;
        setAyahTextState({
          status: "error",
          text: null,
          error: error instanceof Error ? error.message : "Ayah could not load.",
        });
      });

    fetchAyahTranslation(verseKey)
      .then((translation) => {
        if (cancelled) return;
        setTranslationState({
          status: "ready",
          text: translation,
          error: null,
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setTranslationState({
          status: "error",
          text: null,
          error: error instanceof Error ? error.message : "Translation could not load.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [verseKey, visible]);

  useEffect(() => {
    if (visible) return;
    wordTranslationRequestRef.current += 1;
    setSelectedTranslationWord(null);
    setWordTranslationState({ status: "idle", text: null, error: null });
  }, [visible]);

  const translationText = translationState.status === "ready" ? translationState.text : null;

  function handleArabicWordTap(word: AyahWordInfo) {
    const requestId = wordTranslationRequestRef.current + 1;
    wordTranslationRequestRef.current = requestId;
    setSelectedTranslationWord(word);
    setWordTranslationState({ status: "loading", text: null, error: null });

    fetchWordTranslation(surah, ayah, word.position)
      .then((text) => {
        if (wordTranslationRequestRef.current !== requestId) return;
        setWordTranslationState({ status: "ready", text, error: null });
      })
      .catch((error) => {
        if (wordTranslationRequestRef.current !== requestId) return;
        setWordTranslationState({
          status: "error",
          text: null,
          error: error instanceof Error ? error.message : "Translation could not load.",
        });
      });
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot} pointerEvents="box-none">
        <View style={styles.backdrop} pointerEvents="none" />
        <Animated.View
          style={[
            styles.sheet,
            {
              opacity: sheetOpacity,
              transform: [{ translateY: sheetTranslateY }],
            },
          ]}
        >
          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.headerRow}>
              <View style={styles.headerTextBlock}>
                <Text style={styles.title}>{surahName} — Verse {ayah}</Text>
                <Text style={styles.subtitle}>Quran {verseKey}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close ayah actions"
                style={styles.closeButton}
                onPress={onClose}
              >
                <Ionicons name="close" size={19} color="#6b7280" />
              </Pressable>
            </View>

            <View style={styles.arabicCard}>
              {ayahTextState.status === "loading" || ayahTextState.status === "idle" ? (
                <View style={styles.inlineLoadingRow}>
                  <ActivityIndicator size="small" color="#b45309" />
                  <Text style={styles.arabicStateText}>Loading ayah...</Text>
                </View>
              ) : ayahTextState.status === "error" ? (
                <Text style={styles.arabicStateText}>Ayah text could not load.</Text>
              ) : ayahWords.length > 0 ? (
                <View style={styles.arabicWordRow}>
                  {ayahWords.map((word, index) => {
                    const isAudioCurrent =
                      currentAudioWord?.surah === surah &&
                      currentAudioWord?.ayah === ayah &&
                      currentAudioWord?.position === word.position;
                    const isSelectedForTranslation =
                      selectedTranslationWord?.position === word.position;
                    return (
                      <Pressable
                        key={`${word.position}-${index}`}
                        style={styles.arabicWordPressable}
                        onPress={() => handleArabicWordTap(word)}
                        accessibilityRole="button"
                        accessibilityLabel={`Show translation for word ${word.position}`}
                      >
                        {isAudioCurrent ? (
                          <View style={styles.arabicWordAudioHighlight} pointerEvents="none" />
                        ) : null}
                        <Text
                          style={[
                            styles.arabicWordText,
                            isSelectedForTranslation && styles.arabicWordTextSelected,
                          ]}
                        >
                          {word.text}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.arabicText}>{ayahTextState.text}</Text>
              )}
            </View>

            {selectedTranslationWord ? (
              <View style={styles.wordTranslationPanel}>
                <View style={styles.wordTranslationHeader}>
                  <Text style={styles.wordTranslationLabel}>
                    Word {selectedTranslationWord.position}
                  </Text>
                  <Pressable
                    onPress={() => {
                      wordTranslationRequestRef.current += 1;
                      setSelectedTranslationWord(null);
                      setWordTranslationState({ status: "idle", text: null, error: null });
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Close word translation"
                  >
                    <Ionicons name="close" size={16} color="#6b7280" />
                  </Pressable>
                </View>
                {wordTranslationState.status === "loading" ||
                wordTranslationState.status === "idle" ? (
                  <Text style={styles.wordTranslationStateText}>Loading...</Text>
                ) : wordTranslationState.status === "error" ? (
                  <Text style={styles.wordTranslationErrorText}>
                    Translation could not load.
                  </Text>
                ) : (
                  <Text style={styles.wordTranslationText}>{wordTranslationState.text}</Text>
                )}
              </View>
            ) : null}

            <View style={styles.translationPanel}>
              <Text style={styles.translationLabel}>Saheeh International</Text>
              {translationState.status === "loading" || translationState.status === "idle" ? (
                <Text style={styles.translationStateText}>Loading translation...</Text>
              ) : translationState.status === "error" ? (
                <Text style={styles.translationErrorText}>Translation could not load.</Text>
              ) : (
                <>
                  <Text
                    style={styles.translationText}
                    numberOfLines={translationExpanded ? undefined : 8}
                  >
                    {translationText}
                  </Text>
                  {translationText && translationText.length > 300 ? (
                    <Pressable
                      style={styles.expandToggle}
                      onPress={() => setTranslationExpanded((value) => !value)}
                      accessibilityRole="button"
                    >
                      <Text style={styles.expandToggleText}>
                        {translationExpanded ? "Less" : "More"}
                      </Text>
                      <Ionicons
                        name={translationExpanded ? "chevron-up" : "chevron-down"}
                        size={14}
                        color="#2563eb"
                      />
                    </Pressable>
                  ) : null}
                </>
              )}
            </View>

            <View style={styles.actionList}>
              <ActionRow
                label="Listen"
                icon="play-circle-outline"
                color="#2563eb"
                onPress={onListen}
              />
              <ActionRow
                label="Play from here"
                icon="play-skip-forward-outline"
                color="#2563eb"
                onPress={onPlayFromHere}
              />
              <ActionRow
                label="Bookmark"
                icon="bookmark-outline"
                color="#b45309"
                onPress={onBookmark}
              />
              <ActionRow
                label="View in Full Mushaf"
                icon="reader-outline"
                color="#0369a1"
                onPress={onViewInFullMushaf}
              />
              <ActionRow
                label="Copy"
                icon="copy-outline"
                color="#475569"
                onPress={onCopy}
              />
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.38)",
  },
  sheet: {
    maxHeight: "88%",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    backgroundColor: "#ffffff",
    paddingTop: 28,
    paddingHorizontal: 20,
    paddingBottom: 34,
  },
  sheetScroll: {
    flexGrow: 0,
  },
  sheetContent: {
    gap: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  headerTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900",
    color: "#111827",
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    color: "#6b7280",
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  arabicCard: {
    minHeight: 96,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fde68a",
    backgroundColor: "#fffbeb",
    paddingVertical: 22,
    paddingHorizontal: 18,
    justifyContent: "center",
  },
  arabicWordRow: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 6,
  },
  arabicWordPressable: {
    position: "relative",
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  arabicWordText: {
    fontFamily: "AmiriQuran",
    fontSize: 25,
    lineHeight: 42,
    color: "#111827",
    textAlign: "right",
    writingDirection: "rtl",
  },
  arabicWordTextSelected: {
    color: "#1d4ed8",
  },
  arabicWordAudioHighlight: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(34, 197, 94, 0.35)",
    borderRadius: 4,
  },
  arabicText: {
    fontFamily: "AmiriQuran",
    fontSize: 25,
    lineHeight: 42,
    color: "#111827",
    textAlign: "right",
    writingDirection: "rtl",
  },
  inlineLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  arabicStateText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    color: "#92400e",
    textAlign: "center",
  },
  wordTranslationPanel: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dbeafe",
    backgroundColor: "#eff6ff",
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 6,
  },
  wordTranslationHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  wordTranslationLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: "#1e40af",
    textTransform: "uppercase",
    letterSpacing: 0,
  },
  wordTranslationText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#1e293b",
    fontWeight: "600",
  },
  wordTranslationStateText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1e40af",
  },
  wordTranslationErrorText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#b91c1c",
  },
  translationPanel: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    padding: 14,
  },
  translationLabel: {
    marginBottom: 8,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "900",
    color: "#64748b",
    textTransform: "uppercase",
  },
  translationText: {
    fontSize: 15,
    lineHeight: 26,
    color: "#374151",
    fontWeight: "600",
  },
  translationStateText: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "700",
    color: "#64748b",
  },
  translationErrorText: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "700",
    color: "#dc2626",
  },
  expandToggle: {
    alignSelf: "flex-start",
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  expandToggleText: {
    fontSize: 13,
    color: "#2563eb",
    fontWeight: "800",
  },
  actionList: {
    gap: 8,
  },
  actionRow: {
    width: "100%",
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  actionRowText: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
  },
});
