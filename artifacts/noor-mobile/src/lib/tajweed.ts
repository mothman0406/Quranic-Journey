// Tajweed CSS class → hex color map ported from
// noor-path/src/components/mushaf/bayaan/bayaan-constants.ts (TAJWEED_CSS).
// Class names match what Quran.com v4 returns in text_uthmani_tajweed.

export const TAJWEED_COLORS: Record<string, string> = {
  ham_wasl: "#8f7d56",
  slnt: "#8f7d56",
  lam_shamsiyya: "#8f7d56",
  lam_shamsiyyah: "#8f7d56",
  madda_normal: "#c2410c",
  madda_permissible: "#ea580c",
  madda_necessary: "#dc2626",
  madda_obligatory: "#dc2626",
  qalaqah: "#16a34a",
  ikhafa_shafawi: "#2563eb",
  ikhafa: "#2563eb",
  iqlab: "#2563eb",
  idgham_ghunna: "#7c3aed",
  idgham_ghunnah: "#7c3aed",
  ghunna: "#7c3aed",
  ghunnah: "#7c3aed",
  idgham_wo_ghunna: "#0f766e",
  idgham_wo_ghunnah: "#0f766e",
  idgham_mutajanisayn: "#0f766e",
  idgham_mutaqaribain: "#0f766e",
  idgham_shafawi: "#0f766e",
};

/**
 * Extract the first tajweed class from an HTML-ish string like:
 *   `<tajweed class="madda_normal">...</tajweed>`
 * or
 *   `<span class="ham_wasl">...</span>`
 *
 * Returns the matching hex color from TAJWEED_COLORS, or null if no class
 * is present or the class isn't recognized.
 *
 * Quran.com v4 returns text_uthmani_tajweed with one class wrapping the
 * affected substring of a word. Words may have nested or sequential rules,
 * but for visual coloring of a whole word, taking the first class is a
 * reasonable approximation that matches how the web renders it.
 */
export function extractTajweedColor(html: string | undefined): string | null {
  if (!html) return null;
  const match = html.match(/class\s*=\s*["']([a-zA-Z_]+)["']/);
  if (!match) return null;
  const className = match[1];
  return TAJWEED_COLORS[className] ?? null;
}

/**
 * Strip all HTML tags from a tajweed-marked-up string to get plain text.
 * Used as a fallback when we just want to render the word without coloring
 * (tajweed disabled, or extractTajweedColor returned null).
 */
export function stripTajweedTags(html: string | undefined): string {
  if (!html) return "";
  return html.replace(/<[^>]+>/g, "");
}
