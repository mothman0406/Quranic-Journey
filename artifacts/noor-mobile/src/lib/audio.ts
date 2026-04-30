import type { Reciter } from "@/src/lib/reciters";

function pad(n: number, len: number): string {
  return String(n).padStart(len, "0");
}

export function ayahAudioUrl(reciter: Reciter, surahNumber: number, ayahNumber: number): string {
  return `https://everyayah.com/data/${reciter.folder}/${pad(surahNumber, 3)}${pad(ayahNumber, 3)}.mp3`;
}

export function wbwAudioUrl(surahNumber: number, ayahNumber: number, wordPosition: number): string {
  return `https://audio.qurancdn.com/wbw/${pad(surahNumber, 3)}_${pad(ayahNumber, 3)}_${pad(wordPosition, 3)}.mp3`;
}
