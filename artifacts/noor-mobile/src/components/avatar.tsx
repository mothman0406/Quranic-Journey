import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";

type AvatarSize = "sm" | "md" | "lg";

const SIZE_MAP: Record<AvatarSize, { size: number; fontSize: number }> = {
  sm: { size: 28, fontSize: 12 },
  md: { size: 38, fontSize: 15 },
  lg: { size: 96, fontSize: 36 },
};

function getInitial(name: string, email?: string) {
  const source = name.trim() || email?.trim() || "P";
  return source.charAt(0).toUpperCase();
}

export function Avatar({
  imageUrl,
  name,
  email,
  size,
}: {
  imageUrl: string | null;
  name: string;
  email?: string;
  size: AvatarSize;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const dimensions = SIZE_MAP[size];
  const borderRadius = dimensions.size / 2;
  const showImage = !!imageUrl && !imageFailed;

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  const avatarStyle = [
    styles.avatar,
    {
      width: dimensions.size,
      height: dimensions.size,
      borderRadius,
    },
  ];

  if (showImage) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={avatarStyle}
        contentFit="cover"
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <View style={[avatarStyle, styles.fallback]}>
      <Text style={[styles.initial, { fontSize: dimensions.fontSize }]}>
        {getInitial(name, email)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    borderWidth: 1,
    borderColor: "#0f766e",
    overflow: "hidden",
  },
  fallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f766e",
  },
  initial: {
    color: "#ffffff",
    fontWeight: "900",
  },
});
