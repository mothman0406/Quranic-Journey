import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { mushafPageUrl } from "@/src/lib/mushaf";

const NATIVE_PAGE_WIDTH = 2600;
const NATIVE_PAGE_HEIGHT = 4206;
const PAGE_ASPECT_RATIO = NATIVE_PAGE_HEIGHT / NATIVE_PAGE_WIDTH;

const PROTOTYPE_AYAH_BOX = {
  left: 720,
  top: 760,
  width: 1500,
  height: 430,
};

export default function MushafImagePrototypeScreen() {
  const pulseOpacity = useRef(new Animated.Value(0.18)).current;
  const { width } = useWindowDimensions();
  const pageWidth = Math.min(width - 32, 430);
  const pageHeight = pageWidth * PAGE_ASPECT_RATIO;
  const scale = pageWidth / NATIVE_PAGE_WIDTH;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseOpacity, {
          toValue: 0.56,
          duration: 1000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulseOpacity, {
          toValue: 0.18,
          duration: 1000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [pulseOpacity]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Experimental</Text>
        <Text style={styles.title}>Image-based Mushaf prototype</Text>
      </View>

      <View style={[styles.pageFrame, { width: pageWidth, height: pageHeight }]}>
        <Image
          source={{ uri: mushafPageUrl(1) }}
          resizeMode="contain"
          style={styles.pageImage}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.highlight,
            {
              left: PROTOTYPE_AYAH_BOX.left * scale,
              top: PROTOTYPE_AYAH_BOX.top * scale,
              width: PROTOTYPE_AYAH_BOX.width * scale,
              height: PROTOTYPE_AYAH_BOX.height * scale,
              opacity: pulseOpacity,
            },
          ]}
        />
      </View>

      <Pressable style={styles.seekButton} onPress={() => undefined}>
        <Text style={styles.seekText}>Tap to seek</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
    backgroundColor: "#f8fafc",
    padding: 16,
  },
  header: {
    alignItems: "center",
    gap: 4,
  },
  kicker: {
    color: "#b91c1c",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  title: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },
  pageFrame: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    overflow: "hidden",
  },
  pageImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  highlight: {
    position: "absolute",
    borderRadius: 6,
    backgroundColor: "#facc15",
    borderWidth: 1,
    borderColor: "#ca8a04",
  },
  seekButton: {
    minHeight: 42,
    minWidth: 128,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#111827",
    paddingHorizontal: 18,
  },
  seekText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
});
