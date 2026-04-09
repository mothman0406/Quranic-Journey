import { useEffect, useMemo } from "react";

interface CelebrationOverlayProps {
  show: boolean;
  onDone: () => void;
  message: string;
  subMessage?: string;
}

const CONFETTI_COLORS = [
  "#22c55e", "#16a34a", "#4ade80", "#86efac",
  "#f59e0b", "#d97706", "#fbbf24",
  "#ffffff", "#f0fdf4", "#fefce8",
];

interface ConfettiPiece {
  id: number;
  color: string;
  size: number;
  left: number;
  duration: number;
  delay: number;
  isCircle: boolean;
}

function makeConfetti(): ConfettiPiece[] {
  const pieces: ConfettiPiece[] = [];
  for (let i = 0; i < 80; i++) {
    pieces.push({
      id: i,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      size: 6 + Math.random() * 6,
      left: Math.random() * 100,
      duration: 2 + Math.random() * 2,
      delay: Math.random(),
      isCircle: Math.random() > 0.5,
    });
  }
  return pieces;
}

export function CelebrationOverlay({ show, onDone, message, subMessage }: CelebrationOverlayProps) {
  const confetti = useMemo(makeConfetti, []);

  useEffect(() => {
    if (!show) return;
    const t = setTimeout(onDone, 8000);
    return () => clearTimeout(t);
  }, [show, onDone]);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-50"
      style={{ background: "rgba(0,0,0,0.5)" }}
    >
      <style>{`
        @keyframes noor-confetti-fall {
          0%   { transform: translateY(-10px) rotate(0deg); opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
      `}</style>

      {confetti.map((p) => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            top: 0,
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            background: p.color,
            borderRadius: p.isCircle ? "50%" : "2px",
            animation: `noor-confetti-fall ${p.duration}s ease-in ${p.delay}s both`,
            pointerEvents: "none",
          }}
        />
      ))}

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl px-8 py-10 text-center max-w-sm w-full">
          <p
            className="arabic-text text-emerald-700 dark:text-emerald-400 mb-4"
            style={{ fontSize: "2.5rem", lineHeight: "1.6" }}
          >
            مَاشَاءَ اللَّه
          </p>
          <p className="text-xl font-bold text-gray-900 dark:text-white mb-2">{message}</p>
          {subMessage && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{subMessage}</p>
          )}
          {!subMessage && <div className="mb-6" />}
          <button
            onClick={onDone}
            className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold rounded-xl py-3 text-base transition-colors"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
