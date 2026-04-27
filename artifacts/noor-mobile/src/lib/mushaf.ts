export const TOTAL_MUSHAF_PAGES = 604;

export function mushafPageUrl(page: number): string {
  const padded = String(page).padStart(3, "0");
  return `https://raw.githubusercontent.com/GovarJabbar/Quran-PNG/master/${padded}.png`;
}
