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
import { Link, useRouter } from "expo-router";
import { AuthSocialButtons, type SocialAuthProvider } from "@/src/components/auth-social-buttons";
import { DISABLED_SOCIAL_PROVIDERS, useAuthPublicConfig } from "@/src/lib/auth-config";
import { authClient } from "@/src/lib/auth-client";
import { createAuthRedirect } from "@/src/lib/auth-redirects";
import { useAppTheme, type AppThemeColors } from "@/src/lib/app-theme";

export default function SignUpScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const authConfig = useAuthPublicConfig();
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const confirmInputRef = useRef<TextInput>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<SocialAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  const formDisabled = loading || socialLoading !== null;

  async function handleSignUp() {
    if (formDisabled) return;

    Keyboard.dismiss();
    setError(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName) {
      setError("Enter your name.");
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
      const result = await authClient.signUp.email({
        name: trimmedName,
        email: trimmedEmail,
        password,
      });

      if (result.error) {
        setError(result.error.message ?? "Account could not be created.");
      } else {
        router.replace("/");
      }
    } catch {
      setError("Unexpected error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSocialSignIn(provider: SocialAuthProvider) {
    Keyboard.dismiss();
    setError(null);
    setSocialLoading(provider);

    try {
      const result = await authClient.signIn.social({
        provider,
        callbackURL: createAuthRedirect(),
      });

      if (result.error) {
        setError(result.error.message ?? `${providerLabel(provider)} sign-up failed.`);
      } else {
        router.replace("/");
      }
    } catch {
      setError(`${providerLabel(provider)} sign-up could not be started.`);
    } finally {
      setSocialLoading(null);
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
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Start your NoorPath journey</Text>
          <TextInput
            style={styles.input}
            placeholder="Your name"
            placeholderTextColor={colors.textSubtle}
            autoCapitalize="words"
            autoComplete="name"
            editable={!formDisabled}
            returnKeyType="next"
            textContentType="name"
            value={name}
            onChangeText={setName}
            onSubmitEditing={() => emailInputRef.current?.focus()}
          />
          <TextInput
            ref={emailInputRef}
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textSubtle}
            autoCapitalize="none"
            autoComplete="email"
            editable={!formDisabled}
            keyboardType="email-address"
            returnKeyType="next"
            textContentType="emailAddress"
            value={email}
            onChangeText={setEmail}
            onSubmitEditing={() => passwordInputRef.current?.focus()}
          />
          <TextInput
            ref={passwordInputRef}
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.textSubtle}
            autoComplete="new-password"
            editable={!formDisabled}
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
            editable={!formDisabled}
            returnKeyType="done"
            secureTextEntry
            textContentType="newPassword"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            onSubmitEditing={handleSignUp}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            style={[styles.button, formDisabled && styles.buttonDisabled]}
            onPress={handleSignUp}
            disabled={formDisabled}
          >
            {loading ? (
              <ActivityIndicator color={colors.textInverse} />
            ) : (
              <Text style={styles.buttonText}>Create account</Text>
            )}
          </Pressable>
          <AuthSocialButtons
            disabled={loading}
            enabledProviders={authConfig.config?.socialProviders ?? DISABLED_SOCIAL_PROVIDERS}
            loadingProvider={socialLoading}
            onPress={handleSocialSignIn}
          />
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <Link href="/sign-in" asChild>
              <Pressable disabled={formDisabled}>
                <Text style={[styles.linkText, formDisabled && styles.disabledText]}>Sign in</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function providerLabel(provider: SocialAuthProvider) {
  return provider === "apple" ? "Apple" : "Google";
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
    title: {
      color: colors.text,
      fontSize: 26,
      fontWeight: "900",
      textAlign: "center",
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: "700",
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
    button: {
      alignItems: "center",
      backgroundColor: colors.primary,
      borderRadius: 10,
      marginTop: 2,
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
    footerRow: {
      alignItems: "center",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      justifyContent: "center",
      marginTop: 4,
    },
    footerText: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: "600",
    },
    linkText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: "800",
    },
    disabledText: {
      opacity: 0.55,
    },
  });
}
