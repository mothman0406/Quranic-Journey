import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

type CelebrationOverlayProps = {
  show: boolean;
  message: string;
  subMessage?: string;
  onDone: () => void;
};

type ConfettiPiece = {
  id: number;
  color: string;
  size: number;
  left: number;
  delay: number;
  duration: number;
  rotate: number;
  drift: number;
  circle: boolean;
};

const CONFETTI_COLORS = [
  "#22c55e",
  "#16a34a",
  "#4ade80",
  "#86efac",
  "#f59e0b",
  "#d97706",
  "#fbbf24",
  "#ffffff",
  "#f0fdf4",
  "#fefce8",
];

function makeConfetti(): ConfettiPiece[] {
  return Array.from({ length: 64 }, (_, id) => ({
    id,
    color: CONFETTI_COLORS[id % CONFETTI_COLORS.length],
    size: 6 + ((id * 7) % 7),
    left: (id * 37) % 100,
    delay: (id % 12) * 70,
    duration: 2200 + ((id * 53) % 1300),
    rotate: 240 + ((id * 31) % 520),
    drift: ((id % 2 === 0 ? 1 : -1) * (18 + ((id * 11) % 46))),
    circle: id % 3 === 0,
  }));
}

export function CelebrationOverlay({
  show,
  message,
  subMessage,
  onDone,
}: CelebrationOverlayProps) {
  const { height, width } = useWindowDimensions();
  const confetti = useMemo(makeConfetti, []);
  const animations = useRef(confetti.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (!show) {
      animations.forEach((value) => value.setValue(0));
      return;
    }

    animations.forEach((value) => value.setValue(0));
    const animation = Animated.stagger(
      18,
      animations.map((value, index) =>
        Animated.timing(value, {
          toValue: 1,
          duration: confetti[index]?.duration ?? 2600,
          delay: confetti[index]?.delay ?? 0,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ),
    );
    animation.start();

    const timer = setTimeout(onDone, 8000);
    return () => {
      animation.stop();
      clearTimeout(timer);
    };
  }, [animations, confetti, onDone, show]);

  return (
    <Modal visible={show} transparent animationType="fade" onRequestClose={onDone}>
      <View style={styles.backdrop}>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {confetti.map((piece, index) => {
            const progress = animations[index]!;
            const translateY = progress.interpolate({
              inputRange: [0, 1],
              outputRange: [-40, height + 90],
            });
            const translateX = progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0, piece.drift],
            });
            const rotate = progress.interpolate({
              inputRange: [0, 1],
              outputRange: ["0deg", `${piece.rotate}deg`],
            });
            const opacity = progress.interpolate({
              inputRange: [0, 0.82, 1],
              outputRange: [1, 1, 0],
            });

            return (
              <Animated.View
                key={piece.id}
                style={[
                  styles.confettiPiece,
                  {
                    backgroundColor: piece.color,
                    borderRadius: piece.circle ? piece.size / 2 : 2,
                    height: piece.size,
                    left: (piece.left / 100) * width,
                    opacity,
                    transform: [{ translateX }, { translateY }, { rotate }],
                    width: piece.size,
                  },
                ]}
              />
            );
          })}
        </View>

        <View style={styles.card}>
          <Text style={styles.arabic}>مَاشَاءَ اللَّه</Text>
          <Text style={styles.title}>{message}</Text>
          {subMessage ? <Text style={styles.subtitle}>{subMessage}</Text> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continue after celebration"
            style={styles.button}
            onPress={onDone}
          >
            <Text style={styles.buttonText}>Continue</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.52)",
    padding: 24,
  },
  confettiPiece: {
    position: "absolute",
    top: 0,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    paddingHorizontal: 28,
    paddingVertical: 32,
    alignItems: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.22,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
  arabic: {
    marginBottom: 12,
    color: "#047857",
    fontSize: 34,
    lineHeight: 52,
    textAlign: "center",
  },
  title: {
    color: "#111827",
    fontSize: 21,
    fontWeight: "900",
    textAlign: "center",
  },
  subtitle: {
    marginTop: 10,
    color: "#6b7280",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  button: {
    marginTop: 24,
    minHeight: 48,
    width: "100%",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#059669",
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },
});
