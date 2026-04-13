import { useEffect, useRef, useState } from "react";

export default function MicTestPage() {
  const [micStatus, setMicStatus] = useState<"idle" | "granted" | "denied" | "error">("idle");
  const [srRunning, setSrRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const addLog = (msg: string) => {
    const ts = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, `[${ts}] ${msg}`]);
  };

  // Auto-scroll log pane
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  // Request mic on mount
  useEffect(() => {
    addLog("Requesting microphone access…");
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        addLog("Mic access GRANTED");
        setMicStatus("granted");
        // We only needed permission — release the stream immediately.
        stream.getTracks().forEach((t) => t.stop());
      })
      .catch((err) => {
        addLog(`Mic access DENIED/ERROR: ${err}`);
        setMicStatus(err.name === "NotAllowedError" ? "denied" : "error");
      });
  }, []);

  const startSR = () => {
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      addLog("ERROR: Web Speech API not available in this browser.");
      return;
    }
    const rec = new SR();
    rec.lang = "ar";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 3;

    rec.onstart = () => {
      addLog("SpeechRecognition started");
      setSrRunning(true);
    };

    rec.onresult = (e: any) => {
      const result = e.results[e.results.length - 1];
      const isFinal = result.isFinal;
      const alts: string[] = Array.from(
        { length: result.length },
        (_: any, i: number) =>
          `"${result[i].transcript}" (conf: ${result[i].confidence?.toFixed(2) ?? "?"})`
      );
      addLog(`${isFinal ? "FINAL" : "interim"} — ${alts.join(" | ")}`);
    };

    rec.onerror = (e: any) => {
      addLog(`SR error: ${e.error}`);
    };

    rec.onend = () => {
      addLog("SpeechRecognition ended");
      setSrRunning(false);
    };

    recognitionRef.current = rec;
    rec.start();
  };

  const stopSR = () => {
    recognitionRef.current?.stop();
  };

  return (
    <div style={{ fontFamily: "monospace", padding: "24px", maxWidth: "700px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "16px" }}>Mic / Speech Debug</h1>

      {/* Mic status */}
      <div style={{ marginBottom: "16px" }}>
        <strong>Mic status: </strong>
        <span style={{
          color: micStatus === "granted" ? "#16a34a"
            : micStatus === "denied" ? "#dc2626"
            : micStatus === "error" ? "#d97706"
            : "#6b7280",
        }}>
          {micStatus}
        </span>
      </div>

      {/* Web Speech controls */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <button
          onClick={startSR}
          disabled={srRunning}
          style={{
            padding: "8px 16px", borderRadius: "6px", border: "1px solid #ccc",
            background: srRunning ? "#f3f4f6" : "#22c55e", color: srRunning ? "#9ca3af" : "#fff",
            cursor: srRunning ? "not-allowed" : "pointer",
          }}
        >
          Start Arabic SR
        </button>
        <button
          onClick={stopSR}
          disabled={!srRunning}
          style={{
            padding: "8px 16px", borderRadius: "6px", border: "1px solid #ccc",
            background: !srRunning ? "#f3f4f6" : "#ef4444", color: !srRunning ? "#9ca3af" : "#fff",
            cursor: !srRunning ? "not-allowed" : "pointer",
          }}
        >
          Stop SR
        </button>
        <button
          onClick={() => setLogs([])}
          style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid #ccc", cursor: "pointer" }}
        >
          Clear log
        </button>
      </div>

      {/* Native dictation input */}
      <div style={{ marginBottom: "20px" }}>
        <label style={{ display: "block", marginBottom: "6px", fontSize: "0.85rem", color: "#6b7280" }}>
          Native dictation input — press <strong>fn fn</strong> (Mac) to start system dictation, then speak Arabic:
        </label>
        <input
          dir="rtl"
          lang="ar"
          type="text"
          placeholder="اكتب أو تكلم هنا…"
          onChange={(e) => addLog(`input onChange: "${e.target.value}"`)}
          style={{
            width: "100%", padding: "10px 14px", fontSize: "1.3rem",
            border: "2px solid #22c55e", borderRadius: "8px",
            direction: "rtl", background: "transparent",
            boxSizing: "border-box",
          }}
        />
        <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: "4px" }}>
          Try <strong>fn + fn</strong> to invoke macOS dictation. Changes log to the console below.
        </div>
      </div>

      {/* On-screen log */}
      <div
        ref={logRef}
        style={{
          background: "#0f172a", color: "#a3e635", padding: "12px",
          borderRadius: "8px", height: "340px", overflowY: "auto",
          fontSize: "0.78rem", lineHeight: "1.6", whiteSpace: "pre-wrap",
        }}
      >
        {logs.length === 0
          ? <span style={{ color: "#475569" }}>— waiting for events —</span>
          : logs.map((line, i) => <div key={i}>{line}</div>)
        }
      </div>
    </div>
  );
}
