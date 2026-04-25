import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useSearch, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { updateMemorization, listMemorization } from "@workspace/api-client-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  AlignLeft,
  Bookmark,
  Book,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Circle,
  CheckCircle,
  Check,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Globe,
  Highlighter,
  Mic,
  MicOff,
  Pause,
  Play,
  Repeat,
  Settings,
  Share2,
  SkipBack,
  SkipForward,
  Square,
  X,
} from "lucide-react";
import { BayaanMushafPageCard } from "@/components/mushaf/bayaan/BayaanMushafPageCard";
import { BayaanSurahBanner } from "@/components/mushaf/bayaan/BayaanSurahBanner";
import { useBayaanMushafFit } from "@/components/mushaf/bayaan/useBayaanMushafFit";
import {
  BAYAAN_MUSHAF_TEXT,
  BAYAAN_PAGE_THEME,
  TAJWEED_CSS,
} from "@/components/mushaf/bayaan/bayaan-constants";
import { getArabicSurahNamesForPage } from "@/components/mushaf/bayaan/bayaan-utils";

const TOTAL_PAGES = 604;
const QURAN_API = "https://api.quran.com/api/v4";
const SKIP_CHARS = /^[ۖ-ۭ؀-؅؛؞؟۝۞۟]+$/;
const LS_PREFIX = "noorpath";

const RECITERS = [
  { folder: "Alafasy_128kbps",              name: "Mishary Rashid Al-Afasy" },
  { folder: "Husary_128kbps",               name: "Mahmoud Khalil Al-Husary" },
  { folder: "Sudais_192kbps",               name: "Abdul Rahman Al-Sudais" },
  { folder: "Abdul_Basit_Murattal_192kbps", name: "Abdul Basit Abdul Samad" },
  { folder: "Minshawi_Murattal_128kbps",    name: "Muhammad Siddiq Al-Minshawi" },
  { folder: "Ghamadi_40kbps",               name: "Saad Al-Ghamdi" },
  { folder: "MaherAlMuaiqly128kbps",        name: "Maher Al-Muaiqly" },
  { folder: "Hani_Rifai_192kbps",           name: "Hani Ar-Rifai" },
  { folder: "Shuraim_128kbps",              name: "Saud Ash-Shuraim" },
  { folder: "Ali_Jaber_64kbps",             name: "Ali Jaber" },
] as const;

const JUZ_PAGES: Record<number, number> = {
   1:   1,  2:  22,  3:  42,  4:  62,  5:  82,
   6: 102,  7: 121,  8: 142,  9: 162, 10: 182,
  11: 201, 12: 222, 13: 242, 14: 262, 15: 282,
  16: 302, 17: 322, 18: 342, 19: 362, 20: 382,
  21: 402, 22: 422, 23: 442, 24: 462, 25: 482,
  26: 502, 27: 522, 28: 542, 29: 562, 30: 582,
};

type HighlightColor = "yellow" | "green" | "blue" | "pink";

const HIGHLIGHT_COLORS: Record<HighlightColor, { bg: string; dot: string; label: string }> = {
  yellow: { bg: "rgba(250,204,21,0.35)",  dot: "#f59e0b", label: "Yellow" },
  green:  { bg: "rgba(34,197,94,0.35)",   dot: "#16a34a", label: "Green" },
  blue:   { bg: "rgba(59,130,246,0.35)",  dot: "#2563eb", label: "Blue" },
  pink:   { bg: "rgba(236,72,153,0.35)",  dot: "#db2777", label: "Pink" },
};

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

function audioUrl(reciterFolder: string, surahId: number, ayahNum: number): string {
  return `https://everyayah.com/data/${reciterFolder}/${String(surahId).padStart(3, "0")}${String(ayahNum).padStart(3, "0")}.mp3`;
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ApiWord {
  position: number;
  text_uthmani: string;
  char_type_name: string;
  line_number: number;
  translation?: string | { text: string; language_name: string };
}

type LineWord = {
  verse_key: string;
  surahId: number;
  verseNum: number;
  position: number;
  wordIdxInVerse: number;
  text_uthmani: string;
  char_type_name: string;
  line_number: number;
  translation?: string;
};

interface PageVerseData {
  verse_key: string;
  text_uthmani: string;
  words?: ApiWord[];
}

interface Chapter {
  id: number;
  name_arabic: string;
  name_simple: string;
  translated_name: { name: string };
  bismillah_pre: boolean;
  pages: [number, number];
}

interface AyahInfo {
  verseKey: string;
  surahId: number;
  verseNum: number;
  text_uthmani: string;
}

type ReciteWord = {
  verse_key: string;
  surahId: number;
  verseNum: number;
  position: number;
  text_uthmani: string;
};

interface WBWWord {
  position: number;
  text_uthmani: string;
  char_type_name: string;
  transliteration?: { text: string };
  translation?: { text: string; language_name: string } | string;
}

type SheetView =
  | { type: "main" }
  | { type: "repeat" }
  | { type: "translation" }
  | { type: "tafseer" }
  | { type: "wbw" }
  | { type: "highlight" }
  | { type: "note" };

interface PlayerState {
  status: "playing" | "paused";
  surahId: number;
  ayahNum: number;
  rangeStart: number;
  rangeEnd: number | null;
  reciterFolder: string;
  rate: number;
  repeat: "1" | "3" | "5" | "loop";
  repeatCount: number;
  rangeRepeat: "1" | "2" | "3" | "loop";
  rangeRepeatCount: number;
}

interface PlayerSettingsState {
  reciterFolder: string;
  rate: number;
  repeat: "1" | "3" | "5" | "loop";
  rangeRepeat: "1" | "2" | "3" | "loop";
}

// ─── Fetchers ──────────────────────────────────────────────────────────────────

async function fetchVersesByPage(pageNumber: number): Promise<{ verses: PageVerseData[] }> {
  const r = await fetch(
    `${QURAN_API}/verses/by_page/${pageNumber}?words=true&fields=text_uthmani&word_fields=text_uthmani,line_number,char_type_name,translation&per_page=50`
  );
  if (!r.ok) throw new Error(`Failed to fetch page ${pageNumber}`);
  return r.json();
}

async function fetchAllChapters(): Promise<{ chapters: Chapter[] }> {
  const r = await fetch(`${QURAN_API}/chapters?language=en`);
  if (!r.ok) throw new Error("Failed to fetch chapters");
  return r.json();
}

function cleanTranslationHtml(raw: string): string {
  return raw
    .replace(/<sup[^>]*>.*?<\/sup>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#\d+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchTranslation(verseKey: string): Promise<string> {
  // Primary endpoint
  try {
    const r = await fetch(`${QURAN_API}/verses/by_key/${verseKey}?translations=131`);
    if (r.ok) {
      const data = await r.json();
      const text = cleanTranslationHtml(data.verse?.translations?.[0]?.text ?? "");
      if (text) return text;
    }
  } catch {}
  // Fallback endpoint
  const r2 = await fetch(`${QURAN_API}/quran/translations/131?verse_key=${verseKey}`);
  if (!r2.ok) throw new Error(`Translation unavailable (${r2.status})`);
  const data2 = await r2.json();
  const text2 = cleanTranslationHtml(data2.translations?.[0]?.text ?? "");
  if (!text2) throw new Error("Translation unavailable");
  return text2;
}

async function fetchTafseer(surah: number, ayah: number): Promise<string> {
  const r = await fetch(`${QURAN_API}/tafsirs/169/by_ayah/${surah}:${ayah}`);
  if (!r.ok) return "";
  const data = await r.json();
  const raw: string = data.tafsir?.text ?? "";
  return raw
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchWBW(verseKey: string): Promise<WBWWord[]> {
  const r = await fetch(
    `${QURAN_API}/verses/by_key/${verseKey}?word_fields=text_uthmani,transliteration,translation`
  );
  if (!r.ok) return [];
  const data = await r.json();
  return (data.verse?.words ?? []).filter((w: WBWWord) => w.char_type_name !== "end");
}

// ─── Utilities ─────────────────────────────────────────────────────────────────

function stripTashkeel(s: string): string {
  return (
    s
      .replace(/ٰ/g, "ا")
      .replace(/[ؐ-ًؚ-ٟۖ-ۜ۟-۪ۤۧۨ-ۭ]/g, "")
      .replace(/[ـ]/g, "")
      .replace(/[أإآاٱ]/g, "ا")
      .trim() || s
  );
}

function isBeforeVerseKey(a: string, b: string): boolean {
  const [aSurah, aVerse] = a.split(":").map(Number);
  const [bSurah, bVerse] = b.split(":").map(Number);
  return aSurah < bSurah || (aSurah === bSurah && aVerse < bVerse);
}

function buildLineGroups(
  verses: PageVerseData[]
): Array<{ lineNum: number; words: LineWord[] }> | null {
  const all: LineWord[] = [];
  for (const pv of verses) {
    if (!pv.words?.length) return null;
    const [surahStr, verseStr] = pv.verse_key.split(":");
    const surahId = parseInt(surahStr, 10);
    const verseNum = parseInt(verseStr, 10);
    const verseTokens = (pv.text_uthmani ?? "").split(/\s+/).filter(Boolean);
    let lastMatchedJ = -1;
    for (const w of pv.words) {
      let wordIdxInVerse: number;
      if (w.char_type_name === "end") {
        wordIdxInVerse = -1;
      } else {
        const target = stripTashkeel(w.text_uthmani);
        let found = -1;
        for (let j = lastMatchedJ + 1; j < verseTokens.length; j++) {
          if (stripTashkeel(verseTokens[j]) === target) {
            found = j;
            break;
          }
        }
        if (found !== -1) {
          lastMatchedJ = found;
          wordIdxInVerse = found;
        } else {
          wordIdxInVerse = w.position - 1;
        }
      }
      all.push({
        verse_key: pv.verse_key,
        surahId,
        verseNum,
        position: w.position,
        wordIdxInVerse,
        text_uthmani: w.text_uthmani,
        char_type_name: w.char_type_name,
        line_number: w.line_number,
        translation:
          typeof w.translation === "object" && w.translation !== null
            ? (w.translation as { text?: string }).text ?? ""
            : (w.translation as string | undefined),
      });
    }
  }
  if (all.length === 0) return null;
  const map = new Map<number, LineWord[]>();
  for (const w of all) {
    if (!map.has(w.line_number)) map.set(w.line_number, []);
    map.get(w.line_number)!.push(w);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a - b)
    .map(([lineNum, words]) => ({ lineNum, words }));
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

function loadAnnotations(type: "bm" | "hl" | "note"): Record<string, string> {
  const result: Record<string, string> = {};
  try {
    const prefix = `${LS_PREFIX}:${type}:`;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(prefix)) {
        const verseKey = k.slice(prefix.length);
        const val = localStorage.getItem(k);
        if (val !== null) result[verseKey] = val;
      }
    }
  } catch {
    /* ignore */
  }
  return result;
}

// ─── Sheet UI helpers ─────────────────────────────────────────────────────────

const sheetBtnBase: React.CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: "14px",
  padding: "14px 16px",
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "white",
  textAlign: "left",
};

const playerBtnBase: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "white",
  padding: "6px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

function MenuRow({
  icon,
  label,
  onClick,
  chevron,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  chevron?: boolean;
  destructive?: boolean;
}) {
  return (
    <button onClick={onClick} style={sheetBtnBase}>
      <span style={{ color: destructive ? "#f87171" : "#9ca3af", flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, fontSize: "15px", color: destructive ? "#f87171" : "white" }}>
        {label}
      </span>
      {chevron && <ChevronRight size={16} color="#4b5563" />}
    </button>
  );
}

function MenuDivider() {
  return <div style={{ height: "1px", background: "#2a2a2a", margin: "0 16px" }} />;
}

function MenuGroup({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ margin: "0 12px 10px", background: "#1a1a1a", borderRadius: "12px", overflow: "hidden" }}>
      {children}
    </div>
  );
}

function SubPanelHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "16px 16px 0", gap: "8px" }}>
      <button
        onClick={onBack}
        style={{ background: "none", border: "none", cursor: "pointer", color: "white", padding: "4px", display: "flex", alignItems: "center" }}
      >
        <ChevronLeft size={22} />
      </button>
      <span style={{ flex: 1, textAlign: "center", fontWeight: 600, fontSize: "15px", color: "white", marginRight: "30px" }}>
        {title}
      </span>
    </div>
  );
}

// ─── BayaanAyahSheet ──────────────────────────────────────────────────────────

function BayaanAyahSheet({
  ayah,
  sheetView,
  onChangeView,
  onClose,
  onNavigate,
  onPlayFromHere,
  onPlayRepeat,
  verses,
  childId,
  chapters,
  bookmarks,
  highlights,
  notes,
  onToggleBookmark,
  onSetHighlight,
  onSaveNote,
}: {
  ayah: AyahInfo;
  sheetView: SheetView;
  onChangeView: (v: SheetView) => void;
  onClose: () => void;
  onNavigate: (newAyah: AyahInfo) => void;
  onPlayFromHere: (ayah: AyahInfo) => void;
  onPlayRepeat: (ayah: AyahInfo, repeat: "1" | "3" | "5" | "loop") => void;
  verses: PageVerseData[];
  childId: string;
  chapters: Chapter[];
  bookmarks: Record<string, string>;
  highlights: Record<string, string>;
  notes: Record<string, string>;
  onToggleBookmark: (verseKey: string) => void;
  onSetHighlight: (verseKey: string, color: HighlightColor | null) => void;
  onSaveNote: (verseKey: string, text: string) => void;
}) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [noteText, setNoteText] = useState(notes[ayah.verseKey] ?? "");
  const [tafseerExpanded, setTafseerExpanded] = useState(false);

  useEffect(() => {
    setNoteText(notes[ayah.verseKey] ?? "");
    setTafseerExpanded(false);
  }, [ayah.verseKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const isBookmarked = !!bookmarks[ayah.verseKey];
  const currentHighlight = highlights[ayah.verseKey] as HighlightColor | undefined;
  const hasNote = !!(notes[ayah.verseKey]?.trim());

  const chapterInfo = chapters.find((c) => c.id === ayah.surahId);
  const surahName = chapterInfo?.name_simple ?? `Surah ${ayah.surahId}`;

  const { data: translation, isLoading: translationLoading, isError: translationError } = useQuery({
    queryKey: ["translation", ayah.verseKey],
    queryFn: () => fetchTranslation(ayah.verseKey),
    staleTime: Infinity,
    enabled: sheetView.type === "translation",
    retry: 1,
  });

  const { data: tafseerText, isLoading: tafseerLoading } = useQuery({
    queryKey: ["tafseer", ayah.verseKey],
    queryFn: () => fetchTafseer(ayah.surahId, ayah.verseNum),
    staleTime: Infinity,
    enabled: sheetView.type === "tafseer",
  });

  const { data: wbwWords, isLoading: wbwLoading } = useQuery({
    queryKey: ["wbw", ayah.verseKey],
    queryFn: () => fetchWBW(ayah.verseKey),
    staleTime: Infinity,
    enabled: sheetView.type === "wbw",
  });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(
        `${ayah.text_uthmani}\n\n${translation ?? ""}\n\n— Quran ${ayah.verseKey}`
      );
    } catch {
      /* ignore */
    }
    onClose();
  };

  const handleShare = async () => {
    const text = `${ayah.text_uthmani}\n\n${translation ?? ""}\n\n— Quran ${ayah.verseKey}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `Quran ${ayah.verseKey}`, text });
      } else {
        await navigator.clipboard.writeText(text);
      }
    } catch {
      /* ignore */
    }
    onClose();
  };

  const currentVerseIdx = verses.findIndex((v) => v.verse_key === ayah.verseKey);

  const navTo = (idx: number) => {
    if (idx < 0 || idx >= verses.length) return;
    const v = verses[idx];
    const [s, n] = v.verse_key.split(":").map(Number);
    onNavigate({ verseKey: v.verse_key, surahId: s, verseNum: n, text_uthmani: v.text_uthmani ?? "" });
  };

  const navBtnStyle = (disabled: boolean): React.CSSProperties => ({
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    padding: "10px",
    background: "#1a1a1a",
    border: "none",
    borderRadius: "10px",
    color: disabled ? "#4b5563" : "white",
    cursor: disabled ? "default" : "pointer",
    fontSize: "14px",
  });

  const renderContent = () => {
    switch (sheetView.type) {
      case "main":
        return (
          <div style={{ paddingBottom: "24px" }}>
            <div style={{ padding: "12px 16px 8px", borderBottom: "1px solid #1f1f1f" }}>
              <p style={{ fontWeight: 700, fontSize: "16px", color: "white", margin: 0 }}>{surahName}</p>
              <p style={{ fontSize: "12px", color: "#6b7280", margin: "2px 0 0" }}>{ayah.verseKey}</p>
            </div>
            <div style={{ height: "10px" }} />

            <MenuGroup>
              <MenuRow
                icon={<Play size={18} />}
                label="Play from Here"
                onClick={() => { onPlayFromHere(ayah); onClose(); }}
              />
              <MenuDivider />
              <MenuRow
                icon={<Repeat size={18} />}
                label="Repeat"
                onClick={() => onChangeView({ type: "repeat" })}
                chevron
              />
            </MenuGroup>

            <MenuGroup>
              <MenuRow
                icon={<Bookmark size={18} fill={isBookmarked ? "currentColor" : "none"} />}
                label={isBookmarked ? "Remove Bookmark" : "Bookmark"}
                onClick={() => onToggleBookmark(ayah.verseKey)}
                destructive={isBookmarked}
              />
              <MenuDivider />
              <MenuRow
                icon={<Highlighter size={18} />}
                label={currentHighlight ? "Change / Remove Highlight" : "Highlight"}
                onClick={() => onChangeView({ type: "highlight" })}
                chevron
              />
              <MenuDivider />
              <MenuRow
                icon={<FileText size={18} />}
                label={hasNote ? "Edit Note" : "Add Note"}
                onClick={() => onChangeView({ type: "note" })}
                chevron
              />
            </MenuGroup>

            <MenuGroup>
              <MenuRow
                icon={<Globe size={18} />}
                label="Translation"
                onClick={() => onChangeView({ type: "translation" })}
                chevron
              />
              <MenuDivider />
              <MenuRow
                icon={<Book size={18} />}
                label="Tafseer"
                onClick={() => onChangeView({ type: "tafseer" })}
                chevron
              />
              <MenuDivider />
              <MenuRow
                icon={<AlignLeft size={18} />}
                label="Word by Word"
                onClick={() => onChangeView({ type: "wbw" })}
                chevron
              />
            </MenuGroup>

            <MenuGroup>
              <MenuRow icon={<Copy size={18} />} label="Copy" onClick={handleCopy} />
              <MenuDivider />
              <MenuRow icon={<Share2 size={18} />} label="Share" onClick={handleShare} />
              <MenuDivider />
              <MenuRow
                icon={<BookOpen size={18} />}
                label="Memorize from here"
                onClick={() => {
                  setLocation(`/child/${childId}/quran-memorize?surah=${ayah.surahId}&mode=mushaf`);
                  onClose();
                }}
              />
              <MenuDivider />
              <MenuRow
                icon={<ExternalLink size={18} />}
                label="Open in Memorization Mushaf"
                onClick={() => {
                  setLocation(
                    `/child/${childId}/quran-memorize?surah=${ayah.surahId}&fromAyah=${ayah.verseNum}&toAyah=${ayah.verseNum}&mode=mushaf`
                  );
                  onClose();
                }}
              />
            </MenuGroup>
          </div>
        );

      case "repeat":
        return (
          <div style={{ paddingBottom: "24px" }}>
            <SubPanelHeader title="Repeat" onBack={() => onChangeView({ type: "main" })} />
            <div style={{ padding: "20px 16px" }}>
              <p style={{ color: "#9ca3af", fontSize: "13px", textAlign: "center", marginBottom: "16px" }}>
                {ayah.verseKey} · Repeat this verse
              </p>
              {(["1", "3", "5", "loop"] as const).map((count) => (
                <button
                  key={count}
                  onClick={() => { onPlayRepeat(ayah, count); onClose(); }}
                  style={{
                    width: "100%",
                    marginBottom: "8px",
                    padding: "14px 16px",
                    background: "#1a1a1a",
                    border: "none",
                    borderRadius: "10px",
                    color: "white",
                    fontSize: "15px",
                    cursor: "pointer",
                    textAlign: "left",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <Repeat size={16} color="#9ca3af" />
                  {count === "loop" ? "∞  Loop continuously" : `${count}×  ${count === "1" ? "Once" : `${count} times`}`}
                </button>
              ))}
            </div>
          </div>
        );

      case "translation":
        return (
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
            <div style={{ flexShrink: 0 }}>
              <SubPanelHeader title="Translation" onBack={() => onChangeView({ type: "main" })} />
              <p style={{ textAlign: "center", padding: "6px 16px 0", color: "#6b7280", fontSize: "12px", margin: 0 }}>
                {ayah.verseKey}
              </p>
              <div
                dir="rtl"
                style={{
                  padding: "12px 20px",
                  fontSize: "24px",
                  fontFamily: BAYAAN_MUSHAF_TEXT,
                  lineHeight: 2.1,
                  color: "white",
                  textAlign: "center",
                }}
              >
                {ayah.text_uthmani}
              </div>
              <p style={{ padding: "0 20px 4px", fontSize: "10px", color: "#6b7280", letterSpacing: "0.08em", textTransform: "uppercase", margin: 0 }}>
                Saheeh International
              </p>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 20px 8px" }}>
              {translationLoading ? (
                <p style={{ fontSize: "15px", color: "#6b7280", fontStyle: "italic", lineHeight: 1.75, margin: 0 }}>Loading…</p>
              ) : translationError ? (
                <div>
                  <p style={{ fontSize: "15px", color: "#6b7280", fontStyle: "italic", lineHeight: 1.75, margin: "0 0 12px" }}>
                    Could not load translation.
                  </p>
                  <button
                    onClick={() => queryClient.invalidateQueries({ queryKey: ["translation", ayah.verseKey] })}
                    style={{
                      padding: "8px 16px",
                      background: "#1a1a1a",
                      border: "1px solid #374151",
                      borderRadius: "8px",
                      color: "#9ca3af",
                      fontSize: "13px",
                      cursor: "pointer",
                    }}
                  >
                    Retry
                  </button>
                </div>
              ) : translation ? (
                <p style={{ fontSize: "15px", color: "#d1d5db", lineHeight: 1.75, margin: 0 }}>{translation}</p>
              ) : (
                <p style={{ fontSize: "15px", color: "#6b7280", fontStyle: "italic", lineHeight: 1.75, margin: 0 }}>Loading…</p>
              )}
            </div>
            <div style={{ flexShrink: 0, display: "flex", gap: "8px", padding: "10px 16px 16px", borderTop: "1px solid #1f1f1f" }}>
              <button disabled={currentVerseIdx <= 0} onClick={() => navTo(currentVerseIdx - 1)} style={navBtnStyle(currentVerseIdx <= 0)}>
                <ChevronLeft size={16} /> Previous
              </button>
              <button disabled={currentVerseIdx >= verses.length - 1} onClick={() => navTo(currentVerseIdx + 1)} style={navBtnStyle(currentVerseIdx >= verses.length - 1)}>
                Next <ChevronRight size={16} />
              </button>
            </div>
          </div>
        );

      case "tafseer":
        return (
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
            <div style={{ flexShrink: 0 }}>
              <SubPanelHeader title="Tafseer" onBack={() => onChangeView({ type: "main" })} />
              <p style={{ textAlign: "center", padding: "6px 16px 0", color: "#6b7280", fontSize: "12px", margin: 0 }}>
                {ayah.verseKey}
              </p>
              <div
                dir="rtl"
                style={{
                  padding: "10px 20px",
                  fontSize: "20px",
                  fontFamily: BAYAAN_MUSHAF_TEXT,
                  lineHeight: 2,
                  color: "white",
                  textAlign: "center",
                }}
              >
                {ayah.text_uthmani}
              </div>
              <p style={{ padding: "0 20px 4px", fontSize: "10px", color: "#6b7280", letterSpacing: "0.08em", textTransform: "uppercase", margin: 0 }}>
                Ibn Kathir (Abridged)
              </p>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 20px 8px" }}>
              {tafseerLoading ? (
                <p style={{ fontSize: "14px", color: "#6b7280", fontStyle: "italic", margin: 0 }}>Loading…</p>
              ) : tafseerText ? (
                (() => {
                  const PREVIEW = 150;
                  const isLong = tafseerText.length > PREVIEW;
                  return (
                    <div>
                      <div style={{ position: "relative" }}>
                        <p style={{ fontSize: "14px", color: "#d1d5db", lineHeight: 1.8, margin: 0 }}>
                          {tafseerExpanded || !isLong ? tafseerText : tafseerText.slice(0, PREVIEW) + "…"}
                        </p>
                        {isLong && !tafseerExpanded && (
                          <div
                            style={{
                              position: "absolute",
                              bottom: 0, left: 0, right: 0,
                              height: "48px",
                              background: "linear-gradient(transparent, #0d0d0d)",
                              pointerEvents: "none",
                            }}
                          />
                        )}
                      </div>
                      {isLong && (
                        <button
                          onClick={() => setTafseerExpanded((e) => !e)}
                          style={{
                            marginTop: "10px",
                            padding: "6px 14px",
                            background: "none",
                            border: "1px solid #374151",
                            borderRadius: "6px",
                            color: "#60a5fa",
                            fontSize: "13px",
                            cursor: "pointer",
                          }}
                        >
                          {tafseerExpanded ? "Show less" : "Read more"}
                        </button>
                      )}
                    </div>
                  );
                })()
              ) : (
                <p style={{ fontSize: "14px", color: "#6b7280", fontStyle: "italic", margin: 0 }}>Tafseer unavailable</p>
              )}
            </div>
            <div style={{ flexShrink: 0, display: "flex", gap: "8px", padding: "10px 16px 16px", borderTop: "1px solid #1f1f1f" }}>
              <button disabled={currentVerseIdx <= 0} onClick={() => navTo(currentVerseIdx - 1)} style={navBtnStyle(currentVerseIdx <= 0)}>
                <ChevronLeft size={16} /> Previous
              </button>
              <button disabled={currentVerseIdx >= verses.length - 1} onClick={() => navTo(currentVerseIdx + 1)} style={navBtnStyle(currentVerseIdx >= verses.length - 1)}>
                Next <ChevronRight size={16} />
              </button>
            </div>
          </div>
        );

      case "wbw":
        return (
          <div style={{ paddingBottom: "24px" }}>
            <SubPanelHeader title="Word by Word" onBack={() => onChangeView({ type: "main" })} />
            <p style={{ textAlign: "center", padding: "6px 16px 8px", color: "#6b7280", fontSize: "12px", margin: 0 }}>
              {ayah.verseKey}
            </p>
            {wbwLoading ? (
              <div style={{ padding: "24px", textAlign: "center", color: "#6b7280" }}>Loading…</div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "8px",
                  padding: "8px 16px 16px",
                  direction: "rtl",
                }}
              >
                {(wbwWords ?? []).map((w) => (
                  <div
                    key={w.position}
                    style={{ background: "#1a1a1a", borderRadius: "10px", padding: "10px 8px", textAlign: "center" }}
                  >
                    <div dir="rtl" style={{ fontSize: "20px", fontFamily: BAYAAN_MUSHAF_TEXT, lineHeight: 1.6, color: "white" }}>
                      {w.text_uthmani}
                    </div>
                    <div style={{ fontSize: "10px", color: "#9ca3af", marginTop: "4px", direction: "ltr" }}>
                      {typeof w.transliteration === "object" && w.transliteration ? w.transliteration.text : ""}
                    </div>
                    <div style={{ fontSize: "11px", color: "#d1d5db", marginTop: "2px", direction: "ltr" }}>
                      {typeof w.translation === "object" && w.translation
                        ? (w.translation as { text: string }).text
                        : typeof w.translation === "string"
                        ? w.translation
                        : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case "highlight":
        return (
          <div style={{ paddingBottom: "24px" }}>
            <SubPanelHeader title="Highlight" onBack={() => onChangeView({ type: "main" })} />
            <div style={{ padding: "20px 16px" }}>
              <div style={{ display: "flex", gap: "12px", justifyContent: "center", marginBottom: "20px" }}>
                {(Object.entries(HIGHLIGHT_COLORS) as [HighlightColor, typeof HIGHLIGHT_COLORS[HighlightColor]][]).map(
                  ([color, meta]) => (
                    <button
                      key={color}
                      onClick={() => { onSetHighlight(ayah.verseKey, color); onChangeView({ type: "main" }); }}
                      style={{
                        width: "52px",
                        height: "52px",
                        borderRadius: "50%",
                        background: meta.bg,
                        border: currentHighlight === color ? `3px solid ${meta.dot}` : "3px solid transparent",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      title={meta.label}
                    >
                      <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: meta.dot }} />
                    </button>
                  )
                )}
              </div>
              {currentHighlight && (
                <button
                  onClick={() => { onSetHighlight(ayah.verseKey, null); onChangeView({ type: "main" }); }}
                  style={{
                    width: "100%",
                    padding: "12px",
                    background: "#1a1a1a",
                    border: "1px solid #374151",
                    borderRadius: "10px",
                    color: "#f87171",
                    fontSize: "14px",
                    cursor: "pointer",
                  }}
                >
                  Remove Highlight
                </button>
              )}
            </div>
          </div>
        );

      case "note":
        return (
          <div style={{ paddingBottom: "24px" }}>
            <SubPanelHeader title={hasNote ? "Edit Note" : "Add Note"} onBack={() => onChangeView({ type: "main" })} />
            <div style={{ padding: "16px" }}>
              <p style={{ fontSize: "12px", color: "#6b7280", marginBottom: "8px", margin: "0 0 8px" }}>{ayah.verseKey}</p>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Write your note here…"
                autoFocus
                rows={5}
                style={{
                  width: "100%",
                  background: "#1a1a1a",
                  border: "1px solid #2a2a2a",
                  borderRadius: "10px",
                  padding: "12px",
                  color: "white",
                  fontSize: "14px",
                  resize: "vertical",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                <button
                  onClick={() => { onSaveNote(ayah.verseKey, noteText); onChangeView({ type: "main" }); }}
                  style={{
                    flex: 1,
                    padding: "12px",
                    background: "#2563eb",
                    border: "none",
                    borderRadius: "10px",
                    color: "white",
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Save Note
                </button>
                {hasNote && (
                  <button
                    onClick={() => { onSaveNote(ayah.verseKey, ""); onChangeView({ type: "main" }); }}
                    style={{
                      padding: "12px 16px",
                      background: "#1a1a1a",
                      border: "1px solid #374151",
                      borderRadius: "10px",
                      color: "#f87171",
                      fontSize: "14px",
                      cursor: "pointer",
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <div
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 70 }}
        onClick={onClose}
      />
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#0d0d0d",
          borderRadius: "20px 20px 0 0",
          zIndex: 80,
          color: "white",
          ...(sheetView.type === "tafseer" || sheetView.type === "translation"
            ? { height: "82vh", overflow: "hidden", display: "flex", flexDirection: "column" as const }
            : { maxHeight: "82vh", overflowY: "auto" as const }),
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ width: "40px", height: "4px", background: "#333", borderRadius: "2px", margin: "12px auto 0", flexShrink: 0 }} />
        {sheetView.type === "tafseer" || sheetView.type === "translation" ? (
          <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {renderContent()}
          </div>
        ) : (
          renderContent()
        )}
      </div>
    </>
  );
}

// ─── FloatingPlayerBar ────────────────────────────────────────────────────────

function FloatingPlayerBar({
  playerState,
  onToggle,
  onStop,
  onPrev,
  onNext,
  onSettings,
}: {
  playerState: PlayerState;
  onToggle: () => void;
  onStop: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSettings: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: "16px",
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        zIndex: 67,
        padding: "0 16px",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          background: "#1a1a1a",
          borderRadius: "9999px",
          padding: "8px 16px",
          display: "flex",
          alignItems: "center",
          gap: "2px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
          pointerEvents: "auto",
          color: "white",
        }}
      >
        <span style={{ fontSize: "11px", color: "#9ca3af", marginRight: "6px", minWidth: "36px", textAlign: "center" }}>
          {playerState.surahId}:{playerState.ayahNum}
        </span>
        <button onClick={onStop} style={playerBtnBase} title="Stop">
          <Square size={14} fill="currentColor" />
        </button>
        <button onClick={onPrev} style={playerBtnBase} title="Previous">
          <SkipBack size={16} />
        </button>
        <button
          onClick={onToggle}
          style={{
            ...playerBtnBase,
            background: "rgba(255,255,255,0.15)",
            borderRadius: "50%",
            width: "36px",
            height: "36px",
            margin: "0 2px",
          }}
          title={playerState.status === "playing" ? "Pause" : "Play"}
        >
          {playerState.status === "playing" ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button onClick={onNext} style={playerBtnBase} title="Next">
          <SkipForward size={16} />
        </button>
        <button onClick={onSettings} style={playerBtnBase} title="Playback settings">
          <Settings size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── PlaybackSettingsSheet ────────────────────────────────────────────────────

function PlaybackSettingsSheet({
  verses,
  playerSettings,
  playerState,
  onPlay,
  onClose,
}: {
  verses: PageVerseData[];
  playerSettings: PlayerSettingsState;
  playerState: PlayerState | null;
  onPlay: (startVK: string, endVK: string | null, settings: PlayerSettingsState) => void;
  onClose: () => void;
}) {
  const initStart = playerState
    ? `${playerState.surahId}:${playerState.ayahNum}`
    : (verses[0]?.verse_key ?? "");

  const [reciterFolder, setReciterFolder] = useState(playerSettings.reciterFolder);
  const [rate, setRate] = useState(playerSettings.rate);
  const [repeat, setRepeat] = useState(playerSettings.repeat);
  const [rangeRepeat, setRangeRepeat] = useState(playerSettings.rangeRepeat);
  const [startVK, setStartVK] = useState(initStart);
  const [endVK, setEndVK] = useState("");

  const pillStyle = (active: boolean): React.CSSProperties => ({
    padding: "6px 12px",
    borderRadius: "9999px",
    border: active ? "1px solid #3b82f6" : "1px solid #374151",
    background: active ? "#1d4ed8" : "#1a1a1a",
    color: active ? "white" : "#9ca3af",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: active ? 600 : 400,
  });

  const blockBtnStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: "8px",
    border: active ? "1px solid #3b82f6" : "1px solid #374151",
    background: active ? "#1d4ed8" : "#1a1a1a",
    borderRadius: "8px",
    color: active ? "white" : "#9ca3af",
    cursor: "pointer",
    fontSize: "13px",
    textAlign: "center",
  });

  const selectStyle: React.CSSProperties = {
    width: "100%",
    background: "#1a1a1a",
    border: "1px solid #2a2a2a",
    borderRadius: "8px",
    padding: "10px",
    color: "white",
    fontSize: "14px",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "11px",
    color: "#9ca3af",
    marginBottom: "8px",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    display: "block",
  };

  return (
    <>
      <div
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 82 }}
        onClick={onClose}
      />
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#0d0d0d",
          borderRadius: "20px 20px 0 0",
          zIndex: 83,
          maxHeight: "85vh",
          overflowY: "auto",
          color: "white",
          paddingBottom: "24px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ width: "40px", height: "4px", background: "#333", borderRadius: "2px", margin: "12px auto 0" }} />
        <div style={{ display: "flex", alignItems: "center", padding: "16px 16px 0" }}>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "white", padding: "4px", display: "flex" }}>
            <ChevronLeft size={22} />
          </button>
          <span style={{ flex: 1, textAlign: "center", fontWeight: 600, fontSize: "15px", marginRight: "30px" }}>
            Playback Settings
          </span>
        </div>

        <div style={{ padding: "16px" }}>
          {verses.length > 0 && (
            <div style={{ marginBottom: "16px" }}>
              <span style={labelStyle}>Starting Verse</span>
              <select value={startVK} onChange={(e) => setStartVK(e.target.value)} style={selectStyle}>
                {verses.map((v) => (
                  <option key={v.verse_key} value={v.verse_key}>{v.verse_key}</option>
                ))}
              </select>
            </div>
          )}

          {verses.length > 0 && (
            <div style={{ marginBottom: "16px" }}>
              <span style={labelStyle}>Ending Verse (optional)</span>
              <select value={endVK} onChange={(e) => setEndVK(e.target.value)} style={selectStyle}>
                <option value="">— Play to surah end</option>
                {verses.map((v) => (
                  <option key={v.verse_key} value={v.verse_key}>{v.verse_key}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ marginBottom: "16px" }}>
            <span style={labelStyle}>Reciter</span>
            <select value={reciterFolder} onChange={(e) => setReciterFolder(e.target.value)} style={selectStyle}>
              {RECITERS.map((r) => (
                <option key={r.folder} value={r.folder}>{r.name}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <span style={labelStyle}>Playback Speed</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {SPEED_OPTIONS.map((s) => (
                <button key={s} onClick={() => setRate(s)} style={pillStyle(rate === s)}>
                  {s}×
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <span style={labelStyle}>Play each verse</span>
            <div style={{ display: "flex", gap: "6px" }}>
              {(["1", "3", "5", "loop"] as const).map((r) => (
                <button key={r} onClick={() => setRepeat(r)} style={blockBtnStyle(repeat === r)}>
                  {r === "loop" ? "∞" : `${r}×`}
                </button>
              ))}
            </div>
          </div>

          {endVK && (
            <div style={{ marginBottom: "16px" }}>
              <span style={labelStyle}>Play the range</span>
              <div style={{ display: "flex", gap: "6px" }}>
                {(["1", "2", "3", "loop"] as const).map((r) => (
                  <button key={r} onClick={() => setRangeRepeat(r)} style={blockBtnStyle(rangeRepeat === r)}>
                    {r === "loop" ? "∞" : `${r}×`}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => onPlay(startVK, endVK || null, { reciterFolder, rate, repeat, rangeRepeat })}
            style={{
              width: "100%",
              padding: "14px",
              background: "#16a34a",
              border: "none",
              borderRadius: "12px",
              color: "white",
              fontSize: "16px",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            <Play size={18} /> Play
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function MushafReaderPage() {
  const { childId } = useParams<{ childId: string }>();
  const rawSearch = useSearch();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [currentPage, setCurrentPage] = useState(() => {
    const params = new URLSearchParams(rawSearch.startsWith("?") ? rawSearch.slice(1) : rawSearch);
    const urlPage = parseInt(params.get("page") ?? "0", 10);
    if (urlPage >= 1) return Math.max(1, Math.min(TOTAL_PAGES, urlPage));
    // Secondary fallback: resume from cached dashboard readingGoal.lastPage
    const cached = queryClient.getQueryData<{ readingGoal?: { lastPage?: number | null } }>(["dashboard", childId]);
    const lastPage = cached?.readingGoal?.lastPage;
    if (lastPage && lastPage >= 1) return Math.max(1, Math.min(TOTAL_PAGES, lastPage));
    return 1;
  });
  const [jumpInput, setJumpInput] = useState("");
  const [surahJumpValue, setSurahJumpValue] = useState("");
  const [juzJumpValue, setJuzJumpValue] = useState("");
  const [jumpTab, setJumpTab] = useState<"surah" | "juz">("surah");
  const [isBlindMode, setIsBlindMode] = useState(false);
  const [revealedVerseKeys, setRevealedVerseKeys] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedVerseKeys, setSelectedVerseKeys] = useState<Set<string>>(new Set());

  const [isRecitePickMode, setIsRecitePickMode] = useState(false);
  const [isReciting, setIsReciting] = useState(false);
  const [reciteStartVerseKey, setReciteStartVerseKey] = useState<string | null>(null);
  const [reciteUnlockedWords, setReciteUnlockedWords] = useState<Set<string>>(new Set());
  const [showChrome, setShowChrome] = useState(true);

  // Bayaan sheet state
  const [sheetView, setSheetView] = useState<SheetView | null>(null);
  const [sheetAyah, setSheetAyah] = useState<AyahInfo | null>(null);

  // Annotation state (loaded from localStorage on mount)
  const [bookmarks, setBookmarks] = useState<Record<string, string>>(() => loadAnnotations("bm"));
  const [highlights, setHighlights] = useState<Record<string, string>>(() => loadAnnotations("hl"));
  const [notes, setNotes] = useState<Record<string, string>>(() => loadAnnotations("note"));

  // Player state
  const [playerState, setPlayerState] = useState<PlayerState | null>(null);
  const [playerSettings, setPlayerSettings] = useState<PlayerSettingsState>(() => {
    let reciterFolder = "Alafasy_128kbps";
    try { reciterFolder = localStorage.getItem(`${LS_PREFIX}:reciter`) ?? "Alafasy_128kbps"; } catch {}
    return { reciterFolder, rate: 1, repeat: "1", rangeRepeat: "1" };
  });
  const [showSettingsSheet, setShowSettingsSheet] = useState(false);

  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const recognitionRef = useRef<any>(null);
  const recitePageWordsRef = useRef<ReciteWord[]>([]);
  const reciteWordPosRef = useRef(0);
  const reciteUnlockedWordsRef = useRef<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const preloadRef = useRef<HTMLAudioElement | null>(null);
  const playerStateRef = useRef<PlayerState | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const longPressFiredRef = useRef(false);
  const versesRef = useRef<PageVerseData[]>([]);
  const currentPageRef = useRef(1);
  const goToPageRef = useRef<(page: number) => void>(() => {});
  const readingGoalEnabledRef = useRef(false);

  // Keep playerStateRef in sync with playerState on every render
  playerStateRef.current = playerState;
  reciteUnlockedWordsRef.current = reciteUnlockedWords;

  // Audio element setup — once on mount
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";
    audioRef.current = audio;

    const preload = new Audio();
    preload.preload = "auto";
    preloadRef.current = preload;

    audio.onended = () => {
      const ps = playerStateRef.current;
      if (!ps) return;

      // Per-verse repeat
      const maxRepeat = ps.repeat === "loop" ? Infinity : parseInt(ps.repeat);
      if (ps.repeatCount < maxRepeat - 1) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
        setPlayerState((p) => (p ? { ...p, repeatCount: p.repeatCount + 1 } : null));
        return;
      }

      const nextAyah = ps.ayahNum + 1;

      // Range end check
      if (ps.rangeEnd !== null && nextAyah > ps.rangeEnd) {
        const maxRangeRepeat = ps.rangeRepeat === "loop" ? Infinity : parseInt(ps.rangeRepeat);
        if (ps.rangeRepeatCount < maxRangeRepeat - 1) {
          const url = audioUrl(ps.reciterFolder, ps.surahId, ps.rangeStart);
          audio.src = url;
          audio.playbackRate = ps.rate;
          audio.play().catch(() => {});
          setPlayerState((p) =>
            p ? { ...p, ayahNum: ps.rangeStart, repeatCount: 0, rangeRepeatCount: p.rangeRepeatCount + 1, status: "playing" } : null
          );
          // Preload start+1 for next range iteration
          if (preloadRef.current) {
            preloadRef.current.src = audioUrl(ps.reciterFolder, ps.surahId, ps.rangeStart + 1);
            preloadRef.current.load();
          }
          return;
        }
        setPlayerState(null);
        return;
      }

      // Advance to next ayah
      const url = audioUrl(ps.reciterFolder, ps.surahId, nextAyah);
      audio.src = url;
      audio.playbackRate = ps.rate;
      audio.play().catch(() => {});
      setPlayerState((p) => (p ? { ...p, ayahNum: nextAyah, repeatCount: 0, status: "playing" } : null));
      // Preload N+2 now that N+1 is playing
      if (preloadRef.current) {
        preloadRef.current.src = audioUrl(ps.reciterFolder, ps.surahId, nextAyah + 1);
        preloadRef.current.load();
      }
      // Flip page if the next ayah is not on the current page
      const nextVK = `${ps.surahId}:${nextAyah}`;
      if (!versesRef.current.some((v) => v.verse_key === nextVK)) {
        goToPageRef.current(currentPageRef.current + 1);
      }
    };

    return () => {
      audio.pause();
      audioRef.current = null;
      preload.pause();
      preloadRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset interactive state when page changes — player intentionally excluded
  useEffect(() => {
    setRevealedVerseKeys(new Set());
    setSheetView(null);
    setSheetAyah(null);
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsReciting(false);
    setIsRecitePickMode(false);
    setReciteStartVerseKey(null);
    setReciteUnlockedWords(new Set());
    reciteWordPosRef.current = 0;
  }, [currentPage]);

  // Snapshot isEnabled at mount so we don't depend on a cache that may go stale while reading
  useEffect(() => {
    const cached = queryClient.getQueryData<{ readingGoal?: { isEnabled?: boolean } }>(["dashboard", childId]);
    readingGoalEnabledRef.current = cached?.readingGoal?.isEnabled ?? false;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep URL in sync — if the component ever remounts it reads the correct page, not the stale mount-time URL
  useEffect(() => {
    window.history.replaceState(null, "", `?page=${currentPage}`);
  }, [currentPage]);

  // Report every page turn — sendBeacon survives tab close/back-navigation; keepalive fetch as fallback
  useEffect(() => {
    if (!readingGoalEnabledRef.current) return;
    const url = `/api/children/${childId}/reading-progress`;
    const body = JSON.stringify({ currentPage });
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, blob);
    } else {
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }
    // Optimistically update cache so dashboard shows the correct resume page before POST resolves
    queryClient.setQueryData(["dashboard", childId], (old: any) => {
      if (!old?.readingGoal) return old;
      return { ...old, readingGoal: { ...old.readingGoal, lastPage: currentPage } };
    });
  }, [currentPage, childId, queryClient]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup recognition on unmount
  useEffect(() => {
    return () => { recognitionRef.current?.stop(); };
  }, []);

  // Page data
  const { data: pageData, isLoading, isError } = useQuery({
    queryKey: ["mushaf-reader-page", currentPage],
    queryFn: () => fetchVersesByPage(currentPage),
    staleTime: 1000 * 60 * 60,
  });

  // Prefetch adjacent pages
  const prefetchNext = useCallback(
    (page: number) => {
      if (page < TOTAL_PAGES) {
        queryClient.prefetchQuery({
          queryKey: ["mushaf-reader-page", page + 1],
          queryFn: () => fetchVersesByPage(page + 1),
          staleTime: 1000 * 60 * 60,
        });
      }
      if (page > 1) {
        queryClient.prefetchQuery({
          queryKey: ["mushaf-reader-page", page - 1],
          queryFn: () => fetchVersesByPage(page - 1),
          staleTime: 1000 * 60 * 60,
        });
      }
    },
    [queryClient]
  );

  const { data: chaptersData } = useQuery({
    queryKey: ["chapters"],
    queryFn: fetchAllChapters,
    staleTime: Infinity,
  });
  const chapters = chaptersData?.chapters ?? [];

  const { data: memData } = useQuery({
    queryKey: ["memorization", childId],
    queryFn: () => listMemorization(parseInt(childId, 10)),
    staleTime: 30000,
  });

  const markMutation = useMutation({
    mutationFn: async () => {
      const latestMemData =
        (await queryClient.ensureQueryData({
          queryKey: ["memorization", childId],
          queryFn: () => listMemorization(parseInt(childId, 10)),
        })) ?? memData;
      const latestProgress = latestMemData?.progress ?? [];
      const bySurahNumber = new Map<number, number[]>();
      for (const vk of selectedVerseKeys) {
        const parts = vk.split(":");
        const canonicalSurahNumber = parseInt(parts[0], 10);
        const verseNumber = parseInt(parts[1], 10);
        if (!bySurahNumber.has(canonicalSurahNumber)) bySurahNumber.set(canonicalSurahNumber, []);
        bySurahNumber.get(canonicalSurahNumber)!.push(verseNumber);
      }
      for (const [canonicalSurahNumber, newAyahs] of bySurahNumber) {
        const existing =
          latestProgress.find((p) => p.surahNumber === canonicalSurahNumber)?.memorizedAyahs ?? [];
        const merged = Array.from(new Set([...existing, ...newAyahs])).sort((a, b) => a - b);
        await updateMemorization(parseInt(childId, 10), {
          surahId: canonicalSurahNumber,
          memorizedAyahs: merged,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["memorization", childId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", childId] });
      setSelectedVerseKeys(new Set());
      setIsSelectMode(false);
    },
  });

  const verses = pageData?.verses ?? [];
  versesRef.current = verses;
  currentPageRef.current = currentPage;
  const lineGroups = useMemo(() => buildLineGroups(verses), [verses]);

  const surahsStartingOnPage = useMemo(() => {
    const s = new Set<number>();
    for (const v of verses) {
      const parts = v.verse_key.split(":");
      if (parseInt(parts[1], 10) === 1) s.add(parseInt(parts[0], 10));
    }
    return s;
  }, [verses]);

  const currentSurahName = useMemo(() => {
    if (!lineGroups?.length) return "";
    const firstWord = lineGroups[0].words[0];
    if (!firstWord) return "";
    const ch = chapters.find((c) => c.id === firstWord.surahId);
    return ch?.name_simple ?? `Surah ${firstWord.surahId}`;
  }, [lineGroups, chapters]);

  const primarySurahId = lineGroups?.[0]?.words[0]?.surahId ?? 1;
  const primarySurahName = currentSurahName || "Al-Fatihah";
  const pageSurahNames = verses.length > 0 ? getArabicSurahNamesForPage(verses, chapters) : "";

  const { pageContentRefs, pageMeasureRefs, isMushafContentVisible, getCachedScale } =
    useBayaanMushafFit({
      surahNumber: primarySurahId,
      surahName: primarySurahName,
      mushafFitContentKey: String(currentPage),
      pageNumbers: [currentPage],
      isSinglePageLayout: true,
    });

  const pageContentRefCb = useCallback(
    (node: HTMLDivElement | null) => { pageContentRefs.current[currentPage] = node; },
    [currentPage, pageContentRefs]
  );
  const pageMeasureRefCb = useCallback(
    (node: HTMLDivElement | null) => { pageMeasureRefs.current[currentPage] = node; },
    [currentPage, pageMeasureRefs]
  );

  // ─── Annotation handlers ──────────────────────────────────────────────────

  const handleToggleBookmark = useCallback((verseKey: string) => {
    try {
      const [s, v] = verseKey.split(":").map(Number);
      const key = `${LS_PREFIX}:bm:${s}:${v}`;
      if (bookmarks[verseKey]) {
        localStorage.removeItem(key);
        setBookmarks((prev) => { const n = { ...prev }; delete n[verseKey]; return n; });
      } else {
        localStorage.setItem(key, "1");
        setBookmarks((prev) => ({ ...prev, [verseKey]: "1" }));
      }
    } catch {
      /* ignore */
    }
  }, [bookmarks]);

  const handleSetHighlight = useCallback((verseKey: string, color: HighlightColor | null) => {
    try {
      const [s, v] = verseKey.split(":").map(Number);
      const key = `${LS_PREFIX}:hl:${s}:${v}`;
      if (!color) {
        localStorage.removeItem(key);
        setHighlights((prev) => { const n = { ...prev }; delete n[verseKey]; return n; });
      } else {
        localStorage.setItem(key, color);
        setHighlights((prev) => ({ ...prev, [verseKey]: color }));
      }
    } catch {
      /* ignore */
    }
  }, []);

  const handleSaveNote = useCallback((verseKey: string, text: string) => {
    try {
      const [s, v] = verseKey.split(":").map(Number);
      const key = `${LS_PREFIX}:note:${s}:${v}`;
      if (!text.trim()) {
        localStorage.removeItem(key);
        setNotes((prev) => { const n = { ...prev }; delete n[verseKey]; return n; });
      } else {
        localStorage.setItem(key, text);
        setNotes((prev) => ({ ...prev, [verseKey]: text }));
      }
    } catch {
      /* ignore */
    }
  }, []);

  // ─── Player handlers ──────────────────────────────────────────────────────

  const playFromAyah = useCallback(
    (
      ayah: AyahInfo,
      opts?: {
        repeat?: "1" | "3" | "5" | "loop";
        rangeEnd?: number | null;
        reciterFolder?: string;
        rate?: number;
        rangeRepeat?: "1" | "2" | "3" | "loop";
      }
    ) => {
      const recFolder = opts?.reciterFolder ?? playerSettings.reciterFolder;
      const rt = opts?.rate ?? playerSettings.rate;
      const rep = opts?.repeat ?? "1";
      const rangeEnd = opts?.rangeEnd ?? null;
      const rangeRep = opts?.rangeRepeat ?? "1";

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = audioUrl(recFolder, ayah.surahId, ayah.verseNum);
        audioRef.current.playbackRate = rt;
        audioRef.current.play().catch(() => {});
      }
      // Preload next ayah while current plays
      if (preloadRef.current) {
        preloadRef.current.src = audioUrl(recFolder, ayah.surahId, ayah.verseNum + 1);
        preloadRef.current.load();
      }
      // Persist reciter selection
      try { localStorage.setItem(`${LS_PREFIX}:reciter`, recFolder); } catch {}
      setPlayerState({
        status: "playing",
        surahId: ayah.surahId,
        ayahNum: ayah.verseNum,
        rangeStart: ayah.verseNum,
        rangeEnd,
        reciterFolder: recFolder,
        rate: rt,
        repeat: rep,
        repeatCount: 0,
        rangeRepeat: rangeRep,
        rangeRepeatCount: 0,
      });
      setPlayerSettings((prev) => ({ ...prev, reciterFolder: recFolder, rate: rt, repeat: rep, rangeRepeat: rangeRep }));
    },
    [playerSettings]
  );

  const playerToggle = useCallback(() => {
    const audio = audioRef.current;
    const ps = playerStateRef.current;
    if (!audio || !ps) return;
    if (ps.status === "playing") {
      audio.pause();
      setPlayerState((prev) => prev ? { ...prev, status: "paused" } : null);
    } else {
      audio.play().catch(() => {});
      setPlayerState((prev) => prev ? { ...prev, status: "playing" } : null);
    }
  }, []);

  const playerStop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    setPlayerState(null);
  }, []);

  const playerPrev = useCallback(() => {
    const audio = audioRef.current;
    const ps = playerStateRef.current;
    if (!audio || !ps) return;
    const prevAyah = Math.max(1, ps.ayahNum - 1);
    audio.src = audioUrl(ps.reciterFolder, ps.surahId, prevAyah);
    audio.playbackRate = ps.rate;
    audio.play().catch(() => {});
    if (preloadRef.current) {
      preloadRef.current.src = audioUrl(ps.reciterFolder, ps.surahId, prevAyah + 1);
      preloadRef.current.load();
    }
    setPlayerState((prev) => prev ? { ...prev, ayahNum: prevAyah, repeatCount: 0, status: "playing" } : null);
  }, []);

  const playerNext = useCallback(() => {
    const audio = audioRef.current;
    const ps = playerStateRef.current;
    if (!audio || !ps) return;
    const nextAyah = ps.ayahNum + 1;
    audio.src = audioUrl(ps.reciterFolder, ps.surahId, nextAyah);
    audio.playbackRate = ps.rate;
    audio.play().catch(() => {});
    if (preloadRef.current) {
      preloadRef.current.src = audioUrl(ps.reciterFolder, ps.surahId, nextAyah + 1);
      preloadRef.current.load();
    }
    setPlayerState((prev) => prev ? { ...prev, ayahNum: nextAyah, repeatCount: 0, status: "playing" } : null);
    const nextVK = `${ps.surahId}:${nextAyah}`;
    if (!versesRef.current.some((v) => v.verse_key === nextVK)) {
      goToPageRef.current(currentPageRef.current + 1);
    }
  }, []);

  // ─── Recite helpers ───────────────────────────────────────────────────────

  const stopReciting = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsReciting(false);
    setIsRecitePickMode(false);
    setReciteStartVerseKey(null);
    setReciteUnlockedWords(new Set());
    reciteUnlockedWordsRef.current = new Set();
    reciteWordPosRef.current = 0;
  }, []);

  const startReciting = useCallback(
    (startVerseKey: string) => {
      if (!lineGroups) return;
      const words: ReciteWord[] = [];
      for (const { words: lws } of lineGroups) {
        for (const lw of lws) {
          if (lw.char_type_name !== "end" && !SKIP_CHARS.test(lw.text_uthmani)) {
            words.push({
              verse_key: lw.verse_key,
              surahId: lw.surahId,
              verseNum: lw.verseNum,
              position: lw.position,
              text_uthmani: lw.text_uthmani,
            });
          }
        }
      }
      recitePageWordsRef.current = words;
      const startIdx = words.findIndex((w) => w.verse_key === startVerseKey);
      reciteWordPosRef.current = Math.max(0, startIdx);
      setReciteStartVerseKey(startVerseKey);
      const emptySet = new Set<string>();
      setReciteUnlockedWords(emptySet);
      reciteUnlockedWordsRef.current = emptySet;
      setIsReciting(true);

      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SR) {
        alert("Speech recognition not supported in this browser. Try Chrome.");
        setIsReciting(false);
        return;
      }
      const recognition = new SR();
      recognition.lang = "ar-SA";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognitionRef.current = recognition;

      recognition.onresult = (event: any) => {
        const result = event.results[event.results.length - 1];
        if (!result) return;
        const transcript = result[0].transcript.trim();
        const heardWords = stripTashkeel(transcript).split(/\s+/).filter(Boolean);
        const pageWords = recitePageWordsRef.current;
        let pos = reciteWordPosRef.current;
        const newUnlocked = new Set(reciteUnlockedWordsRef.current);
        let advanced = false;
        for (const heard of heardWords) {
          if (pos >= pageWords.length) break;
          const expected = stripTashkeel(pageWords[pos].text_uthmani);
          if (expected.length <= 1) { pos++; continue; }
          if (heard === expected || expected.startsWith(heard) || heard.startsWith(expected)) {
            newUnlocked.add(`${pageWords[pos].verse_key}:${pageWords[pos].position}`);
            pos++;
            advanced = true;
          }
        }
        if (advanced) {
          reciteWordPosRef.current = pos;
          reciteUnlockedWordsRef.current = newUnlocked;
          setReciteUnlockedWords(new Set(newUnlocked));
        }
      };
      recognition.onerror = () => {};
      recognition.start();
    },
    [lineGroups]
  );

  // ─── Navigation ───────────────────────────────────────────────────────────

  const goToPage = (page: number) => {
    const clamped = Math.max(1, Math.min(TOTAL_PAGES, page));
    setCurrentPage(clamped);
    prefetchNext(clamped);
  };
  goToPageRef.current = goToPage;

  const handlePageInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const val = parseInt(jumpInput, 10);
      if (!isNaN(val)) { goToPage(val); setJumpInput(""); }
    }
  };

  const handleSurahJump = (value: string) => {
    const ch = chapters.find((c) => c.id === parseInt(value, 10));
    if (ch) goToPage(ch.pages[0]);
    setSurahJumpValue("");
  };

  const handleJuzJump = (value: string) => {
    const page = JUZ_PAGES[parseInt(value, 10)];
    if (page) goToPage(page);
    setJuzJumpValue("");
  };

  // ─── Word interaction ─────────────────────────────────────────────────────

  const handleWordClick = useCallback(
    (lw: LineWord) => {
      if (isReciting) return;
      if (isRecitePickMode) {
        setIsRecitePickMode(false);
        startReciting(lw.verse_key);
        return;
      }
      if (isSelectMode) {
        setSelectedVerseKeys((prev) => {
          const next = new Set(prev);
          if (next.has(lw.verse_key)) next.delete(lw.verse_key);
          else next.add(lw.verse_key);
          return next;
        });
        return;
      }
      if (isBlindMode) {
        setRevealedVerseKeys((prev) => {
          const next = new Set(prev);
          if (next.has(lw.verse_key)) next.delete(lw.verse_key);
          else next.add(lw.verse_key);
          return next;
        });
        return;
      }
      if (lw.char_type_name === "end") {
        const pv = verses.find((v) => v.verse_key === lw.verse_key);
        setSheetAyah({
          verseKey: lw.verse_key,
          surahId: lw.surahId,
          verseNum: lw.verseNum,
          text_uthmani: pv?.text_uthmani ?? "",
        });
        setSheetView({ type: "main" });
      }
      // single tap on a regular word does nothing; long-press opens the sheet
    },
    [isReciting, isRecitePickMode, isSelectMode, isBlindMode, verses, startReciting]
  );

  const isAnyModeActive = isSelectMode || isBlindMode || isReciting || isRecitePickMode;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) < 50) return;
    if (Math.abs(dx) <= Math.abs(dy)) return;
    const page = currentPageRef.current;
    if (dx > 0) {
      if (page < TOTAL_PAGES) goToPageRef.current(page + 1);
    } else {
      if (page > 1) goToPageRef.current(page - 1);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  // Player active for highlight check
  const playerIsPlaying = playerState?.status === "playing";

  return (
    <>
      <style>{TAJWEED_CSS}</style>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 60,
          background: "#e0d5c2",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* ── Collapsible chrome bar ── */}
        <div
          style={{
            height: showChrome ? "56px" : "0px",
            overflow: "hidden",
            transition: "height 0.25s ease",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              height: "56px",
              display: "flex",
              flexDirection: "column",
              background: "#cfc5ae",
              borderBottom: `1px solid ${BAYAAN_PAGE_THEME.chromeBorder}`,
            }}
          >
            {/* Row 1 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 10px 0",
                flex: 1,
              }}
            >
              <button
                onClick={() =>
                  window.history.length > 1
                    ? window.history.back()
                    : setLocation(`/child/${childId}/memorization`)
                }
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "2px",
                  color: BAYAAN_PAGE_THEME.chromeMuted,
                  fontSize: "13px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  flexShrink: 0,
                  padding: "2px 4px",
                }}
              >
                <ChevronLeft size={14} />
                <span>Back</span>
              </button>

              <div style={{ flex: 1, textAlign: "center", minWidth: 0, overflow: "hidden" }}>
                <p style={{ fontSize: "12px", fontWeight: 600, color: BAYAAN_PAGE_THEME.screenText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.3, margin: 0 }}>
                  {currentSurahName || "Full Quran"}
                </p>
                <p style={{ fontSize: "10px", color: BAYAAN_PAGE_THEME.chromeMuted, lineHeight: 1.2, margin: 0 }}>
                  p. {currentPage}
                </p>
              </div>

              <button
                onClick={() => { setIsBlindMode((b) => !b); setRevealedVerseKeys(new Set()); }}
                style={{
                  padding: "4px",
                  borderRadius: "6px",
                  border: `1px solid ${isBlindMode ? "#a855f7" : BAYAAN_PAGE_THEME.chromeBorder}`,
                  background: isBlindMode ? "#f3e8ff" : "transparent",
                  color: isBlindMode ? "#7c3aed" : BAYAAN_PAGE_THEME.chromeMuted,
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                {isBlindMode ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>

              <button
                onClick={() => { setIsSelectMode((s) => !s); setSelectedVerseKeys(new Set()); }}
                style={{
                  padding: "4px",
                  borderRadius: "6px",
                  border: `1px solid ${isSelectMode ? "#16a34a" : BAYAAN_PAGE_THEME.chromeBorder}`,
                  background: isSelectMode ? "#dcfce7" : "transparent",
                  color: isSelectMode ? "#16a34a" : BAYAAN_PAGE_THEME.chromeMuted,
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                {isSelectMode ? <CheckCircle size={14} /> : <Circle size={14} />}
              </button>

              <button
                onClick={() => {
                  if (isReciting) { stopReciting(); }
                  else { setIsRecitePickMode((p) => !p); }
                }}
                style={{
                  padding: "4px",
                  borderRadius: "6px",
                  border: `1px solid ${(isReciting || isRecitePickMode) ? "#e11d48" : BAYAAN_PAGE_THEME.chromeBorder}`,
                  background: (isReciting || isRecitePickMode) ? "#fee2e2" : "transparent",
                  color: (isReciting || isRecitePickMode) ? "#e11d48" : BAYAAN_PAGE_THEME.chromeMuted,
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                {isReciting ? <MicOff size={14} /> : <Mic size={14} />}
              </button>
            </div>

            {/* Row 2: Jump nav (Surah / Juz tabs) + page input */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "0 10px 4px" }}>
              <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "4px" }}>
                {/* S / J tab toggle */}
                <div
                  style={{
                    display: "flex",
                    flexShrink: 0,
                    borderRadius: "4px",
                    overflow: "hidden",
                    border: `1px solid ${BAYAAN_PAGE_THEME.chromeBorder}`,
                  }}
                >
                  {(["surah", "juz"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setJumpTab(tab)}
                      style={{
                        padding: "1px 6px",
                        fontSize: "9px",
                        fontWeight: jumpTab === tab ? 700 : 400,
                        lineHeight: "16px",
                        background: jumpTab === tab ? BAYAAN_PAGE_THEME.screenText : "rgba(255,253,248,0.65)",
                        color: jumpTab === tab ? "white" : BAYAAN_PAGE_THEME.chromeMuted,
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      {tab === "surah" ? "S" : "J"}
                    </button>
                  ))}
                </div>

                {/* Surah Select */}
                {jumpTab === "surah" && chapters.length > 0 && (
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Select value={surahJumpValue} onValueChange={handleSurahJump}>
                      <SelectTrigger
                        className="h-6 text-[11px] min-w-0"
                        style={{
                          border: `1px solid ${BAYAAN_PAGE_THEME.chromeBorder}`,
                          background: "rgba(255,253,248,0.65)",
                          color: BAYAAN_PAGE_THEME.screenText,
                        }}
                      >
                        <SelectValue placeholder="Jump to Surah…" />
                      </SelectTrigger>
                      <SelectContent className="max-h-64">
                        {chapters.map((ch) => {
                          const isActive = ch.pages[0] <= currentPage && ch.pages[1] >= currentPage;
                          return (
                            <SelectItem
                              key={ch.id}
                              value={String(ch.id)}
                              className={cn("text-xs", isActive && "font-semibold")}
                            >
                              {ch.id}. {ch.name_simple}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Juz Select */}
                {jumpTab === "juz" && (
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Select value={juzJumpValue} onValueChange={handleJuzJump}>
                      <SelectTrigger
                        className="h-6 text-[11px] min-w-0"
                        style={{
                          border: `1px solid ${BAYAAN_PAGE_THEME.chromeBorder}`,
                          background: "rgba(255,253,248,0.65)",
                          color: BAYAAN_PAGE_THEME.screenText,
                        }}
                      >
                        <SelectValue placeholder="Jump to Juz…" />
                      </SelectTrigger>
                      <SelectContent className="max-h-64">
                        {Object.entries(JUZ_PAGES).map(([juz]) => {
                          const juzNum = parseInt(juz, 10);
                          const startPage = JUZ_PAGES[juzNum];
                          const endPage = (JUZ_PAGES[juzNum + 1] ?? TOTAL_PAGES + 1) - 1;
                          const isActive = currentPage >= startPage && currentPage <= endPage;
                          return (
                            <SelectItem
                              key={juz}
                              value={juz}
                              className={cn("text-xs", isActive && "font-semibold")}
                            >
                              Juz {juz}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "2px",
                  border: `1px solid ${BAYAAN_PAGE_THEME.chromeBorder}`,
                  borderRadius: "5px",
                  padding: "0 6px",
                  height: "24px",
                  flexShrink: 0,
                  background: "rgba(255,253,248,0.65)",
                }}
              >
                <span style={{ fontSize: "9px", color: BAYAAN_PAGE_THEME.chromeMuted }}>p.</span>
                <input
                  type="number"
                  min={1}
                  max={TOTAL_PAGES}
                  value={jumpInput}
                  onChange={(e) => setJumpInput(e.target.value)}
                  onKeyDown={handlePageInput}
                  placeholder={String(currentPage)}
                  style={{
                    width: "34px",
                    fontSize: "10px",
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: BAYAAN_PAGE_THEME.screenText,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Page area ── */}
        <div
          style={{ flex: 1, minHeight: 0, position: "relative", padding: "4px" }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <BayaanMushafPageCard
            pageNumber={currentPage}
            pageSurahNames={pageSurahNames}
            isSinglePageLayout={true}
            cachedScale={getCachedScale(currentPage)}
            isContentVisible={isMushafContentVisible}
            pageContentRef={pageContentRefCb}
            pageMeasureRef={pageMeasureRefCb}
          >
            {isLoading && (
              <div style={{ padding: "12px 0" }}>
                {Array.from({ length: 15 }, (_, i) => (
                  <div
                    key={i}
                    style={{
                      height: "1.4em",
                      marginBottom: "0.55em",
                      background: BAYAAN_PAGE_THEME.pageBorder,
                      opacity: 0.22,
                      borderRadius: "3px",
                    }}
                  />
                ))}
              </div>
            )}

            {isError && (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px 12px",
                  color: BAYAAN_PAGE_THEME.pageMuted,
                  fontSize: "0.8em",
                  direction: "ltr",
                }}
              >
                Failed to load page. Check your connection.
              </div>
            )}

            {/* ── Line-based rendering ── */}
            {!isLoading && !isError && lineGroups && (() => {
              const nodes: React.ReactNode[] = [];
              const seenSurahIds = new Set<number>();

              for (const { lineNum, words: lws } of lineGroups) {
                const newSurahs: number[] = [];
                for (const lw of lws) {
                  if (!seenSurahIds.has(lw.surahId)) {
                    seenSurahIds.add(lw.surahId);
                    newSurahs.push(lw.surahId);
                  }
                }
                for (const sid of newSurahs) {
                  if (!surahsStartingOnPage.has(sid)) continue;
                  const sc = chapters.find((c) => c.id === sid);
                  nodes.push(
                    <BayaanSurahBanner
                      key={`hdr-${sid}`}
                      surahNumber={sid}
                      surahName={sc?.name_simple ?? `Surah ${sid}`}
                    />
                  );
                }

                nodes.push(
                  <div
                    key={`ln-${lineNum}`}
                    style={{
                      display: "flex",
                      direction: "rtl",
                      justifyContent: "center",
                      alignItems: "center",
                      flexWrap: "nowrap",
                      lineHeight: 2.2,
                      padding: "0 4px",
                      width: "100%",
                      gap: "0.3em",
                    }}
                  >
                    {lws.map((lw) => {
                      const k = `${lw.verse_key}:${lw.position}`;

                      if (lw.char_type_name === "end") {
                        const isSelected = isSelectMode && selectedVerseKeys.has(lw.verse_key);
                        let endOpacity = 1;
                        if (isReciting && reciteStartVerseKey) {
                          if (isBeforeVerseKey(lw.verse_key, reciteStartVerseKey)) endOpacity = 0.3;
                        }
                        const hasAnnotation =
                          bookmarks[lw.verse_key] || highlights[lw.verse_key] || notes[lw.verse_key];
                        const annotationDotColor = highlights[lw.verse_key]
                          ? HIGHLIGHT_COLORS[highlights[lw.verse_key] as HighlightColor]?.dot ?? "#9ca3af"
                          : bookmarks[lw.verse_key]
                          ? "#f59e0b"
                          : "#6b7280";

                        return (
                          <span
                            key={k}
                            onClick={() => handleWordClick(lw)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: "1.9em",
                              height: "1.9em",
                              borderRadius: "50%",
                              border: isSelected
                                ? "1.5px solid #16a34a"
                                : `1.5px solid ${BAYAAN_PAGE_THEME.markerBorder}`,
                              background: isSelected ? "#dcfce7" : BAYAAN_PAGE_THEME.markerSurface,
                              flexShrink: 0,
                              userSelect: "none",
                              direction: "ltr",
                              cursor: "pointer",
                              opacity: endOpacity,
                              position: "relative",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "0.58em",
                                color: isSelected ? "#16a34a" : BAYAAN_PAGE_THEME.markerText,
                                fontFamily: "Georgia, serif",
                                lineHeight: 1,
                              }}
                            >
                              {lw.verseNum}
                            </span>
                            {hasAnnotation && (
                              <span
                                style={{
                                  position: "absolute",
                                  top: "-1px",
                                  right: "-1px",
                                  width: "6px",
                                  height: "6px",
                                  borderRadius: "50%",
                                  background: annotationDotColor,
                                  border: "1px solid #fffdf8",
                                  pointerEvents: "none",
                                }}
                              />
                            )}
                          </span>
                        );
                      }

                      const isSelected = isSelectMode && selectedVerseKeys.has(lw.verse_key);
                      const isBlurred = isBlindMode && !revealedVerseKeys.has(lw.verse_key);
                      let wordFilter = isBlurred ? "blur(6px)" : "none";
                      let wordOpacity = 1;
                      if (isReciting && reciteStartVerseKey) {
                        if (isBeforeVerseKey(lw.verse_key, reciteStartVerseKey)) {
                          wordFilter = "none";
                          wordOpacity = 0.3;
                        } else if (!reciteUnlockedWords.has(k)) {
                          wordFilter = "blur(6px)";
                          wordOpacity = 1;
                        } else {
                          wordFilter = "none";
                          wordOpacity = 1;
                        }
                      }

                      const isPlayingWord =
                        !isAnyModeActive &&
                        playerIsPlaying &&
                        playerState?.surahId === lw.surahId &&
                        playerState?.ayahNum === lw.verseNum;

                      const wordHighlightBg =
                        !isSelected && highlights[lw.verse_key]
                          ? HIGHLIGHT_COLORS[highlights[lw.verse_key] as HighlightColor]?.bg ?? "transparent"
                          : "transparent";

                      return (
                        <span
                          key={k}
                          onPointerDown={(e) => {
                            if (isAnyModeActive) return;
                            longPressStartPosRef.current = { x: e.clientX, y: e.clientY };
                            longPressFiredRef.current = false;
                            longPressTimerRef.current = setTimeout(() => {
                              longPressFiredRef.current = true;
                              longPressTimerRef.current = null;
                              const pv = verses.find((v) => v.verse_key === lw.verse_key);
                              setSheetAyah({
                                verseKey: lw.verse_key,
                                surahId: lw.surahId,
                                verseNum: lw.verseNum,
                                text_uthmani: pv?.text_uthmani ?? "",
                              });
                              setSheetView({ type: "main" });
                            }, 500);
                          }}
                          onPointerMove={(e) => {
                            if (!longPressStartPosRef.current) return;
                            const dx = e.clientX - longPressStartPosRef.current.x;
                            const dy = e.clientY - longPressStartPosRef.current.y;
                            if (Math.sqrt(dx * dx + dy * dy) > 10) {
                              if (longPressTimerRef.current) {
                                clearTimeout(longPressTimerRef.current);
                                longPressTimerRef.current = null;
                              }
                              longPressStartPosRef.current = null;
                            }
                          }}
                          onPointerUp={() => {
                            if (longPressTimerRef.current) {
                              clearTimeout(longPressTimerRef.current);
                              longPressTimerRef.current = null;
                            }
                            longPressStartPosRef.current = null;
                          }}
                          onPointerLeave={() => {
                            if (longPressTimerRef.current) {
                              clearTimeout(longPressTimerRef.current);
                              longPressTimerRef.current = null;
                            }
                            longPressStartPosRef.current = null;
                          }}
                          onClick={() => {
                            if (longPressFiredRef.current) {
                              longPressFiredRef.current = false;
                              return;
                            }
                            handleWordClick(lw);
                          }}
                          className={cn(
                            "inline-block rounded-sm cursor-pointer transition-all duration-150",
                            isSelected && "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300"
                          )}
                          style={{
                            filter: wordFilter,
                            opacity: wordOpacity,
                            userSelect: "none",
                            padding: "0 0.04em",
                            background: wordHighlightBg,
                            borderRadius: "2px",
                            boxShadow: isPlayingWord
                              ? `0 0 0 1px ${BAYAAN_PAGE_THEME.markerBorder}`
                              : "none",
                          }}
                        >
                          {lw.text_uthmani}
                        </span>
                      );
                    })}
                  </div>
                );
              }
              return nodes;
            })()}

            {/* ── Fallback: no word-level data ── */}
            {!isLoading && !isError && !lineGroups && verses.length > 0 && (
              <div style={{ textAlign: "justify", textAlignLast: "right" }}>
                {verses.map((v) => {
                  const parts = v.verse_key.split(":");
                  const sId = parseInt(parts[0], 10);
                  const vNum = parseInt(parts[1], 10);
                  const isBlurred = isBlindMode && !revealedVerseKeys.has(v.verse_key);
                  const isSelected = isSelectMode && selectedVerseKeys.has(v.verse_key);
                  return (
                    <span
                      key={v.verse_key}
                      onClick={() =>
                        handleWordClick({
                          verse_key: v.verse_key,
                          surahId: sId,
                          verseNum: vNum,
                          position: 1,
                          wordIdxInVerse: 0,
                          text_uthmani: v.text_uthmani,
                          char_type_name: "word",
                          line_number: 0,
                        })
                      }
                      className={cn(
                        "inline cursor-pointer rounded transition-all",
                        isSelected && "bg-emerald-100"
                      )}
                      style={{
                        filter: isBlurred ? "blur(6px)" : "none",
                        userSelect: "none",
                        background: highlights[v.verse_key]
                          ? HIGHLIGHT_COLORS[highlights[v.verse_key] as HighlightColor]?.bg ?? "transparent"
                          : "transparent",
                      }}
                    >
                      {v.text_uthmani}{" "}
                    </span>
                  );
                })}
              </div>
            )}
          </BayaanMushafPageCard>

          {/* Center tap — toggle chrome bar */}
          {!isAnyModeActive && (
            <div
              onClick={() => setShowChrome((v) => !v)}
              style={{
                position: "absolute",
                left: "22%", right: "22%",
                top: 0, bottom: 0,
                zIndex: 9,
              }}
            />
          )}
        </div>

        {/* ── Mark as memorized floating button ── */}
        {isSelectMode && selectedVerseKeys.size > 0 && (
          <div
            style={{
              position: "fixed",
              bottom: "16px", left: 0, right: 0,
              display: "flex",
              justifyContent: "center",
              zIndex: 65,
              padding: "0 16px",
              pointerEvents: "none",
            }}
          >
            <button
              onClick={() => markMutation.mutate()}
              disabled={markMutation.isPending || !memData}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "#16a34a",
                color: "white",
                fontSize: "14px",
                fontWeight: 600,
                padding: "12px 24px",
                borderRadius: "9999px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
                pointerEvents: "auto",
                border: "none",
                cursor: "pointer",
                opacity: (markMutation.isPending || !memData) ? 0.7 : 1,
              }}
            >
              <Check size={15} />
              {markMutation.isPending
                ? "Saving…"
                : `Mark ${selectedVerseKeys.size} ayah${selectedVerseKeys.size > 1 ? "s" : ""} as memorized`}
            </button>
          </div>
        )}

        {/* ── Recite pick mode banner ── */}
        {isRecitePickMode && !isReciting && (
          <div
            style={{
              position: "fixed",
              bottom: "16px", left: 0, right: 0,
              zIndex: 65,
              display: "flex",
              justifyContent: "center",
              padding: "0 16px",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                background: "white",
                borderRadius: "12px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                border: "1px solid #fecaca",
                padding: "12px 20px",
                pointerEvents: "auto",
                display: "flex",
                alignItems: "center",
                gap: "16px",
              }}
            >
              <p style={{ fontSize: "14px", fontWeight: 500, color: "#111827", margin: 0 }}>
                Tap an ayah to start reciting from there
              </p>
              <button
                onClick={() => setIsRecitePickMode(false)}
                style={{ fontSize: "14px", color: "#e11d48", fontWeight: 600, background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── Stop reciting button ── */}
        {isReciting && (
          <div
            style={{
              position: "fixed",
              bottom: "16px", left: 0, right: 0,
              zIndex: 65,
              display: "flex",
              justifyContent: "center",
              padding: "0 16px",
              pointerEvents: "none",
            }}
          >
            <button
              onClick={stopReciting}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "#dc2626",
                color: "white",
                fontSize: "14px",
                fontWeight: 600,
                padding: "12px 24px",
                borderRadius: "9999px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
                pointerEvents: "auto",
                border: "none",
                cursor: "pointer",
              }}
            >
              <MicOff size={15} /> Stop Reciting
            </button>
          </div>
        )}

        {/* ── BayaanAyahSheet ── */}
        {sheetAyah && sheetView && (
          <BayaanAyahSheet
            ayah={sheetAyah}
            sheetView={sheetView}
            onChangeView={setSheetView}
            onClose={() => { setSheetView(null); setSheetAyah(null); }}
            onNavigate={(newAyah) => setSheetAyah(newAyah)}
            onPlayFromHere={playFromAyah}
            onPlayRepeat={(ayah, repeat) => playFromAyah(ayah, { repeat })}
            verses={verses}
            childId={childId}
            chapters={chapters}
            bookmarks={bookmarks}
            highlights={highlights}
            notes={notes}
            onToggleBookmark={handleToggleBookmark}
            onSetHighlight={handleSetHighlight}
            onSaveNote={handleSaveNote}
          />
        )}

        {/* ── FloatingPlayerBar ── */}
        {playerState && (
          <FloatingPlayerBar
            playerState={playerState}
            onToggle={playerToggle}
            onStop={playerStop}
            onPrev={playerPrev}
            onNext={playerNext}
            onSettings={() => setShowSettingsSheet(true)}
          />
        )}

        {/* ── PlaybackSettingsSheet ── */}
        {showSettingsSheet && (
          <PlaybackSettingsSheet
            verses={verses}
            playerSettings={playerSettings}
            playerState={playerState}
            onPlay={(startVK, endVK, settings) => {
              const [startSurah, startVerse] = startVK.split(":").map(Number);
              const endAyahNum = endVK
                ? (() => {
                    const [endSurah, endVerse] = endVK.split(":").map(Number);
                    return endSurah === startSurah ? endVerse : null;
                  })()
                : null;
              const pv = verses.find((v) => v.verse_key === startVK);
              playFromAyah(
                { verseKey: startVK, surahId: startSurah, verseNum: startVerse, text_uthmani: pv?.text_uthmani ?? "" },
                { repeat: settings.repeat, rangeEnd: endAyahNum, reciterFolder: settings.reciterFolder, rate: settings.rate, rangeRepeat: settings.rangeRepeat }
              );
              setShowSettingsSheet(false);
            }}
            onClose={() => setShowSettingsSheet(false)}
          />
        )}
      </div>
    </>
  );
}
