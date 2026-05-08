export type Reciter = {
  id: string;
  fullName: string;
  style: string;
  audioSource: "everyayah" | "chapter";
  folder?: string;       // everyayah.com data folder
  server?: string;       // chapter-level mp3 server used by Bayaan/MP3Quran
  quranComId: number | null; // Quran.com /api/v4 recitation ID for per-ayah word timing
  qdcId: number | null;      // qurancdn.com /api/qdc reciter ID for chapter-level word timing
  mp3QuranReadId?: number | null; // MP3Quran ayah-timing read ID
};

export const RECITERS: Reciter[] = [
  { id: "husary",    fullName: "Mahmoud Khalil Al-Husary",       style: "Murattal",  audioSource: "everyayah", folder: "Husary_128kbps",                               quranComId: null, qdcId: 6  },
  { id: "afasy",     fullName: "Mishary Rashid Al-Afasy",         style: "Murattal",  audioSource: "everyayah", folder: "Alafasy_128kbps",                              quranComId: null, qdcId: 7  },
  { id: "sudais",    fullName: "Abdul Rahman Al-Sudais",          style: "Murattal",  audioSource: "everyayah", folder: "Abdurrahmaan_As-Sudais_192kbps",                quranComId: null, qdcId: 3  },
  { id: "basit",     fullName: "Abdul Basit Abdul Samad",         style: "Murattal",  audioSource: "everyayah", folder: "Abdul_Basit_Murattal_192kbps",                  quranComId: null, qdcId: 2  },
  { id: "minshawi",  fullName: "Muhammad Siddiq Al-Minshawi",     style: "Murattal",  audioSource: "everyayah", folder: "Minshawy_Murattal_128kbps",                     quranComId: null, qdcId: 9  },
  { id: "ghamdi",    fullName: "Sa'd Al-Ghamdi",                  style: "Murattal",  audioSource: "everyayah", folder: "Ghamadi_40kbps",                                quranComId: null, qdcId: null },
  { id: "ajmi",      fullName: "Ahmad Al-Ajmi",                   style: "Murattal",  audioSource: "everyayah", folder: "Ahmed_ibn_Ali_al-Ajamy_128kbps_ketaballah.net", quranComId: null, qdcId: null },
  { id: "shatri",    fullName: "Abu Bakr Al-Shatri",              style: "Murattal",  audioSource: "chapter", server: "https://server11.mp3quran.net/shatri/",                     quranComId: null, qdcId: 4,  mp3QuranReadId: 4   },
  { id: "hani",      fullName: "Hani Ar-Rifai",                   style: "Murattal",  audioSource: "chapter", server: "https://server8.mp3quran.net/hani/",                        quranComId: null, qdcId: 5,  mp3QuranReadId: 89  },
  { id: "shuraym",   fullName: "Saud Al-Shuraim",                 style: "Murattal",  audioSource: "chapter", server: "https://server7.mp3quran.net/shur/",                        quranComId: null, qdcId: 10, mp3QuranReadId: 31  },
  { id: "basit-mujawwad", fullName: "Abdul Basit Abdul Samad",    style: "Mujawwad",  audioSource: "chapter", server: "https://server7.mp3quran.net/basit/Almusshaf-Al-Mojawwad/",   quranComId: null, qdcId: 1,  mp3QuranReadId: 51  },
  { id: "minshawi-mujawwad", fullName: "Muhammad Siddiq Al-Minshawi", style: "Mujawwad", audioSource: "chapter", server: "https://server10.mp3quran.net/minsh/Almusshaf-Al-Mojawwad", quranComId: null, qdcId: 8 },
  { id: "bandar",    fullName: "Bandar Balilah",                  style: "Murattal",  audioSource: "chapter", server: "https://download.quranicaudio.com/quran/bandar_baleela/complete", quranComId: null, qdcId: null, mp3QuranReadId: 217 },
  { id: "yasser",    fullName: "Yasser Al-Dosari",                style: "Murattal",  audioSource: "chapter", server: "https://server11.mp3quran.net/yasser/",                      quranComId: null, qdcId: null, mp3QuranReadId: 92  },
  { id: "johany",    fullName: "Abdullah Al-Johany",              style: "Murattal",  audioSource: "chapter", server: "https://server13.mp3quran.net/jhn/",                         quranComId: null, qdcId: null, mp3QuranReadId: 62  },
  { id: "qatami",    fullName: "Nasser Al-Qatami",                style: "Murattal",  audioSource: "chapter", server: "https://server6.mp3quran.net/qtm/",                          quranComId: null, qdcId: null, mp3QuranReadId: 86  },
  { id: "tunaiji",   fullName: "Khalifa Al-Tunaiji",              style: "Murattal",  audioSource: "chapter", server: "https://server12.mp3quran.net/tnjy/",                         quranComId: null, qdcId: null, mp3QuranReadId: 24  },
  { id: "budair",    fullName: "Salah Al-Budair",                 style: "Murattal",  audioSource: "chapter", server: "https://server6.mp3quran.net/s_bud/",                         quranComId: null, qdcId: null, mp3QuranReadId: 43  },
  { id: "idrees",    fullName: "Idrees Abkr",                     style: "Murattal",  audioSource: "chapter", server: "https://server6.mp3quran.net/abkr/",                          quranComId: null, qdcId: null, mp3QuranReadId: 12  },
  { id: "nufais",    fullName: "Ahmad Al Nufais",                 style: "Murattal",  audioSource: "chapter", server: "https://server16.mp3quran.net/nufais/Rewayat-Hafs-A-n-Assem/",   quranComId: null, qdcId: null, mp3QuranReadId: 259 },
  { id: "huthaifi",  fullName: "Ali Al-Huthaifi",                 style: "Murattal",  audioSource: "chapter", server: "https://server9.mp3quran.net/hthfi/",                         quranComId: null, qdcId: null, mp3QuranReadId: 74  },
  { id: "mattrod",   fullName: "Abdullah Al-Mattrod",             style: "Murattal",  audioSource: "chapter", server: "https://server8.mp3quran.net/mtrod/",                         quranComId: null, qdcId: null, mp3QuranReadId: 59  },
  { id: "basfar",    fullName: "Abdullah Basfar",                 style: "Murattal",  audioSource: "chapter", server: "https://server6.mp3quran.net/bsfr/",                          quranComId: null, qdcId: null, mp3QuranReadId: 60  },
  { id: "dukhain",   fullName: "Haitham Aldukhain",               style: "Murattal",  audioSource: "chapter", server: "https://server16.mp3quran.net/h_dukhain/Rewayat-Hafs-A-n-Assem/", quranComId: null, qdcId: null, mp3QuranReadId: 273 },
  { id: "hasan-saleh", fullName: "Hasan Saleh",                   style: "Murattal",  audioSource: "chapter", server: "https://server16.mp3quran.net/h_saleh/Rewayat-Hafs-A-n-Assem/",   quranComId: null, qdcId: null, mp3QuranReadId: 299 },
  { id: "tablawi",   fullName: "Muhammad Al-Tablawi",             style: "Murattal",  audioSource: "chapter", server: "https://server12.mp3quran.net/tblawi/",                       quranComId: null, qdcId: null, mp3QuranReadId: 106 },
];

export const DEFAULT_RECITER_ID = "husary";

export function reciterSupportsWordTiming(reciter: Reciter): boolean {
  return reciter.qdcId !== null;
}

export function reciterUsesChapterAudio(reciter: Reciter): boolean {
  return reciter.audioSource === "chapter";
}

export const MEMORIZATION_RECITERS = RECITERS.filter(reciterSupportsWordTiming);

export function findReciter(id: string): Reciter {
  return RECITERS.find((r) => r.id === id) ?? RECITERS[0]!;
}

export function findMemorizationReciter(id: string): Reciter {
  return MEMORIZATION_RECITERS.find((r) => r.id === id) ?? MEMORIZATION_RECITERS[0]!;
}
