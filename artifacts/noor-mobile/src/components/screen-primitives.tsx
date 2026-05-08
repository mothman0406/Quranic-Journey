import { useMemo, type ComponentProps, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ScrollViewProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { hexToRgba, useAppTheme, type AppThemeColors } from "@/src/lib/app-theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

export function ScreenContainer({ children }: { children: ReactNode }) {
  const styles = usePrimitiveStyles();
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
  const styles = usePrimitiveStyles();
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} style={[styles.headerSide, { width: sideWidth }]}>
        <Text style={styles.backText}>{backLabel}</Text>
      </Pressable>
      <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
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
  const styles = usePrimitiveStyles();
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
  const styles = usePrimitiveStyles();
  return <View style={styles.center}>{children}</View>;
}

export function LoadingState({ label }: { label?: string }) {
  const styles = usePrimitiveStyles();
  const { colors } = useAppTheme();
  return (
    <ScreenCenter>
      <ActivityIndicator size="large" color={colors.primary} />
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
  const styles = usePrimitiveStyles();
  const { colors } = useAppTheme();
  return (
    <View style={styles.empty}>
      <View style={styles.stateIcon}>
        <Ionicons name="leaf-outline" size={22} color={colors.success} />
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
  const styles = usePrimitiveStyles();
  const { colors } = useAppTheme();
  return (
    <ScreenCenter>
      <View style={styles.errorCard}>
        <View style={styles.errorIcon}>
          <Ionicons name="alert-circle-outline" size={22} color={colors.danger} />
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
  const styles = usePrimitiveStyles();
  const { colors } = useAppTheme();
  return (
    <View style={styles.inlineError}>
      <Ionicons name="alert-circle-outline" size={17} color={colors.danger} />
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
  const styles = usePrimitiveStyles();
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

export function CardGroup({ children }: { children: ReactNode }) {
  const styles = usePrimitiveStyles();
  return <View style={styles.cardGroup}>{children}</View>;
}

export function BadgePill({
  label,
  color,
  backgroundColor,
  borderColor,
  dotColor,
}: {
  label: string;
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  dotColor?: string;
}) {
  const styles = usePrimitiveStyles();
  const { colors } = useAppTheme();
  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: backgroundColor ?? colors.surfaceSubtle,
          borderColor: borderColor ?? colors.border,
        },
      ]}
    >
      {dotColor ? <View style={[styles.pillDot, { backgroundColor: dotColor }]} /> : null}
      <Text style={[styles.pillText, { color: color ?? colors.textMuted }]}>{label}</Text>
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
  detailNumberOfLines,
  detailTextStyle,
}: {
  title: string;
  detail?: string;
  iconName: IconName;
  iconColor: string;
  onPress?: () => void;
  disabled?: boolean;
  trailing?: ReactNode;
  showChevron?: boolean;
  detailNumberOfLines?: number;
  detailTextStyle?: StyleProp<TextStyle>;
}) {
  const styles = usePrimitiveStyles();
  const { colors } = useAppTheme();
  return (
    <Pressable
      style={[styles.row, disabled && styles.rowDisabled]}
      disabled={disabled || !onPress}
      onPress={onPress}
    >
      <View style={[styles.rowIcon, { backgroundColor: hexToRgba(iconColor, 0.08) }]}>
        <Ionicons name={iconName} size={21} color={iconColor} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        {detail ? (
          <Text
            numberOfLines={detailNumberOfLines}
            style={[styles.rowDetail, detailTextStyle]}
          >
            {detail}
          </Text>
        ) : null}
      </View>
      {trailing ?? (showChevron ? <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} /> : null)}
    </Pressable>
  );
}

function usePrimitiveStyles() {
  const { colors } = useAppTheme();
  return useMemo(() => makePrimitiveStyles(colors), [colors]);
}

function makePrimitiveStyles(colors: AppThemeColors) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
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
    color: colors.primary,
    fontWeight: "800",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
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
    color: colors.textMuted,
    fontWeight: "600",
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 36,
    paddingHorizontal: 22,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  stateIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.successSoft,
    borderWidth: 1,
    borderColor: colors.successBorder,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 17,
    color: colors.text,
    fontWeight: "800",
    textAlign: "center",
  },
  emptyDetail: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
    marginTop: 6,
  },
  errorCard: {
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: 12,
    backgroundColor: colors.dangerSoft,
    padding: 18,
    gap: 10,
  },
  errorIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.dangerSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    fontSize: 15,
    color: colors.danger,
    textAlign: "center",
    lineHeight: 20,
    fontWeight: "700",
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  primaryButtonText: {
    color: colors.textInverse,
    fontSize: 15,
    fontWeight: "600",
  },
  inlineError: {
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  inlineErrorText: {
    flex: 1,
    color: colors.danger,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  inlineErrorButton: {
    alignSelf: "center",
    backgroundColor: colors.danger,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  inlineErrorButtonText: {
    color: colors.textInverse,
    fontSize: 13,
    fontWeight: "800",
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    marginTop: 4,
  },
  cardGroup: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
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
    borderBottomColor: colors.separator,
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
    color: colors.text,
  },
  rowDetail: {
    fontSize: 13,
    color: colors.textMuted,
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
}
