export interface SurahData {
  id: number;
  number: number;
  nameArabic: string;
  nameTransliteration: string;
  nameTranslation: string;
  verseCount: number;
  juzStart: number;
  revelationType: "meccan" | "medinan";
  difficulty: "beginner" | "intermediate" | "advanced";
  ageGroup: "toddler" | "child" | "preteen" | "teen" | "all";
  recommendedOrder: number;
  tafsirBrief: string;
  tajweedNotes: string[];
  verses: {
    number: number;
    arabic: string;
    transliteration: string;
    translation: string;
  }[];
}

export const SURAHS: SurahData[] = [
  {
    id: 1,
    number: 114,
    nameArabic: "النَّاس",
    nameTransliteration: "An-Nas",
    nameTranslation: "Mankind",
    verseCount: 6,
    juzStart: 30,
    revelationType: "meccan",
    difficulty: "beginner",
    ageGroup: "toddler",
    recommendedOrder: 1,
    tafsirBrief: "This surah teaches us to seek Allah's protection from all evil, especially the whispers of Shaytan who tries to put bad thoughts in our hearts.",
    tajweedNotes: ["Practice idghaam on 'min sharril'", "Note the qalqalah on 'dal' in al-was-wasil"],
    verses: [
      { number: 1, arabic: "قُلْ أَعُوذُ بِرَبِّ النَّاسِ", transliteration: "Qul a'udhu bi-rabbi n-nas", translation: "Say: I seek refuge in the Lord of mankind" },
      { number: 2, arabic: "مَلِكِ النَّاسِ", transliteration: "Maliki n-nas", translation: "The King of mankind" },
      { number: 3, arabic: "إِلَٰهِ النَّاسِ", transliteration: "Ilahi n-nas", translation: "The God of mankind" },
      { number: 4, arabic: "مِن شَرِّ الْوَسْوَاسِ الْخَنَّاسِ", transliteration: "Min sharril waswasil-khannas", translation: "From the evil of the retreating whisperer" },
      { number: 5, arabic: "الَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ", transliteration: "Alladhi yuwaswisu fi suduri n-nas", translation: "Who whispers in the breasts of mankind" },
      { number: 6, arabic: "مِنَ الْجِنَّةِ وَالنَّاسِ", transliteration: "Minal-jinnati wan-nas", translation: "From among the jinn and mankind" }
    ]
  },
  {
    id: 2,
    number: 113,
    nameArabic: "الْفَلَق",
    nameTransliteration: "Al-Falaq",
    nameTranslation: "The Daybreak",
    verseCount: 5,
    juzStart: 30,
    revelationType: "meccan",
    difficulty: "beginner",
    ageGroup: "toddler",
    recommendedOrder: 2,
    tafsirBrief: "We ask Allah to protect us from the darkness of night, from magic, and from those who are jealous of us. Allah is our protector!",
    tajweedNotes: ["Practice the heavy 'qaf' in 'Qul'", "Note ikhfa' in 'min sharri'"],
    verses: [
      { number: 1, arabic: "قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ", transliteration: "Qul a'udhu bi-rabbil-falaq", translation: "Say: I seek refuge in the Lord of the daybreak" },
      { number: 2, arabic: "مِن شَرِّ مَا خَلَقَ", transliteration: "Min sharri ma khalaq", translation: "From the evil of what He has created" },
      { number: 3, arabic: "وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ", transliteration: "Wa min sharri ghasiqin idha waqab", translation: "And from the evil of darkness when it settles" },
      { number: 4, arabic: "وَمِن شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ", transliteration: "Wa min sharrin-naffathati fil-'uqad", translation: "And from the evil of the blowers in knots" },
      { number: 5, arabic: "وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ", transliteration: "Wa min sharri hasidin idha hasad", translation: "And from the evil of an envier when he envies" }
    ]
  },
  {
    id: 3,
    number: 112,
    nameArabic: "الْإِخْلَاص",
    nameTransliteration: "Al-Ikhlas",
    nameTranslation: "Sincerity",
    verseCount: 4,
    juzStart: 30,
    revelationType: "meccan",
    difficulty: "beginner",
    ageGroup: "toddler",
    recommendedOrder: 3,
    tafsirBrief: "This surah is equal to one-third of the Quran! It teaches us that Allah is One, He needs no one, and no one is like Him. He has no parents and no children.",
    tajweedNotes: ["Practice the heavy 'Llah' (laam mufakhkhama)", "Note the madd in 'Ahad'"],
    verses: [
      { number: 1, arabic: "قُلْ هُوَ اللَّهُ أَحَدٌ", transliteration: "Qul Huwallahu Ahad", translation: "Say: He is Allah, the One" },
      { number: 2, arabic: "اللَّهُ الصَّمَدُ", transliteration: "Allahus-Samad", translation: "Allah, the Eternal Refuge" },
      { number: 3, arabic: "لَمْ يَلِدْ وَلَمْ يُولَدْ", transliteration: "Lam yalid wa lam yulad", translation: "He neither begets nor is born" },
      { number: 4, arabic: "وَلَمْ يَكُن لَّهُ كُفُوًا أَحَدٌ", transliteration: "Wa lam yakul-lahu kufuwan ahad", translation: "Nor is there to Him any equivalent" }
    ]
  },
  {
    id: 4,
    number: 111,
    nameArabic: "الْمَسَد",
    nameTransliteration: "Al-Masad",
    nameTranslation: "The Palm Fiber",
    verseCount: 5,
    juzStart: 30,
    revelationType: "meccan",
    difficulty: "beginner",
    ageGroup: "child",
    recommendedOrder: 4,
    tafsirBrief: "This surah tells us about Abu Lahab, the uncle of the Prophet ﷺ, who was very mean to him. It teaches us that those who hurt good people will face consequences.",
    tajweedNotes: ["Practice qalqalah on 'ba' in 'Abi'", "Note the hamzah in 'lahab'"],
    verses: [
      { number: 1, arabic: "تَبَّتْ يَدَا أَبِي لَهَبٍ وَتَبَّ", transliteration: "Tabbat yada Abi Lahabiw wa tabb", translation: "May the hands of Abu Lahab be ruined, and ruined is he" },
      { number: 2, arabic: "مَا أَغْنَىٰ عَنْهُ مَالُهُ وَمَا كَسَبَ", transliteration: "Ma aghna 'anhu maluhu wa ma kasab", translation: "His wealth will not avail him or that which he gained" },
      { number: 3, arabic: "سَيَصْلَىٰ نَارًا ذَاتَ لَهَبٍ", transliteration: "Sayasla naran dhata lahab", translation: "He will enter to burn in a Fire of blazing flame" },
      { number: 4, arabic: "وَامْرَأَتُهُ حَمَّالَةَ الْحَطَبِ", transliteration: "Wamra-atuhu hammalatal-hatab", translation: "And his wife, the carrier of firewood" },
      { number: 5, arabic: "فِي جِيدِهَا حَبْلٌ مِّن مَّسَدٍ", transliteration: "Fi jidiha hablum mim masad", translation: "Around her neck is a rope of palm fiber" }
    ]
  },
  {
    id: 5,
    number: 110,
    nameArabic: "النَّصْر",
    nameTransliteration: "An-Nasr",
    nameTranslation: "The Divine Support",
    verseCount: 3,
    juzStart: 30,
    revelationType: "medinan",
    difficulty: "beginner",
    ageGroup: "child",
    recommendedOrder: 5,
    tafsirBrief: "When Allah's help comes and you see people entering Islam in large numbers, praise Allah and ask His forgiveness. This surah was revealed near the end of the Prophet's ﷺ life.",
    tajweedNotes: ["Practice ghunna on 'nun' and 'meem'", "Note idghaam in 'ra-aytan nasa'"],
    verses: [
      { number: 1, arabic: "إِذَا جَاءَ نَصْرُ اللَّهِ وَالْفَتْحُ", transliteration: "Idha ja-a nasrullahi wal-fath", translation: "When the victory of Allah has come and the conquest" },
      { number: 2, arabic: "وَرَأَيْتَ النَّاسَ يَدْخُلُونَ فِي دِينِ اللَّهِ أَفْوَاجًا", transliteration: "Wa ra-aytan nasa yadkhuluna fi dinil-lahi afwaja", translation: "And you see the people entering into the religion of Allah in multitudes" },
      { number: 3, arabic: "فَسَبِّحْ بِحَمْدِ رَبِّكَ وَاسْتَغْفِرْهُ ۚ إِنَّهُ كَانَ تَوَّابًا", transliteration: "Fasabbih bihamdi rabbika wastaghfirh, innahu kana tawwaba", translation: "Then exalt with praise of your Lord and ask forgiveness of Him. Indeed, He is ever Accepting of repentance" }
    ]
  },
  {
    id: 6,
    number: 109,
    nameArabic: "الْكَافِرُون",
    nameTransliteration: "Al-Kafirun",
    nameTranslation: "The Disbelievers",
    verseCount: 6,
    juzStart: 30,
    revelationType: "meccan",
    difficulty: "beginner",
    ageGroup: "child",
    recommendedOrder: 6,
    tafsirBrief: "This surah clearly shows that Muslims worship only Allah. We respect others but we will never worship what they worship. 'For you is your religion, and for me is my religion.'",
    tajweedNotes: ["Practice the light 'lam' in 'la a'budu'", "Note the waqf marks"],
    verses: [
      { number: 1, arabic: "قُلْ يَا أَيُّهَا الْكَافِرُونَ", transliteration: "Qul ya ayyuhal-kafirun", translation: "Say: O disbelievers" },
      { number: 2, arabic: "لَا أَعْبُدُ مَا تَعْبُدُونَ", transliteration: "La a'budu ma ta'budun", translation: "I do not worship what you worship" },
      { number: 3, arabic: "وَلَا أَنتُمْ عَابِدُونَ مَا أَعْبُدُ", transliteration: "Wa la antum 'abiduna ma a'bud", translation: "Nor are you worshippers of what I worship" },
      { number: 4, arabic: "وَلَا أَنَا عَابِدٌ مَّا عَبَدتُّمْ", transliteration: "Wa la ana 'abidum ma 'abattum", translation: "Nor will I be a worshipper of what you worship" },
      { number: 5, arabic: "وَلَا أَنتُمْ عَابِدُونَ مَا أَعْبُدُ", transliteration: "Wa la antum 'abiduna ma a'bud", translation: "Nor will you be worshippers of what I worship" },
      { number: 6, arabic: "لَكُمْ دِينُكُمْ وَلِيَ دِينِ", transliteration: "Lakum dinukum waliya din", translation: "For you is your religion, and for me is my religion" }
    ]
  },
  {
    id: 7,
    number: 108,
    nameArabic: "الْكَوْثَر",
    nameTransliteration: "Al-Kawthar",
    nameTranslation: "The Abundance",
    verseCount: 3,
    juzStart: 30,
    revelationType: "meccan",
    difficulty: "beginner",
    ageGroup: "toddler",
    recommendedOrder: 7,
    tafsirBrief: "Allah gave the Prophet ﷺ Al-Kawthar, a beautiful river in Jannah! In gratitude, we pray and give to those in need. The one who hates the Prophet ﷺ has nothing.",
    tajweedNotes: ["Practice the madd in 'Al-Kawthar'", "Note the qalqalah on 'ta' in 'wa'nhar'"],
    verses: [
      { number: 1, arabic: "إِنَّا أَعْطَيْنَاكَ الْكَوْثَرَ", transliteration: "Inna a'tainakalk-kawthar", translation: "Indeed, We have granted you abundance" },
      { number: 2, arabic: "فَصَلِّ لِرَبِّكَ وَانْحَرْ", transliteration: "Fasalli li-rabbika wan-har", translation: "So pray to your Lord and sacrifice" },
      { number: 3, arabic: "إِنَّ شَانِئَكَ هُوَ الْأَبْتَرُ", transliteration: "Inna shani-aka huwal-abtar", translation: "Indeed, your enemy is the one cut off" }
    ]
  },
  {
    id: 8,
    number: 107,
    nameArabic: "الْمَاعُون",
    nameTransliteration: "Al-Ma'un",
    nameTranslation: "The Small Kindnesses",
    verseCount: 7,
    juzStart: 30,
    revelationType: "meccan",
    difficulty: "intermediate",
    ageGroup: "child",
    recommendedOrder: 8,
    tafsirBrief: "This surah talks about those who deny the Day of Judgment. They are harsh to orphans, don't feed the poor, and are careless in their prayers. We should be the opposite — kind and caring!",
    tajweedNotes: ["Practice ikhfa' in 'man yadu'", "Note the elongation in 'al-yatim'"],
    verses: [
      { number: 1, arabic: "أَرَأَيْتَ الَّذِي يُكَذِّبُ بِالدِّينِ", transliteration: "Ara-aytal-ladhi yukadhdhibu bid-din", translation: "Have you seen the one who denies the Recompense?" },
      { number: 2, arabic: "فَذَٰلِكَ الَّذِي يَدُعُّ الْيَتِيمَ", transliteration: "Fadhalikalladi yadu'ul-yatim", translation: "For that is the one who drives away the orphan" },
      { number: 3, arabic: "وَلَا يَحُضُّ عَلَىٰ طَعَامِ الْمِسْكِينِ", transliteration: "Wa la yahuddu 'ala ta'amil-miskin", translation: "And does not encourage the feeding of the poor" },
      { number: 4, arabic: "فَوَيْلٌ لِّلْمُصَلِّينَ", transliteration: "Fawailul-lil-musallin", translation: "So woe to those who pray" },
      { number: 5, arabic: "الَّذِينَ هُمْ عَن صَلَاتِهِمْ سَاهُونَ", transliteration: "Alladhina hum 'an salatihim sahun", translation: "Who are heedless of their prayer" },
      { number: 6, arabic: "الَّذِينَ هُمْ يُرَاءُونَ", transliteration: "Alladhina hum yura-un", translation: "Those who make show of their deeds" },
      { number: 7, arabic: "وَيَمْنَعُونَ الْمَاعُونَ", transliteration: "Wa yamna'unal-ma'un", translation: "And withhold simple assistance" }
    ]
  },
  {
    id: 9,
    number: 106,
    nameArabic: "قُرَيْش",
    nameTransliteration: "Quraysh",
    nameTranslation: "Quraysh",
    verseCount: 4,
    juzStart: 30,
    revelationType: "meccan",
    difficulty: "intermediate",
    ageGroup: "child",
    recommendedOrder: 9,
    tafsirBrief: "Allah reminded the Quraysh tribe of His blessings — safe trade journeys in winter and summer. In return, they should worship the One who feeds them and keeps them safe.",
    tajweedNotes: ["Practice the 'lam' in 'li-ilafi'", "Note the waw of 'aw'"],
    verses: [
      { number: 1, arabic: "لِإِيلَافِ قُرَيْشٍ", transliteration: "Li-ilafi Quraish", translation: "For the accustomed security of the Quraysh" },
      { number: 2, arabic: "إِيلَافِهِمْ رِحْلَةَ الشِّتَاءِ وَالصَّيْفِ", transliteration: "Ilafihim rihlatal-shita-i was-sayf", translation: "Their accustomed security in the journey of winter and summer" },
      { number: 3, arabic: "فَلْيَعْبُدُوا رَبَّ هَٰذَا الْبَيْتِ", transliteration: "Falya'budu rabba hadhal-bayt", translation: "Let them worship the Lord of this House" },
      { number: 4, arabic: "الَّذِي أَطْعَمَهُم مِّن جُوعٍ وَآمَنَهُم مِّنْ خَوْفٍ", transliteration: "Alladhi at'amahum min ju'iw wa-amanahum min khawf", translation: "Who has fed them, saving them from hunger, and made them safe, saving them from fear" }
    ]
  },
  {
    id: 10,
    number: 105,
    nameArabic: "الْفِيل",
    nameTransliteration: "Al-Fil",
    nameTranslation: "The Elephant",
    verseCount: 5,
    juzStart: 30,
    revelationType: "meccan",
    difficulty: "intermediate",
    ageGroup: "child",
    recommendedOrder: 10,
    tafsirBrief: "The army of elephants came to destroy the Ka'bah. Allah sent birds with small stones to destroy them completely! The year the Prophet ﷺ was born. Allah always protects His House.",
    tajweedNotes: ["Practice the 'seen' in 'sijjil'", "Note idghaam in 'bi ababiil'"],
    verses: [
      { number: 1, arabic: "أَلَمْ تَرَ كَيْفَ فَعَلَ رَبُّكَ بِأَصْحَابِ الْفِيلِ", transliteration: "Alam tara kayfa fa'ala rabbuka bi-as-habil-fil", translation: "Have you not considered how your Lord dealt with the companions of the elephant?" },
      { number: 2, arabic: "أَلَمْ يَجْعَلْ كَيْدَهُمْ فِي تَضْلِيلٍ", transliteration: "Alam yaj'al kaydahum fi tadlil", translation: "Did He not make their plan into misguidance?" },
      { number: 3, arabic: "وَأَرْسَلَ عَلَيْهِمْ طَيْرًا أَبَابِيلَ", transliteration: "Wa arsala 'alayhim tayran ababiil", translation: "And He sent against them birds in flocks" },
      { number: 4, arabic: "تَرْمِيهِم بِحِجَارَةٍ مِّن سِجِّيلٍ", transliteration: "Tarmiyhim bihijaratim min sijjil", translation: "Striking them with stones of hard clay" },
      { number: 5, arabic: "فَجَعَلَهُمْ كَعَصْفٍ مَّأْكُولٍ", transliteration: "Faja'alahum ka'asfim ma'kul", translation: "And He made them like eaten straw" }
    ]
  },
  {
    id: 11,
    number: 104,
    nameArabic: "الْهُمَزَة",
    nameTransliteration: "Al-Humazah",
    nameTranslation: "The Slanderer",
    verseCount: 9,
    juzStart: 30,
    revelationType: "meccan",
    difficulty: "intermediate",
    ageGroup: "preteen",
    recommendedOrder: 11,
    tafsirBrief: "This surah warns against those who mock others and think their money will last forever. Real success is in good character, not wealth or status.",
    tajweedNotes: ["Practice the emphatic 'ha' in 'humazah'", "Note the madd in 'Hutamah'"],
    verses: [
      { number: 1, arabic: "وَيْلٌ لِّكُلِّ هُمَزَةٍ لُّمَزَةٍ", transliteration: "Waylul-likulli humazatil-lumazah", translation: "Woe to every scorner and mocker" },
      { number: 2, arabic: "الَّذِي جَمَعَ مَالًا وَعَدَّدَهُ", transliteration: "Alladhi jama'a malaaw wa 'addadah", translation: "Who collects wealth and counts it" },
      { number: 3, arabic: "يَحْسَبُ أَنَّ مَالَهُ أَخْلَدَهُ", transliteration: "Yahsabu anna malahu akhladah", translation: "He thinks that his wealth will make him immortal" },
      { number: 4, arabic: "كَلَّا ۖ لَيُنبَذَنَّ فِي الْحُطَمَةِ", transliteration: "Kalla, layunbadhananna fil-hutamah", translation: "No! He will surely be thrown into the Crusher" },
      { number: 5, arabic: "وَمَا أَدْرَاكَ مَا الْحُطَمَةُ", transliteration: "Wa ma adraka mal-hutamah", translation: "And what can make you know what is the Crusher?" },
      { number: 6, arabic: "نَارُ اللَّهِ الْمُوقَدَةُ", transliteration: "Narullahil-muqadah", translation: "It is the fire of Allah, fully ablaze" },
      { number: 7, arabic: "الَّتِي تَطَّلِعُ عَلَى الْأَفْئِدَةِ", transliteration: "Allati tattali'u 'alal-af-idah", translation: "Which mounts directed at the hearts" },
      { number: 8, arabic: "إِنَّهَا عَلَيْهِم مُّؤْصَدَةٌ", transliteration: "Innaha 'alayhim mu'sadah", translation: "Indeed, it will be closed down upon them" },
      { number: 9, arabic: "فِي عَمَدٍ مُّمَدَّدَةٍ", transliteration: "Fi 'amadin mumaddadah", translation: "In extended columns" }
    ]
  },
  {
    id: 12,
    number: 103,
    nameArabic: "الْعَصْر",
    nameTransliteration: "Al-'Asr",
    nameTranslation: "The Declining Day",
    verseCount: 3,
    juzStart: 30,
    revelationType: "meccan",
    difficulty: "beginner",
    ageGroup: "child",
    recommendedOrder: 12,
    tafsirBrief: "By time itself, all people are at a loss except those who: believe, do good deeds, encourage each other to truth, and encourage each other to be patient. Imam Ash-Shafi'i said if people only reflected on this surah, it would be enough for them.",
    tajweedNotes: ["Practice the 'ayn' in 'Al-Asr'", "Note the waw in 'wal-'asr'"],
    verses: [
      { number: 1, arabic: "وَالْعَصْرِ", transliteration: "Wal-'asr", translation: "By time" },
      { number: 2, arabic: "إِنَّ الْإِنسَانَ لَفِي خُسْرٍ", transliteration: "Innal-insana lafi khusr", translation: "Indeed, mankind is in loss" },
      { number: 3, arabic: "إِلَّا الَّذِينَ آمَنُوا وَعَمِلُوا الصَّالِحَاتِ وَتَوَاصَوْا بِالْحَقِّ وَتَوَاصَوْا بِالصَّبْرِ", transliteration: "Illal-ladhina amanu wa 'amilus-salihati wa tawassaw bil-haqqi wa tawassaw bis-sabr", translation: "Except for those who have believed, done righteous deeds, and advised each other to truth and patience" }
    ]
  },
  {
    id: 13,
    number: 101,
    nameArabic: "الْقَارِعَة",
    nameTransliteration: "Al-Qari'ah",
    nameTranslation: "The Calamity",
    verseCount: 11,
    juzStart: 30,
    revelationType: "meccan",
    difficulty: "intermediate",
    ageGroup: "preteen",
    recommendedOrder: 13,
    tafsirBrief: "On the Day of Judgment, everything will be shaken. Our deeds will be weighed on a scale. If our good deeds are heavy, we will have a blessed life. If they are light, our home will be the Pit.",
    tajweedNotes: ["Practice the qalqalah on 'qaf'", "Note the madd in 'al-qari'ah'"],
    verses: [
      { number: 1, arabic: "الْقَارِعَةُ", transliteration: "Al-Qari'ah", translation: "The Calamity" },
      { number: 2, arabic: "مَا الْقَارِعَةُ", transliteration: "Mal-qari'ah", translation: "What is the Calamity?" },
      { number: 3, arabic: "وَمَا أَدْرَاكَ مَا الْقَارِعَةُ", transliteration: "Wa ma adraka mal-qari'ah", translation: "And what can make you know what is the Calamity?" },
      { number: 4, arabic: "يَوْمَ يَكُونُ النَّاسُ كَالْفَرَاشِ الْمَبْثُوثِ", transliteration: "Yawma yakunu n-nasu kal-farashil-mabthuth", translation: "It is the Day when people will be like moths, dispersed" },
      { number: 5, arabic: "وَتَكُونُ الْجِبَالُ كَالْعِهْنِ الْمَنفُوشِ", transliteration: "Wa takunu l-jibalu kal-'ihnil-manfush", translation: "And the mountains will be like wool, fluffed up" },
      { number: 6, arabic: "فَأَمَّا مَن ثَقُلَتْ مَوَازِينُهُ", transliteration: "Fa-amma man thaqulat mawazinuh", translation: "Then as for one whose scales are heavy with good deeds" },
      { number: 7, arabic: "فَهُوَ فِي عِيشَةٍ رَّاضِيَةٍ", transliteration: "Fahuwa fi 'ishatar-radiyah", translation: "He will be in a pleasant life" },
      { number: 8, arabic: "وَأَمَّا مَنْ خَفَّتْ مَوَازِينُهُ", transliteration: "Wa amma man khaffat mawazinuh", translation: "But as for one whose scales are light" },
      { number: 9, arabic: "فَأُمُّهُ هَاوِيَةٌ", transliteration: "Fa-ummuhu hawiyah", translation: "His refuge will be an abyss" },
      { number: 10, arabic: "وَمَا أَدْرَاكَ مَا هِيَهْ", transliteration: "Wa ma adraka ma hiyah", translation: "And what can make you know what that is?" },
      { number: 11, arabic: "نَارٌ حَامِيَةٌ", transliteration: "Narun hamiyah", translation: "It is a Fire, intensely hot" }
    ]
  },
  {
    id: 14,
    number: 99,
    nameArabic: "الزَّلْزَلَة",
    nameTransliteration: "Az-Zalzalah",
    nameTranslation: "The Earthquake",
    verseCount: 8,
    juzStart: 30,
    revelationType: "medinan",
    difficulty: "intermediate",
    ageGroup: "child",
    recommendedOrder: 14,
    tafsirBrief: "When the great earthquake comes, the Earth will reveal its secrets and people will see all their deeds. Even an atom's weight of good or bad will be shown. Every small deed matters!",
    tajweedNotes: ["Practice 'zal' in 'zalzalat'", "Note the qalqalah on 'dal' at end"],
    verses: [
      { number: 1, arabic: "إِذَا زُلْزِلَتِ الْأَرْضُ زِلْزَالَهَا", transliteration: "Idha zulzilatil-ardu zilzalaha", translation: "When the earth is shaken with its final earthquake" },
      { number: 2, arabic: "وَأَخْرَجَتِ الْأَرْضُ أَثْقَالَهَا", transliteration: "Wa akhrajatil-ardu athqalaha", translation: "And the earth discharges its burdens" },
      { number: 3, arabic: "وَقَالَ الْإِنسَانُ مَا لَهَا", transliteration: "Wa qalal-insanu ma laha", translation: "And man says: What is with it?" },
      { number: 4, arabic: "يَوْمَئِذٍ تُحَدِّثُ أَخْبَارَهَا", transliteration: "Yawma-idhin tuhaddith akhbarah", translation: "That Day, it will report its news" },
      { number: 5, arabic: "بِأَنَّ رَبَّكَ أَوْحَىٰ لَهَا", transliteration: "Bi-anna rabbaka awha laha", translation: "Because your Lord has commanded it" },
      { number: 6, arabic: "يَوْمَئِذٍ يَصْدُرُ النَّاسُ أَشْتَاتًا لِّيُرَوْا أَعْمَالَهُمْ", transliteration: "Yawma-idhin yasduru n-nasu ashtatall-liyuraw a'malahum", translation: "That Day, the people will depart separated, to be shown the result of their deeds" },
      { number: 7, arabic: "فَمَن يَعْمَلْ مِثْقَالَ ذَرَّةٍ خَيْرًا يَرَهُ", transliteration: "Faman ya'mal mithqala dharratin khayray-yarah", translation: "So whoever does an atom's weight of good will see it" },
      { number: 8, arabic: "وَمَن يَعْمَلْ مِثْقَالَ ذَرَّةٍ شَرًّا يَرَهُ", transliteration: "Wa man ya'mal mithqala dharratin sharray-yarah", translation: "And whoever does an atom's weight of evil will see it" }
    ]
  },
  {
    id: 15,
    number: 1,
    nameArabic: "الْفَاتِحَة",
    nameTransliteration: "Al-Fatihah",
    nameTranslation: "The Opening",
    verseCount: 7,
    juzStart: 1,
    revelationType: "meccan",
    difficulty: "beginner",
    ageGroup: "toddler",
    recommendedOrder: 0,
    tafsirBrief: "Al-Fatihah is the most important surah — we recite it in every rakah of prayer! It is a complete prayer to Allah: praising Him, declaring He is Lord of everything, and asking Him to guide us to the right path.",
    tajweedNotes: ["Must master before any other surah", "Practice the 'dh' in 'al-hamdu'", "Note the elongation of 'Ar-Rahman Ar-Raheem'", "Clear 'al-mustaqeem' with full madd"],
    verses: [
      { number: 1, arabic: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ", transliteration: "Bismillahir-rahmanir-raheem", translation: "In the name of Allah, the Most Gracious, the Most Merciful" },
      { number: 2, arabic: "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ", transliteration: "Alhamdu lillahi rabbil-'alamin", translation: "All praise is due to Allah, Lord of all the worlds" },
      { number: 3, arabic: "الرَّحْمَٰنِ الرَّحِيمِ", transliteration: "Ar-rahmanir-raheem", translation: "The Most Gracious, the Most Merciful" },
      { number: 4, arabic: "مَالِكِ يَوْمِ الدِّينِ", transliteration: "Maliki yawmid-deen", translation: "Master of the Day of Recompense" },
      { number: 5, arabic: "إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ", transliteration: "Iyyaka na'budu wa iyyaka nasta'een", translation: "It is You we worship and You we ask for help" },
      { number: 6, arabic: "اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ", transliteration: "Ihdinas-siratal-mustaqeem", translation: "Guide us to the straight path" },
      { number: 7, arabic: "صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ", transliteration: "Siratal-ladhina an'amta 'alayhim ghayril-maghdubi 'alayhim wa lad-dallin", translation: "The path of those upon whom You have bestowed favor, not of those who have evoked anger or those who are astray" }
    ]
  }
];

export function getSurahByNumber(number: number): SurahData | undefined {
  return SURAHS.find(s => s.number === number);
}

export function getSurahById(id: number): SurahData | undefined {
  return SURAHS.find(s => s.id === id);
}

export function getSurahsByAgeGroup(ageGroup: string): SurahData[] {
  return SURAHS.filter(s => s.ageGroup === ageGroup || s.ageGroup === "all");
}
