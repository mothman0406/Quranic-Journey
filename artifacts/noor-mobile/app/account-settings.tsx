import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Redirect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import {
  InlineError,
  ScreenContainer,
  ScreenHeader,
  ScreenScrollView,
} from "@/src/components/screen-primitives";
import { Avatar } from "@/src/components/avatar";
import { authClient } from "@/src/lib/auth-client";

const AVATAR_IMAGE_SIZE = 256;
const JPEG_COMPRESSION = 0.8;
const MAX_AVATAR_IMAGE_BYTES = 200 * 1024;
const JPEG_DATA_URL_PREFIX = "data:image/jpeg;base64,";

function getBase64ByteLength(base64: string) {
  const normalized = base64.replace(/\s/g, "");
  const padding = normalized.endsWith("==") ? 2 : normalized.endsWith("=") ? 1 : 0;
  return Math.ceil((normalized.length * 3) / 4) - padding;
}

function buildProfileImageDataUrl(base64: string | undefined) {
  const normalized = base64?.trim();
  if (!normalized) {
    throw new Error("Selected photo could not be processed.");
  }

  const bytes = getBase64ByteLength(normalized);
  if (bytes > MAX_AVATAR_IMAGE_BYTES) {
    throw new Error("Profile photo is too large. Choose a simpler image and try again.");
  }

  const dataUrl = `${JPEG_DATA_URL_PREFIX}${normalized}`;
  if (!dataUrl.startsWith(JPEG_DATA_URL_PREFIX)) {
    throw new Error("Profile photo must be a JPEG image.");
  }
  return dataUrl;
}

export default function AccountSettingsScreen() {
  const router = useRouter();
  const sessionQuery = authClient.useSession();
  const user = sessionQuery.data?.user;
  const [savingAction, setSavingAction] = useState<"change" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function updateProfileImage(image: string | null) {
    const result = await authClient.updateUser({ image });
    if (result.error) {
      throw new Error(result.error.message ?? "Profile photo could not be saved.");
    }
    await sessionQuery.refetch();
  }

  async function handleChangePhoto() {
    if (savingAction) return;

    setError(null);
    setStatus(null);
    setSavingAction("change");

    try {
      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (pickerResult.canceled) return;

      const asset = pickerResult.assets[0];
      if (!asset?.uri) {
        throw new Error("Selected photo could not be read.");
      }

      const context = ImageManipulator.manipulate(asset.uri);
      context.resize({ width: AVATAR_IMAGE_SIZE, height: AVATAR_IMAGE_SIZE });
      const renderedImage = await context.renderAsync();
      const processedImage = await renderedImage.saveAsync({
        format: SaveFormat.JPEG,
        compress: JPEG_COMPRESSION,
        base64: true,
      });

      const imageDataUrl = buildProfileImageDataUrl(processedImage.base64);
      await updateProfileImage(imageDataUrl);
      setStatus("Profile photo updated.");
    } catch (photoError) {
      setError(photoError instanceof Error ? photoError.message : "Profile photo could not be saved.");
    } finally {
      setSavingAction(null);
    }
  }

  async function handleRemovePhoto() {
    if (savingAction || !user?.image) return;

    setError(null);
    setStatus(null);
    setSavingAction("remove");

    try {
      await updateProfileImage(null);
      setStatus("Profile photo removed.");
    } catch (photoError) {
      setError(photoError instanceof Error ? photoError.message : "Profile photo could not be removed.");
    } finally {
      setSavingAction(null);
    }
  }

  if (sessionQuery.isPending) {
    return (
      <ScreenContainer>
        <ScreenHeader title="Account settings" onBack={() => router.back()} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </ScreenContainer>
    );
  }

  if (!user) {
    return <Redirect href="/sign-in" />;
  }

  const actionDisabled = savingAction !== null;
  const removeDisabled = actionDisabled || !user.image;

  return (
    <ScreenContainer>
      <ScreenHeader title="Account settings" onBack={() => router.back()} />
      <ScreenScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Profile photo</Text>
          <View style={styles.profileRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change profile photo"
              style={styles.avatarButton}
              onPress={handleChangePhoto}
              disabled={actionDisabled}
            >
              <Avatar
                imageUrl={user.image ?? null}
                name={user.name ?? ""}
                email={user.email ?? undefined}
                size="lg"
              />
              <View style={styles.cameraBadge}>
                <Ionicons name="camera" size={16} color="#ffffff" />
              </View>
            </Pressable>
            <View style={styles.identityBlock}>
              <Text style={styles.name} numberOfLines={1}>
                {user.name}
              </Text>
              <Text style={styles.email} numberOfLines={1}>
                {user.email}
              </Text>
            </View>
          </View>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              style={[styles.primaryButton, actionDisabled && styles.buttonDisabled]}
              onPress={handleChangePhoto}
              disabled={actionDisabled}
            >
              {savingAction === "change" ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="image-outline" size={18} color="#ffffff" />
                  <Text style={styles.primaryButtonText}>Change photo</Text>
                </>
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={[styles.secondaryButton, removeDisabled && styles.buttonDisabled]}
              onPress={handleRemovePhoto}
              disabled={removeDisabled}
            >
              {savingAction === "remove" ? (
                <ActivityIndicator color="#0f766e" />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={18} color="#0f766e" />
                  <Text style={styles.secondaryButtonText}>Remove photo</Text>
                </>
              )}
            </Pressable>
          </View>

          {error ? <InlineError message={error} /> : null}
          {status ? <Text style={styles.statusText}>{status}</Text> : null}
        </View>
      </ScreenScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    padding: 16,
    gap: 16,
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "900",
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatarButton: {
    width: 104,
    height: 104,
    alignItems: "center",
    justifyContent: "center",
  },
  cameraBadge: {
    position: "absolute",
    right: 1,
    bottom: 1,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: "#ffffff",
    backgroundColor: "#0f766e",
    alignItems: "center",
    justifyContent: "center",
  },
  identityBlock: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "900",
  },
  email: {
    color: "#64748b",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    marginTop: 2,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 10,
    backgroundColor: "#0f766e",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 12,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  secondaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#99f6e4",
    backgroundColor: "#f0fdfa",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 12,
  },
  secondaryButtonText: {
    color: "#0f766e",
    fontSize: 14,
    fontWeight: "900",
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  statusText: {
    color: "#0f766e",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
  },
});
