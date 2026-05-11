import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthPublicConfig } from "@/src/lib/auth-config";
import { authClient } from "@/src/lib/auth-client";
import { createAuthRedirect } from "@/src/lib/auth-redirects";
import { useAppTheme, type AppThemeColors } from "@/src/lib/app-theme";

export default function ForgotPasswordScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const authConfig = useAuthPublicConfig();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSendReset() {
    if (loading) return;

    Keyboard.dismiss();
    setError(null);
    setSent(false);

    if (authConfig.isLoading) {
      setError("Checking password reset availability. Try again in a moment.");
      return;
    }

    if (authConfig.isUnavailable || !authConfig.config) {
      setError("Password reset is not available yet.");
      return;
    }

    if (authConfig.config.passwordReset.emailDeliveryConfigured === false) {
      setError("Password reset email is not configured yet.");
      return;
    }

    setLoading(true);

    try {
      const result = await authClient.requestPasswordReset({
        email: email.trim(),
        redirectTo: createAuthRedirect("reset-password"),
      });

      if (result.error) {
        setError(result.error.message ?? "Password reset email could not be sent.");
      } else {
        setSent(true);
      }
    } catch {
      setError("Unexpected error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={Keyboard.dismiss}
      >
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="mail-outline" size={24} color={colors.primary} />
          </View>
          <Text style={styles.title}>Reset password</Text>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textSubtle}
            autoCapitalize="none"
            autoComplete="email"
            editable={!loading}
            keyboardType="email-address"
            returnKeyType="done"
            textContentType="emailAddress"
            value={email}
            onChangeText={setEmail}
            onSubmitEditing={handleSendReset}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {sent ? (
            <Text style={styles.status}>
              If this email exists in NoorPath, a reset link has been sent.
            </Text>
          ) : null}
          <Pressable
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSendReset}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.textInverse} />
            ) : (
              <Text style={styles.buttonText}>Send reset email</Text>
            )}
          </Pressable>
          <Link href="/sign-in" asChild>
            <Pressable style={styles.secondaryButton} disabled={loading}>
              <Text style={[styles.secondaryButtonText, loading && styles.disabledText]}>
                Back to sign in
              </Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    container: {
      backgroundColor: colors.background,
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: "center",
      padding: 24,
    },
    card: {
      alignSelf: "center",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      elevation: 2,
      gap: 12,
      maxWidth: 420,
      padding: 20,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.05,
      shadowRadius: 14,
      width: "100%",
    },
    iconCircle: {
      alignItems: "center",
      alignSelf: "center",
      backgroundColor: colors.primarySoft,
      borderColor: colors.primaryBorder,
      borderRadius: 22,
      borderWidth: 1,
      height: 44,
      justifyContent: "center",
      width: 44,
    },
    title: {
      color: colors.text,
      fontSize: 26,
      fontWeight: "900",
      marginBottom: 6,
      textAlign: "center",
    },
    input: {
      backgroundColor: colors.input,
      borderColor: colors.inputBorder,
      borderRadius: 10,
      borderWidth: 1,
      color: colors.text,
      fontSize: 16,
      fontWeight: "600",
      padding: 12,
    },
    error: {
      color: colors.danger,
      fontSize: 14,
      fontWeight: "700",
      lineHeight: 19,
    },
    status: {
      backgroundColor: colors.successSoft,
      borderColor: colors.successBorder,
      borderRadius: 10,
      borderWidth: 1,
      color: colors.success,
      fontSize: 14,
      fontWeight: "700",
      lineHeight: 19,
      padding: 12,
    },
    button: {
      alignItems: "center",
      backgroundColor: colors.primary,
      borderRadius: 10,
      minHeight: 50,
      justifyContent: "center",
      padding: 14,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      color: colors.textInverse,
      fontSize: 16,
      fontWeight: "800",
    },
    secondaryButton: {
      alignItems: "center",
      minHeight: 40,
      justifyContent: "center",
    },
    secondaryButtonText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: "800",
    },
    disabledText: {
      opacity: 0.55,
    },
  });
}
