import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { getJuzForMushafPage, MUSHAF_SURAHS } from "@/src/lib/mushaf";
import type { ApiPageVerse, ApiWord } from "@/src/lib/quran";

const BAYAAN_SURAH_DIVIDER_CHAR = "\uE000";
const BAYAAN_BASMALLAH = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";

const BAYAAN_QCF_SURAH_CODEPOINTS = [
  0xfc45, 0xfc46, 0xfc47, 0xfc4a, 0xfc4b, 0xfc4e, 0xfc4f, 0xfc51, 0xfc52,
  0xfc53, 0xfc55, 0xfc56, 0xfc58, 0xfc5a, 0xfc5b, 0xfc5c, 0xfc5d, 0xfc5e,
  0xfc61, 0xfc62, 0xfc64, 0xfb51, 0xfb52, 0xfb54, 0xfb55, 0xfb57, 0xfb58,
  0xfb5a, 0xfb5b, 0xfb5d, 0xfb5e, 0xfb60, 0xfb61, 0xfb63, 0xfb64, 0xfb66,
  0xfb67, 0xfb69, 0xfb6a, 0xfb6c, 0xfb6d, 0xfb6f, 0xfb70, 0xfb72, 0xfb73,
  0xfb75, 0xfb76, 0xfb78, 0xfb79, 0xfb7b, 0xfb7c, 0xfb7e, 0xfb7f, 0xfb81,
  0xfb82, 0xfb84, 0xfb85, 0xfb87, 0xfb88, 0xfb8a, 0xfb8b, 0xfb8d, 0xfb8e,
  0xfb90, 0xfb91, 0xfb93, 0xfb94, 0xfb96, 0xfb97, 0xfb99, 0xfb9a, 0xfb9c,
  0xfb9d, 0xfb9f, 0xfba0, 0xfba2, 0xfba3, 0xfba5, 0xfba6, 0xfba8, 0xfba9,
  0xfbab, 0xfbac, 0xfbae, 0xfbaf, 0xfbb1, 0xfbb2, 0xfbb4, 0xfbb5, 0xfbb7,
  0xfbb8, 0xfbba, 0xfbbb, 0xfbbd, 0xfbbe, 0xfbc0, 0xfbc1, 0xfbd3, 0xfbd4,
  0xfbd6, 0xfbd7, 0xfbd9, 0xfbda, 0xfbdc, 0xfbdd, 0xfbdf, 0xfbe0, 0xfbe2,
  0xfbe3, 0xfbe5, 0xfbe6, 0xfbe8, 0xfbe9, 0xfbeb,
] as const;

export type BayaanAyahTarget = {
  verseKey: string;
  surahNumber: number;
  ayahNumber: number;
  pageNumber: number;
  textUthmani: string;
};

type BayaanLineWord = {
  verseKey: string;
  surahNumber: number;
  ayahNumber: number;
  position: number;
  textUthmani: string;
  charType: string;
  lineNumber: number;
  verseText: string;
};

type BayaanLineGroup = {
  lineNumber: number;
  words: BayaanLineWord[];
};

function getBayaanSurahGlyph(surahNumber: number): string {
  const codepoint = BAYAAN_QCF_SURAH_CODEPOINTS[surahNumber - 1];
  return codepoint ? String.fromCodePoint(codepoint) : "";
}

function toArabicIndic(value: number) {
  const digits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  return String(value).replace(/\d/g, (digit) => digits[Number(digit)] ?? digit);
}

function parseVerseKey(verseKey: string) {
  const [surahRaw, ayahRaw] = verseKey.split(":");
  const surahNumber = Number(surahRaw);
  const ayahNumber = Number(ayahRaw);
  if (!Number.isInteger(surahNumber) || !Number.isInteger(ayahNumber)) return null;
  return { surahNumber, ayahNumber };
}

function wordKey(word: ApiWord, verseKey: string) {
  return `${verseKey}:${word.position}:${word.char_type_name}`;
}

function buildLineGroups(verses: ApiPageVerse[]): BayaanLineGroup[] {
  const byLine = new Map<number, BayaanLineWord[]>();

  for (const verse of verses) {
    const parsed = parseVerseKey(verse.verse_key);
    if (!parsed || !Array.isArray(verse.words)) continue;

    for (const word of verse.words) {
      if (!Number.isFinite(word.line_number)) continue;
      const words = byLine.get(word.line_number) ?? [];
      words.push({
        verseKey: verse.verse_key,
        surahNumber: parsed.surahNumber,
        ayahNumber: parsed.ayahNumber,
        position: word.position,
        textUthmani: word.text_uthmani,
        charType: word.char_type_name,
        lineNumber: word.line_number,
        verseText: verse.text_uthmani,
      });
      byLine.set(word.line_number, words);
    }
  }

  return Array.from(byLine.entries())
    .sort(([left], [right]) => left - right)
    .map(([lineNumber, words]) => ({ lineNumber, words }));
}

function lineStartsSurah(line: BayaanLineGroup, seenSurahIds: Set<number>) {
  const surahIds: number[] = [];
  for (const word of line.words) {
    if (word.ayahNumber !== 1 || seenSurahIds.has(word.surahNumber)) continue;
    seenSurahIds.add(word.surahNumber);
    surahIds.push(word.surahNumber);
  }
  return surahIds;
}

function targetFromWord(word: BayaanLineWord, pageNumber: number): BayaanAyahTarget {
  return {
    verseKey: word.verseKey,
    surahNumber: word.surahNumber,
    ayahNumber: word.ayahNumber,
    pageNumber,
    textUthmani: word.verseText,
  };
}

export function BayaanMushafPage({
  pageNumber,
  verses,
  width,
  height,
  loading,
  error,
  activeVerseKey,
  selectedVerseKeys,
  highlightedVerseKeys,
  hidden,
  modeHint,
  contentStyle,
  onPressPage,
  onPressWord,
  onLongPressWord,
  onPressEndMarker,
}: {
  pageNumber: number;
  verses: ApiPageVerse[];
  width: number;
  height: number;
  loading?: boolean;
  error?: string | null;
  activeVerseKey?: string | null;
  selectedVerseKeys?: Set<string>;
  highlightedVerseKeys?: Set<string>;
  hidden?: boolean;
  modeHint?: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  onPressPage?: () => void;
  onPressWord?: (target: BayaanAyahTarget) => void;
  onLongPressWord?: (target: BayaanAyahTarget) => void;
  onPressEndMarker?: (target: BayaanAyahTarget) => void;
}) {
  const lineGroups = useMemo(() => buildLineGroups(verses), [verses]);
  const fontSize = Math.max(11.5, Math.min(18, width * 0.035));
  const activeLineCount = lineGroups.length;
  const densePage = activeLineCount >= 12;
  const seenSurahIds = new Set<number>();

  return (
    <View style={[styles.shell, { width, height }]}>
      <View style={styles.header}>
        <Text style={styles.headerText} numberOfLines={1}>
          JUZ {getJuzForMushafPage(pageNumber)}
        </Text>
        <Text style={styles.headerPageText}>HAFS</Text>
      </View>

      <Pressable
        disabled={!onPressPage}
        onPress={onPressPage}
        style={[styles.page, contentStyle]}
        accessibilityRole={onPressPage ? "button" : undefined}
      >
        {loading ? (
          <View style={styles.stateWrap}>
            <ActivityIndicator color="#8f7d56" />
            <Text style={styles.stateText}>Loading page {pageNumber}</Text>
          </View>
        ) : error ? (
          <View style={styles.stateWrap}>
            <Ionicons name="cloud-offline-outline" size={24} color="#b91c1c" />
            <Text style={styles.errorTitle}>Page could not load</Text>
            <Text style={styles.stateText}>{error}</Text>
          </View>
        ) : lineGroups.length === 0 ? (
          <View style={styles.stateWrap}>
            <Text style={styles.stateText}>No page text loaded.</Text>
          </View>
        ) : (
          <View style={[styles.lines, densePage && styles.linesDense]}>
            {lineGroups.map((line) => {
              const newSurahs = lineStartsSurah(line, seenSurahIds);
              const lineIsCentered = line.words.length <= 7;
              return (
                <React.Fragment key={`line-${line.lineNumber}`}>
                  {newSurahs.map((surahNumber) => (
                    <React.Fragment key={`surah-${surahNumber}`}>
                      <BayaanSurahBanner surahNumber={surahNumber} />
                      {surahNumber !== 1 && surahNumber !== 9 ? (
                        <Text
                          style={[
                            styles.basmallah,
                            {
                              fontSize: fontSize * 0.92,
                              lineHeight: fontSize * 1.55,
                            },
                          ]}
                        >
                          {BAYAAN_BASMALLAH}
                        </Text>
                      ) : null}
                    </React.Fragment>
                  ))}
                  <View
                    style={[
                      styles.line,
                      {
                        minHeight: fontSize * 1.82,
                        justifyContent: lineIsCentered ? "center" : "space-between",
                      },
                    ]}
                  >
                    {line.words.map((word) => {
                      const target = targetFromWord(word, pageNumber);
                      const active = activeVerseKey === word.verseKey;
                      const selected = selectedVerseKeys?.has(word.verseKey) ?? false;
                      const highlighted = highlightedVerseKeys?.has(word.verseKey) ?? false;
                      const isEndMarker = word.charType === "end";

                      if (isEndMarker) {
                        return (
                          <Pressable
                            key={wordKey(
                              {
                                position: word.position,
                                text_uthmani: word.textUthmani,
                                char_type_name: word.charType,
                                line_number: word.lineNumber,
                              },
                              word.verseKey,
                            )}
                            onPress={() => onPressEndMarker?.(target)}
                            disabled={!onPressEndMarker}
                            style={({ pressed }) => [
                              styles.endMarker,
                              {
                                width: fontSize * 1.62,
                                height: fontSize * 1.62,
                              },
                              active && styles.endMarkerActive,
                              selected && styles.endMarkerSelected,
                              pressed && styles.endMarkerPressed,
                            ]}
                            accessibilityRole={onPressEndMarker ? "button" : undefined}
                            accessibilityLabel={`Ayah ${word.ayahNumber}`}
                          >
                            <Text
                              style={[
                                styles.endMarkerText,
                                {
                                  fontSize: fontSize * 0.55,
                                  lineHeight: fontSize * 0.75,
                                },
                                (active || selected) && styles.endMarkerTextActive,
                              ]}
                            >
                              {toArabicIndic(word.ayahNumber)}
                            </Text>
                          </Pressable>
                        );
                      }

                      return (
                        <Pressable
                          key={wordKey(
                            {
                              position: word.position,
                              text_uthmani: word.textUthmani,
                              char_type_name: word.charType,
                              line_number: word.lineNumber,
                            },
                            word.verseKey,
                          )}
                          disabled={!onPressWord && !onLongPressWord}
                          onPress={() => onPressWord?.(target)}
                          onLongPress={() => onLongPressWord?.(target)}
                          delayLongPress={420}
                          style={({ pressed }) => [
                            styles.wordWrap,
                            active && styles.wordWrapActive,
                            selected && styles.wordWrapSelected,
                            highlighted && styles.wordWrapHighlighted,
                            pressed && styles.wordWrapPressed,
                          ]}
                          accessibilityRole={onPressWord || onLongPressWord ? "button" : undefined}
                        >
                          <Text
                            style={[
                              styles.word,
                              {
                                fontSize,
                                lineHeight: fontSize * 1.72,
                              },
                            ]}
                          >
                            {word.textUthmani}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </React.Fragment>
              );
            })}
          </View>
        )}

        {hidden ? (
          <View style={styles.blindOverlay}>
            <Ionicons name="eye-off-outline" size={28} color="#ffffff" />
            <Text style={styles.blindOverlayTitle}>Blind mode</Text>
            <Text style={styles.blindOverlayText}>Tap to reveal this page when ready</Text>
          </View>
        ) : modeHint ? (
          <View pointerEvents="none" style={styles.modeHint}>
            {modeHint}
          </View>
        ) : null}
      </Pressable>

      <Text style={styles.footerText}>{pageNumber}</Text>
    </View>
  );
}

function BayaanSurahBanner({ surahNumber }: { surahNumber: number }) {
  const surah = MUSHAF_SURAHS[surahNumber - 1];
  const glyph = getBayaanSurahGlyph(surahNumber);

  return (
    <View style={styles.surahBanner}>
      <Text style={styles.surahDivider}>{BAYAAN_SURAH_DIVIDER_CHAR}</Text>
      <Text style={[styles.surahGlyph, !glyph && styles.surahFallbackText]}>
        {glyph || surah?.name || `Surah ${surahNumber}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#d7ccb2",
    backgroundColor: "#fffdf8",
    shadowColor: "#785c22",
    shadowOpacity: 0.12,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  header: {
    minHeight: 30,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#d7ccb2",
    backgroundColor: "#f8f1df",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerText: {
    fontSize: 10,
    letterSpacing: 1.8,
    color: "#8f7d56",
    fontWeight: "900",
  },
  headerPageText: {
    fontSize: 10,
    letterSpacing: 1.8,
    color: "#8f7d56",
    fontWeight: "900",
  },
  page: {
    flex: 1,
    backgroundColor: "#fffdf8",
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  lines: {
    flex: 1,
    justifyContent: "center",
    gap: 1,
  },
  linesDense: {
    justifyContent: "space-between",
  },
  line: {
    width: "100%",
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
  },
  wordWrap: {
    borderRadius: 3,
    paddingHorizontal: 1,
  },
  wordWrapActive: {
    backgroundColor: "rgba(190, 161, 92, 0.2)",
  },
  wordWrapSelected: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
  },
  wordWrapHighlighted: {
    backgroundColor: "rgba(250, 204, 21, 0.2)",
  },
  wordWrapPressed: {
    backgroundColor: "rgba(37, 99, 235, 0.12)",
  },
  word: {
    color: "#1f1a13",
    fontFamily: "BayaanDigitalKhatt",
    writingDirection: "rtl",
    includeFontPadding: false,
  },
  endMarker: {
    borderRadius: 999,
    borderWidth: 1.3,
    borderColor: "#bea15c",
    backgroundColor: "#fffaf0",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  endMarkerActive: {
    backgroundColor: "rgba(190, 161, 92, 0.3)",
    borderColor: "#9c7b31",
  },
  endMarkerSelected: {
    backgroundColor: "rgba(16, 185, 129, 0.18)",
    borderColor: "#047857",
  },
  endMarkerPressed: {
    backgroundColor: "rgba(37, 99, 235, 0.16)",
  },
  endMarkerText: {
    color: "#866622",
    fontWeight: "800",
    textAlign: "center",
  },
  endMarkerTextActive: {
    color: "#5f4615",
  },
  basmallah: {
    color: "#1f1a13",
    fontFamily: "BayaanDigitalKhatt",
    textAlign: "center",
    writingDirection: "rtl",
    includeFontPadding: false,
    marginBottom: 1,
  },
  surahBanner: {
    minHeight: 28,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    marginBottom: 0,
  },
  surahDivider: {
    position: "absolute",
    fontFamily: "BayaanQuranCommon",
    fontSize: 31,
    lineHeight: 34,
    color: "#cdbb8b",
    includeFontPadding: false,
  },
  surahGlyph: {
    fontFamily: "BayaanSurahQCF",
    fontSize: 18,
    lineHeight: 22,
    color: "#8f7d56",
    includeFontPadding: false,
  },
  surahFallbackText: {
    fontFamily: undefined,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  stateWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 8,
  },
  stateText: {
    fontSize: 12,
    color: "#8f7d56",
    fontWeight: "700",
    textAlign: "center",
  },
  errorTitle: {
    fontSize: 14,
    color: "#b91c1c",
    fontWeight: "900",
  },
  blindOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(17,24,39,0.92)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 8,
  },
  blindOverlayTitle: {
    fontSize: 18,
    color: "#ffffff",
    fontWeight: "900",
  },
  blindOverlayText: {
    fontSize: 13,
    color: "#d1d5db",
    fontWeight: "700",
    textAlign: "center",
  },
  modeHint: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    minHeight: 34,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  footerText: {
    minHeight: 28,
    paddingTop: 7,
    textAlign: "center",
    borderTopWidth: 1,
    borderTopColor: "#d7ccb2",
    backgroundColor: "#f8f1df",
    color: "#8f7d56",
    fontSize: 11,
    letterSpacing: 2.4,
    fontWeight: "900",
  },
});
