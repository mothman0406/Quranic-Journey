import type { Reciter } from "@/src/lib/reciters";

function pad(n: number, len: number): string {
  return String(n).padStart(len, "0");
}

export function ayahAudioUrl(reciter: Reciter, surahNumber: number, ayahNumber: number): string {
  return `https://everyayah.com/data/${reciter.folder}/${pad(surahNumber, 3)}${pad(ayahNumber, 3)}.mp3`;
}
