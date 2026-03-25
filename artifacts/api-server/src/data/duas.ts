export interface DuaData {
  id: number;
  arabic: string;
  transliteration: string;
  translation: string;
  occasion: string;
  category: "morning" | "evening" | "eating" | "sleeping" | "travel" | "general" | "prayer";
  ageGroup: "toddler" | "child" | "preteen" | "teen" | "all";
  source: string;
  importance: "essential" | "important" | "recommended";
  memorizationOrder: number;
}

export const DUAS: DuaData[] = [
  {
    id: 1,
    arabic: "بِسْمِ اللَّهِ",
    transliteration: "Bismillah",
    translation: "In the name of Allah",
    occasion: "Before eating or drinking",
    category: "eating",
    ageGroup: "toddler",
    source: "Hadith - Sahih Muslim",
    importance: "essential",
    memorizationOrder: 1
  },
  {
    id: 2,
    arabic: "الْحَمْدُ لِلَّهِ",
    transliteration: "Alhamdulillah",
    translation: "All praise is for Allah",
    occasion: "After eating, or expressing gratitude",
    category: "eating",
    ageGroup: "toddler",
    source: "Hadith - Various",
    importance: "essential",
    memorizationOrder: 2
  },
  {
    id: 3,
    arabic: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
    transliteration: "Bismillahi r-rahmani r-rahim",
    translation: "In the name of Allah, the Most Gracious, the Most Merciful",
    occasion: "Before starting any important task",
    category: "general",
    ageGroup: "toddler",
    source: "Quran 1:1",
    importance: "essential",
    memorizationOrder: 3
  },
  {
    id: 4,
    arabic: "اللَّهُمَّ بِاسْمِكَ أَمُوتُ وَأَحْيَا",
    transliteration: "Allahumma bismika amutu wa ahya",
    translation: "O Allah, in Your name I die and I live",
    occasion: "Before going to sleep",
    category: "sleeping",
    ageGroup: "child",
    source: "Hadith - Sahih Bukhari",
    importance: "essential",
    memorizationOrder: 4
  },
  {
    id: 5,
    arabic: "الْحَمْدُ لِلَّهِ الَّذِي أَحْيَانَا بَعْدَ مَا أَمَاتَنَا وَإِلَيْهِ النُّشُورُ",
    transliteration: "Alhamdu lillahil-ladhi ahyana ba'da ma amatana wa ilayhin-nushur",
    translation: "All praise is for Allah who gave us life after causing us to die, and to Him is the resurrection",
    occasion: "Upon waking up",
    category: "morning",
    ageGroup: "child",
    source: "Hadith - Sahih Bukhari",
    importance: "essential",
    memorizationOrder: 5
  },
  {
    id: 6,
    arabic: "أَعُوذُ بِاللَّهِ مِنَ الشَّيْطَانِ الرَّجِيمِ",
    transliteration: "A'udhu billahi minash-shaytanir-rajim",
    translation: "I seek refuge in Allah from Shaytan, the accursed",
    occasion: "Before reciting Quran or when feeling Shaytan's temptation",
    category: "general",
    ageGroup: "toddler",
    source: "Quran 16:98",
    importance: "essential",
    memorizationOrder: 6
  },
  {
    id: 7,
    arabic: "رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ",
    transliteration: "Rabbana atina fid-dunya hasanatan wa fil-akhirati hasanatan waqina 'adhaban-nar",
    translation: "Our Lord! Grant us good in this world and good in the Hereafter, and save us from the punishment of the Fire",
    occasion: "General supplication, often said in prayer",
    category: "prayer",
    ageGroup: "child",
    source: "Quran 2:201",
    importance: "essential",
    memorizationOrder: 7
  },
  {
    id: 8,
    arabic: "اللَّهُمَّ اغْفِرْ لِي",
    transliteration: "Allahummaghfir li",
    translation: "O Allah, forgive me",
    occasion: "Seeking forgiveness from Allah",
    category: "general",
    ageGroup: "toddler",
    source: "Hadith - Various",
    importance: "essential",
    memorizationOrder: 8
  },
  {
    id: 9,
    arabic: "اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَافِيَةَ",
    transliteration: "Allahumma inni as-alukal-'afiyah",
    translation: "O Allah, I ask You for good health and wellbeing",
    occasion: "Asking for health and safety",
    category: "general",
    ageGroup: "child",
    source: "Hadith - Tirmidhi",
    importance: "important",
    memorizationOrder: 9
  },
  {
    id: 10,
    arabic: "بِسْمِ اللَّهِ تَوَكَّلْتُ عَلَى اللَّهِ وَلَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ",
    transliteration: "Bismillahi tawakkaltu 'alallahi, wa la hawla wa la quwwata illa billah",
    translation: "In the name of Allah, I put my trust in Allah. There is no power and no strength except with Allah",
    occasion: "When leaving the house",
    category: "travel",
    ageGroup: "child",
    source: "Hadith - Abu Dawud, Tirmidhi",
    importance: "essential",
    memorizationOrder: 10
  },
  {
    id: 11,
    arabic: "اللَّهُمَّ بِكَ أَصْبَحْنَا وَبِكَ أَمْسَيْنَا وَبِكَ نَحْيَا وَبِكَ نَمُوتُ وَإِلَيْكَ النُّشُورُ",
    transliteration: "Allahumma bika asbahna wa bika amsayna, wa bika nahya wa bika namutu wa ilaikan-nushur",
    translation: "O Allah, by You we enter the morning and by You we enter the evening, by You we live and by You we die, and to You is the resurrection",
    occasion: "Morning remembrance",
    category: "morning",
    ageGroup: "preteen",
    source: "Hadith - Tirmidhi",
    importance: "essential",
    memorizationOrder: 11
  },
  {
    id: 12,
    arabic: "اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْهَمِّ وَالْحَزَنِ",
    transliteration: "Allahumma inni a'udhu bika minal-hammi wal-hazan",
    translation: "O Allah, I seek refuge in You from anxiety and sorrow",
    occasion: "When feeling sad or worried",
    category: "general",
    ageGroup: "child",
    source: "Hadith - Sahih Bukhari",
    importance: "important",
    memorizationOrder: 12
  },
  {
    id: 13,
    arabic: "رَبِّ زِدْنِي عِلْمًا",
    transliteration: "Rabbi zidni 'ilma",
    translation: "My Lord, increase me in knowledge",
    occasion: "Before studying or learning",
    category: "general",
    ageGroup: "child",
    source: "Quran 20:114",
    importance: "essential",
    memorizationOrder: 13
  },
  {
    id: 14,
    arabic: "رَبِّ اغْفِرْ لِي وَلِوَالِدَيَّ",
    transliteration: "Rabbighfir li wa li-walidayya",
    translation: "My Lord, forgive me and my parents",
    occasion: "Making dua for your parents",
    category: "general",
    ageGroup: "child",
    source: "Quran 71:28",
    importance: "essential",
    memorizationOrder: 14
  },
  {
    id: 15,
    arabic: "اللَّهُمَّ أَعِنِّي عَلَى ذِكْرِكَ وَشُكْرِكَ وَحُسْنِ عِبَادَتِكَ",
    transliteration: "Allahumma a'inni 'ala dhikrika wa shukrika wa husni 'ibadatik",
    translation: "O Allah, help me to remember You, to be grateful to You, and to worship You in the best way",
    occasion: "After each prayer",
    category: "prayer",
    ageGroup: "child",
    source: "Hadith - Abu Dawud",
    importance: "important",
    memorizationOrder: 15
  },
  {
    id: 16,
    arabic: "اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ",
    transliteration: "Allahumma salli 'ala Muhammadin wa 'ala ali Muhammad",
    translation: "O Allah, send blessings upon Muhammad and the family of Muhammad",
    occasion: "Sending salutations upon the Prophet ﷺ",
    category: "general",
    ageGroup: "toddler",
    source: "Hadith - Sahih Bukhari",
    importance: "essential",
    memorizationOrder: 16
  },
  {
    id: 17,
    arabic: "اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَهَ إِلَّا أَنْتَ خَلَقْتَنِي وَأَنَا عَبْدُكَ",
    transliteration: "Allahumma anta rabbi la ilaha illa ant, khalaqtani wa ana 'abduk",
    translation: "O Allah, You are my Lord. There is no god but You. You created me and I am Your servant",
    occasion: "Sayyid al-Istighfar — Master supplication for forgiveness",
    category: "morning",
    ageGroup: "preteen",
    source: "Hadith - Sahih Bukhari",
    importance: "essential",
    memorizationOrder: 17
  },
  {
    id: 18,
    arabic: "يَا حَيُّ يَا قَيُّومُ بِرَحْمَتِكَ أَسْتَغِيثُ",
    transliteration: "Ya Hayyu ya Qayyumu bi-rahmatika astaghith",
    translation: "O Ever-Living, O Sustainer! In Your mercy I seek relief",
    occasion: "When in difficulty or distress",
    category: "general",
    ageGroup: "preteen",
    source: "Hadith - Tirmidhi",
    importance: "important",
    memorizationOrder: 18
  }
];

export function getDuaById(id: number): DuaData | undefined {
  return DUAS.find(d => d.id === id);
}
