import { useMemo, useRef, useState } from "react";
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
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { authClient } from "@/src/lib/auth-client";
import { useAppTheme, type AppThemeColors } from "@/src/lib/app-theme";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string | string[]; error?: string | string[] }>();
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const confirmInputRef = useRef<TextInput>(null);
  const token = firstParam(params.token);
  const linkError = firstParam(params.error);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(linkError ? "This reset link is invalid or expired." : null);
  const [complete, setComplete] = useState(false);

  async function handleResetPassword() {
    if (loading || complete) return;

    Keyboard.dismiss();
    setError(null);

    if (!token) {
      setError("This reset link is missing a token.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const result = await authClient.resetPassword({
        newPassword: password,
        token,
      });

      if (result.error) {
        setError(result.error.message ?? "Password could not be reset.");
      } else {
        setComplete(true);
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
            <Ionicons
              name={complete ? "checkmark-circle-outline" : "key-outline"}
              size={24}
              color={complete ? colors.success : colors.primary}
            />
          </View>
          <Text style={styles.title}>{complete ? "Password updated" : "New password"}</Text>
          {complete ? (
            <>
              <Text style={styles.status}>Your password has been changed.</Text>
              <Pressable style={styles.button} onPress={() => router.replace("/sign-in")}>
                <Text style={styles.buttonText}>Sign in</Text>
              </Pressable>
            </>
          ) : (
            <>
              <TextInput
                style={styles.input}
                placeholder="New password"
                placeholderTextColor={colors.textSubtle}
                autoComplete="new-password"
                editable={!loading && !!token}
                returnKeyType="next"
                secureTextEntry
                textContentType="newPassword"
                value={password}
                onChangeText={setPassword}
                onSubmitEditing={() => confirmInputRef.current?.focus()}
              />
              <TextInput
                ref={confirmInputRef}
                style={styles.input}
                placeholder="Confirm password"
                placeholderTextColor={colors.textSubtle}
                autoComplete="new-password"
                editable={!loading && !!token}
                returnKeyType="done"
                secureTextEntry
                textContentType="newPassword"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                onSubmitEditing={handleResetPassword}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Pressable
                style={[styles.button, (loading || !token) && styles.buttonDisabled]}
                onPress={handleResetPassword}
                disabled={loading || !token}
              >
                {loading ? (
                  <ActivityIndicator color={colors.textInverse} />
                ) : (
                  <Text style={styles.buttonText}>Update password</Text>
                )}
              </Pressable>
              <Link href="/sign-in" asChild>
                <Pressable style={styles.secondaryButton} disabled={loading}>
                  <Text style={[styles.secondaryButtonText, loading && styles.disabledText]}>
                    Back to sign in
                  </Text>
                </Pressable>
              </Link>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
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
      textAlign: "center",
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
