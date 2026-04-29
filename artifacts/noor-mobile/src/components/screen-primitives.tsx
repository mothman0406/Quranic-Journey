import type { ComponentProps, ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

type IconName = ComponentProps<typeof Ionicons>["name"];

export function ScreenContainer({ children }: { children: ReactNode }) {
  return <View style={styles.container}>{children}</View>;
}

export function ScreenHeader({
  title,
  onBack,
  right,
  backLabel = "← Back",
  sideWidth = 70,
}: {
  title: string;
  onBack: () => void;
  right?: ReactNode;
  backLabel?: string;
  sideWidth?: number;
}) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} style={[styles.headerSide, { width: sideWidth }]}>
        <Text style={styles.backText}>{backLabel}</Text>
      </Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={[styles.headerRight, { width: sideWidth }]}>{right}</View>
    </View>
  );
}

export function ScreenScrollView({
  children,
  contentContainerStyle,
}: {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
    >
      {children}
    </ScrollView>
  );
}

export function ScreenCenter({ children }: { children: ReactNode }) {
  return <View style={styles.center}>{children}</View>;
}

export function LoadingState({ label }: { label?: string }) {
  return (
    <ScreenCenter>
      <ActivityIndicator size="large" color="#2563eb" />
      {label ? <Text style={styles.loadingLabel}>{label}</Text> : null}
    </ScreenCenter>
  );
}

export function EmptyState({
  title,
  detail,
}: {
  title: string;
  detail?: string;
}) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {detail ? <Text style={styles.emptyDetail}>{detail}</Text> : null}
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <ScreenCenter>
      <Text style={styles.errorText}>{message}</Text>
      {onRetry ? (
        <Pressable style={styles.primaryButton} onPress={onRetry}>
          <Text style={styles.primaryButtonText}>Retry</Text>
        </Pressable>
      ) : null}
    </ScreenCenter>
  );
}

export function InlineError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.inlineError}>
      <Text style={styles.inlineErrorText}>{message}</Text>
      {onRetry ? (
        <Pressable style={styles.inlineErrorButton} onPress={onRetry}>
          <Text style={styles.inlineErrorButtonText}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

export function CardGroup({ children }: { children: ReactNode }) {
  return <View style={styles.cardGroup}>{children}</View>;
}

export function BadgePill({
  label,
  color = "#666666",
  backgroundColor = "#f9fafb",
  borderColor = "#e5e7eb",
  dotColor,
}: {
  label: string;
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  dotColor?: string;
}) {
  return (
    <View style={[styles.pill, { backgroundColor, borderColor }]}>
      {dotColor ? <View style={[styles.pillDot, { backgroundColor: dotColor }]} /> : null}
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

export function ListRow({
  title,
  detail,
  iconName,
  iconColor,
  onPress,
  disabled,
  trailing,
  showChevron = true,
}: {
  title: string;
  detail?: string;
  iconName: IconName;
  iconColor: string;
  onPress?: () => void;
  disabled?: boolean;
  trailing?: ReactNode;
  showChevron?: boolean;
}) {
  return (
    <Pressable
      style={[styles.row, disabled && styles.rowDisabled]}
      disabled={disabled || !onPress}
      onPress={onPress}
    >
      <View style={[styles.rowIcon, { backgroundColor: `${iconColor}14` }]}>
        <Ionicons name={iconName} size={21} color={iconColor} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        {detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}
      </View>
      {trailing ?? (showChevron ? <Ionicons name="chevron-forward" size={18} color="#9ca3af" /> : null)}
    </Pressable>
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
    backgroundColor: "#ffffff",
  },
  headerSide: {
    alignItems: "flex-start",
  },
  headerRight: {
    alignItems: "flex-end",
  },
  backText: {
    fontSize: 16,
    color: "#2563eb",
    fontWeight: "500",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "700",
    color: "#111111",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 14,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 16,
  },
  loadingLabel: {
    fontSize: 13,
    color: "#666666",
    fontWeight: "600",
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 72,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 17,
    color: "#111111",
    fontWeight: "700",
    textAlign: "center",
  },
  emptyDetail: {
    fontSize: 14,
    color: "#666666",
    textAlign: "center",
    lineHeight: 20,
    marginTop: 6,
  },
  errorText: {
    fontSize: 15,
    color: "#dc2626",
    textAlign: "center",
  },
  primaryButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
  inlineError: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  inlineErrorText: {
    color: "#dc2626",
    fontSize: 13,
    fontWeight: "600",
  },
  inlineErrorButton: {
    alignSelf: "flex-start",
    backgroundColor: "#dc2626",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  inlineErrorButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  sectionLabel: {
    color: "#666666",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  cardGroup: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    overflow: "hidden",
  },
  row: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  rowDisabled: {
    opacity: 0.62,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111111",
  },
  rowDetail: {
    fontSize: 13,
    color: "#666666",
    marginTop: 2,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pillText: {
    fontSize: 11,
    fontWeight: "800",
  },
});
