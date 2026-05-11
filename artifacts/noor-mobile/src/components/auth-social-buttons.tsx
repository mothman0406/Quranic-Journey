import { useMemo, type ComponentProps } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme, type AppThemeColors } from "@/src/lib/app-theme";

export type SocialAuthProvider = "apple" | "google";

type IconName = ComponentProps<typeof Ionicons>["name"];

const PROVIDERS: {
  id: SocialAuthProvider;
  label: string;
  icon: IconName;
}[] = [
  { id: "apple", label: "Sign in with Apple", icon: "logo-apple" },
  { id: "google", label: "Sign in with Google", icon: "logo-google" },
];

export function AuthSocialButtons({
  disabled,
  enabledProviders,
  loadingProvider,
  onPress,
}: {
  disabled?: boolean;
  enabledProviders?: Partial<Record<SocialAuthProvider, boolean>> | null;
  loadingProvider: SocialAuthProvider | null;
  onPress: (provider: SocialAuthProvider) => void;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const providers = PROVIDERS.filter((provider) => enabledProviders?.[provider.id] !== false);

  if (providers.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.dividerRow}>
        <View style={styles.divider} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.divider} />
      </View>
      {providers.map((provider) => {
        const isLoading = loadingProvider === provider.id;
        const isDisabled = disabled || loadingProvider !== null;

        return (
          <Pressable
            key={provider.id}
            accessibilityRole="button"
            style={[styles.button, isDisabled && styles.buttonDisabled]}
            onPress={() => onPress(provider.id)}
            disabled={isDisabled}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Ionicons name={provider.icon} size={20} color={colors.text} />
            )}
            <Text style={styles.buttonText}>{provider.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function makeStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    container: {
      gap: 10,
      marginTop: 4,
    },
    dividerRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 12,
      marginVertical: 2,
    },
    divider: {
      backgroundColor: colors.separator,
      flex: 1,
      height: 1,
    },
    dividerText: {
      color: colors.textSubtle,
      fontSize: 12,
      fontWeight: "800",
      textTransform: "uppercase",
    },
    button: {
      alignItems: "center",
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.borderStrong,
      borderRadius: 10,
      borderWidth: 1,
      flexDirection: "row",
      gap: 10,
      justifyContent: "center",
      minHeight: 48,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    buttonDisabled: {
      opacity: 0.62,
    },
    buttonText: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "800",
    },
  });
}
