export function ayahAudioUrl(surahNumber: number, ayahNumber: number): string {
  const s = String(surahNumber).padStart(3, "0");
  const a = String(ayahNumber).padStart(3, "0");
  return `https://everyayah.com/data/Husary_128kbps/${s}${a}.mp3`;
}
