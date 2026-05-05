import React from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

export type ReviewActionSheetAyahTarget = {
  verseKey: string;
  surahNumber: number;
  ayahNumber: number;
  pageNumber: number;
  textUthmani: string;
};

type ReviewActionSheetProps = {
  target: ReviewActionSheetAyahTarget | null;
  translation?: string | null;
  onClose: () => void;
  onTranslation: () => void;
  onViewInFullMushaf: () => void;
  onBookmark: () => void;
  onCopy: () => void;
};

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
      <View style={[styles.actionIcon, { backgroundColor: `${color}17` }]}>
        <Ionicons name={icon} size={19} color={color} />
      </View>
      <Text style={styles.actionRowText}>{label}</Text>
      <Ionicons name="chevron-forward" size={17} color="#94a3b8" />
    </Pressable>
  );
}

export function ReviewActionSheet({
  target,
  translation,
  onClose,
  onTranslation,
  onViewInFullMushaf,
  onBookmark,
  onCopy,
}: ReviewActionSheetProps) {
  const visible = target !== null;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>Quran {target?.verseKey ?? ""}</Text>
              <Text style={styles.title}>Ayah actions</Text>
            </View>
            <Pressable style={styles.closeButton} onPress={onClose} accessibilityRole="button">
              <Ionicons name="close" size={19} color="#475569" />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {target?.textUthmani ? (
              <View style={styles.arabicBox}>
                <Text style={styles.arabicText}>{target.textUthmani}</Text>
              </View>
            ) : null}

            {translation ? (
              <Text style={styles.translationText} numberOfLines={3}>
                {translation}
              </Text>
            ) : null}

            <View style={styles.actionList}>
              <ActionRow
                label="Translation"
                icon="language-outline"
                color="#2563eb"
                onPress={onTranslation}
              />
              <ActionRow
                label="View in Full Mushaf"
                icon="reader-outline"
                color="#0369a1"
                onPress={onViewInFullMushaf}
              />
              <ActionRow
                label="Bookmark"
                icon="bookmark-outline"
                color="#b45309"
                onPress={onBookmark}
              />
              <ActionRow
                label="Copy"
                icon="copy-outline"
                color="#475569"
                onPress={onCopy}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.34)",
  },
  sheet: {
    maxHeight: "78%",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: "#fffdf8",
    borderWidth: 1,
    borderColor: "#eadfca",
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 18,
    shadowColor: "#0f172a",
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -6 },
    elevation: 10,
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#d6c7aa",
    marginBottom: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  eyebrow: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "800",
  },
  title: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "900",
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  scrollContent: {
    paddingBottom: 8,
    gap: 12,
  },
  arabicBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#eadfca",
    backgroundColor: "#fffaf0",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  arabicText: {
    color: "#1f2937",
    fontSize: 24,
    lineHeight: 42,
    textAlign: "right",
    writingDirection: "rtl",
  },
  translationText: {
    color: "#475569",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700",
  },
  actionList: {
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
  },
  actionRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#eef2f7",
  },
  actionIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  actionRowText: {
    flex: 1,
    color: "#1f2937",
    fontSize: 15,
    fontWeight: "800",
  },
});
