import type { ComponentProps, ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ScrollViewProps,
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
  refreshControl,
}: {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  refreshControl?: ScrollViewProps["refreshControl"];
}) {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
      refreshControl={refreshControl}
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
      <View style={styles.stateIcon}>
        <Ionicons name="leaf-outline" size={22} color="#0f766e" />
      </View>
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
      <View style={styles.errorCard}>
        <View style={styles.errorIcon}>
          <Ionicons name="alert-circle-outline" size={22} color="#dc2626" />
        </View>
        <Text style={styles.errorText}>{message}</Text>
      </View>
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
      <Ionicons name="alert-circle-outline" size={17} color="#dc2626" />
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
    backgroundColor: "#f8fafc",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#ffffff",
  },
  headerSide: {
    alignItems: "flex-start",
    minHeight: 38,
    justifyContent: "center",
  },
  headerRight: {
    alignItems: "flex-end",
    minHeight: 38,
    justifyContent: "center",
  },
  backText: {
    fontSize: 15,
    color: "#2563eb",
    fontWeight: "800",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 112,
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
    color: "#64748b",
    fontWeight: "600",
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 36,
    paddingHorizontal: 22,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#ffffff",
  },
  stateIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 17,
    color: "#111827",
    fontWeight: "800",
    textAlign: "center",
  },
  emptyDetail: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 20,
    marginTop: 6,
  },
  errorCard: {
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 12,
    backgroundColor: "#fff7f7",
    padding: 18,
    gap: 10,
  },
  errorIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#fee2e2",
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    fontSize: 15,
    color: "#dc2626",
    textAlign: "center",
    lineHeight: 20,
    fontWeight: "700",
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
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  inlineErrorText: {
    flex: 1,
    color: "#dc2626",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  inlineErrorButton: {
    alignSelf: "center",
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
    color: "#64748b",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    marginTop: 4,
  },
  cardGroup: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    overflow: "hidden",
  },
  row: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  rowDisabled: {
    opacity: 0.62,
  },
  rowIcon: {
    width: 38,
    height: 38,
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
    color: "#111827",
  },
  rowDetail: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
    lineHeight: 18,
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
