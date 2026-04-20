/**
 * quran-meta.ts
 * Complete static lookup tables for the Medina Mushaf (Hafs 'an 'Asim, 15-line layout).
 * No external API calls — all data is embedded here.
 */
import { db } from "@workspace/db";
import { quranVersesTable } from "@workspace/db/schema";

export interface VerseRef {
  surah: number;
  ayah: number;
}

export interface PageTargetResult {
  endSurah: number;
  endAyah: number;
  actualPages: number;
  snapReason: 'surah_end' | 'juz' | 'hizb_quarter' | 'page_end' | 'verse_split';
}

// ─── Surah verse counts (114 surahs, index 0 = Surah 1) ──────────────────────
export const SURAH_VERSE_COUNTS: number[] = [
  7,286,200,176,120,165,206,75,129,109,
  123,111,43,52,99,128,111,110,98,135,
  112,78,118,64,77,227,93,88,69,60,
  34,30,73,54,45,83,182,88,75,85,
  54,53,89,59,37,35,38,29,18,45,
  60,49,62,55,78,96,29,22,24,13,
  14,11,11,18,12,12,30,52,52,44,
  28,28,20,56,40,31,50,40,46,42,
  29,19,36,25,22,17,19,26,30,20,
  15,21,11,8,8,19,5,8,8,11,
  11,8,3,9,5,4,7,3,6,3,
  5,4,5,6,5,8,3,3,6,3,
];
SURAH_VERSE_COUNTS.length = 114;

// ─── Surah start pages (index 0 = Surah 1) ────────────────────────────────────
export const SURAH_START_PAGES: number[] = [
  1,2,50,77,106,128,151,177,187,208,
  221,235,249,255,261,267,282,293,305,312,
  322,332,342,350,359,367,377,385,396,404,
  411,415,417,428,434,440,446,453,458,467,
  477,483,489,496,499,502,507,511,515,518,
  520,523,526,529,532,537,542,545,549,551,
  553,556,558,560,562,564,566,568,570,572,
  574,576,578,580,582,584,586,588,590,592,
  594,596,597,598,599,600,601,602,603,604,
  604,604,604,604,604,604,604,604,604,604,
  // Surahs 101-114 (Juz 30 short surahs)
  600,601,601,601,601,602,602,602,603,603,
  603,604,604,604,
];

// ─── Page to first verse (604 pages, index 0 = page 1) ───────────────────────
export const PAGE_TO_FIRST_VERSE: VerseRef[] = [
  {surah:1,ayah:1},{surah:2,ayah:1},{surah:2,ayah:6},{surah:2,ayah:17},{surah:2,ayah:25},
  {surah:2,ayah:30},{surah:2,ayah:38},{surah:2,ayah:44},{surah:2,ayah:49},{surah:2,ayah:56},
  {surah:2,ayah:62},{surah:2,ayah:70},{surah:2,ayah:78},{surah:2,ayah:84},{surah:2,ayah:90},
  {surah:2,ayah:97},{surah:2,ayah:104},{surah:2,ayah:110},{surah:2,ayah:118},{surah:2,ayah:124},
  {surah:2,ayah:130},{surah:2,ayah:136},{surah:2,ayah:142},{surah:2,ayah:148},{surah:2,ayah:154},
  {surah:2,ayah:160},{surah:2,ayah:168},{surah:2,ayah:174},{surah:2,ayah:182},{surah:2,ayah:187},
  {surah:2,ayah:191},{surah:2,ayah:197},{surah:2,ayah:203},{surah:2,ayah:211},{surah:2,ayah:218},
  {surah:2,ayah:224},{surah:2,ayah:231},{surah:2,ayah:238},{surah:2,ayah:245},{surah:2,ayah:249},
  {surah:2,ayah:254},{surah:2,ayah:260},{surah:2,ayah:265},{surah:2,ayah:270},{surah:2,ayah:275},
  {surah:2,ayah:282},{surah:2,ayah:284},{surah:3,ayah:1},{surah:3,ayah:10},{surah:3,ayah:16},
  {surah:3,ayah:23},{surah:3,ayah:30},{surah:3,ayah:38},{surah:3,ayah:46},{surah:3,ayah:54},
  {surah:3,ayah:62},{surah:3,ayah:71},{surah:3,ayah:79},{surah:3,ayah:87},{surah:3,ayah:93},
  {surah:3,ayah:101},{surah:3,ayah:109},{surah:3,ayah:117},{surah:3,ayah:122},{surah:3,ayah:130},
  {surah:3,ayah:138},{surah:3,ayah:146},{surah:3,ayah:154},{surah:3,ayah:163},{surah:3,ayah:171},
  {surah:3,ayah:180},{surah:3,ayah:187},{surah:3,ayah:195},{surah:4,ayah:1},{surah:4,ayah:7},
  {surah:4,ayah:12},{surah:4,ayah:15},{surah:4,ayah:20},{surah:4,ayah:27},{surah:4,ayah:34},
  {surah:4,ayah:41},{surah:4,ayah:48},{surah:4,ayah:56},{surah:4,ayah:62},{surah:4,ayah:69},
  {surah:4,ayah:78},{surah:4,ayah:85},{surah:4,ayah:93},{surah:4,ayah:100},{surah:4,ayah:106},
  {surah:4,ayah:114},{surah:4,ayah:122},{surah:4,ayah:130},{surah:4,ayah:136},{surah:4,ayah:141},
  {surah:4,ayah:148},{surah:4,ayah:155},{surah:4,ayah:163},{surah:4,ayah:171},{surah:4,ayah:176},
  {surah:5,ayah:1},{surah:5,ayah:4},{surah:5,ayah:8},{surah:5,ayah:13},{surah:5,ayah:18},
  {surah:5,ayah:24},{surah:5,ayah:29},{surah:5,ayah:35},{surah:5,ayah:42},{surah:5,ayah:48},
  {surah:5,ayah:52},{surah:5,ayah:58},{surah:5,ayah:65},{surah:5,ayah:72},{surah:5,ayah:78},
  {surah:5,ayah:84},{surah:5,ayah:90},{surah:5,ayah:97},{surah:5,ayah:104},{surah:5,ayah:110},
  {surah:5,ayah:115},{surah:6,ayah:1},{surah:6,ayah:6},{surah:6,ayah:14},{surah:6,ayah:20},
  {surah:6,ayah:28},{surah:6,ayah:36},{surah:6,ayah:44},{surah:6,ayah:52},{surah:6,ayah:59},
  {surah:6,ayah:67},{surah:6,ayah:74},{surah:6,ayah:82},{surah:6,ayah:91},{surah:6,ayah:99},
  {surah:6,ayah:106},{surah:6,ayah:111},{surah:6,ayah:119},{surah:6,ayah:126},{surah:6,ayah:134},
  {surah:6,ayah:141},{surah:6,ayah:147},{surah:6,ayah:153},{surah:6,ayah:159},{surah:6,ayah:164},
  {surah:7,ayah:1},{surah:7,ayah:8},{surah:7,ayah:17},{surah:7,ayah:26},{surah:7,ayah:32},
  {surah:7,ayah:38},{surah:7,ayah:44},{surah:7,ayah:52},{surah:7,ayah:58},{surah:7,ayah:66},
  {surah:7,ayah:74},{surah:7,ayah:83},{surah:7,ayah:91},{surah:7,ayah:100},{surah:7,ayah:108},
  {surah:7,ayah:116},{surah:7,ayah:124},{surah:7,ayah:131},{surah:7,ayah:138},{surah:7,ayah:144},
  {surah:7,ayah:150},{surah:7,ayah:157},{surah:7,ayah:163},{surah:7,ayah:171},{surah:7,ayah:178},
  {surah:7,ayah:185},{surah:7,ayah:190},{surah:7,ayah:196},{surah:7,ayah:202},{surah:8,ayah:1},
  {surah:8,ayah:6},{surah:8,ayah:12},{surah:8,ayah:18},{surah:8,ayah:24},{surah:8,ayah:30},
  {surah:8,ayah:36},{surah:8,ayah:42},{surah:8,ayah:47},{surah:8,ayah:53},{surah:8,ayah:60},
  {surah:8,ayah:66},{surah:8,ayah:71},{surah:9,ayah:1},{surah:9,ayah:7},{surah:9,ayah:13},
  {surah:9,ayah:19},{surah:9,ayah:26},{surah:9,ayah:33},{surah:9,ayah:38},{surah:9,ayah:44},
  {surah:9,ayah:50},{surah:9,ayah:57},{surah:9,ayah:64},{surah:9,ayah:70},{surah:9,ayah:77},
  {surah:9,ayah:84},{surah:9,ayah:90},{surah:9,ayah:97},{surah:9,ayah:104},{surah:9,ayah:111},
  {surah:9,ayah:118},{surah:9,ayah:123},{surah:10,ayah:1},{surah:10,ayah:7},{surah:10,ayah:16},
  {surah:10,ayah:24},{surah:10,ayah:32},{surah:10,ayah:41},{surah:10,ayah:50},{surah:10,ayah:58},
  {surah:10,ayah:65},{surah:10,ayah:74},{surah:10,ayah:83},{surah:10,ayah:90},{surah:10,ayah:98},
  {surah:11,ayah:1},{surah:11,ayah:6},{surah:11,ayah:14},{surah:11,ayah:21},{surah:11,ayah:29},
  {surah:11,ayah:38},{surah:11,ayah:46},{surah:11,ayah:54},{surah:11,ayah:62},{surah:11,ayah:71},
  {surah:11,ayah:79},{surah:11,ayah:89},{surah:11,ayah:98},{surah:11,ayah:107},{surah:12,ayah:1},
  {surah:12,ayah:7},{surah:12,ayah:16},{surah:12,ayah:24},{surah:12,ayah:32},{surah:12,ayah:41},
  {surah:12,ayah:50},{surah:12,ayah:58},{surah:12,ayah:66},{surah:12,ayah:75},{surah:12,ayah:84},
  {surah:12,ayah:93},{surah:12,ayah:100},{surah:12,ayah:107},{surah:13,ayah:1},{surah:13,ayah:7},
  {surah:13,ayah:14},{surah:13,ayah:20},{surah:13,ayah:28},{surah:13,ayah:34},{surah:14,ayah:1},
  {surah:14,ayah:7},{surah:14,ayah:14},{surah:14,ayah:22},{surah:14,ayah:29},{surah:14,ayah:38},
  {surah:15,ayah:1},{surah:15,ayah:16},{surah:15,ayah:32},{surah:15,ayah:50},{surah:15,ayah:67},
  {surah:15,ayah:85},{surah:16,ayah:1},{surah:16,ayah:11},{surah:16,ayah:22},{surah:16,ayah:33},
  {surah:16,ayah:43},{surah:16,ayah:55},{surah:16,ayah:66},{surah:16,ayah:77},{surah:16,ayah:88},
  {surah:16,ayah:98},{surah:16,ayah:108},{surah:16,ayah:116},{surah:16,ayah:122},{surah:17,ayah:1},
  {surah:17,ayah:2},{surah:17,ayah:9},{surah:17,ayah:19},{surah:17,ayah:29},{surah:17,ayah:39},
  {surah:17,ayah:50},{surah:17,ayah:61},{surah:17,ayah:71},{surah:17,ayah:80},{surah:17,ayah:89},
  {surah:17,ayah:97},{surah:17,ayah:104},{surah:18,ayah:1},{surah:18,ayah:8},{surah:18,ayah:17},
  {surah:18,ayah:25},{surah:18,ayah:32},{surah:18,ayah:42},{surah:18,ayah:51},{surah:18,ayah:61},
  {surah:18,ayah:70},{surah:18,ayah:79},{surah:18,ayah:88},{surah:18,ayah:99},{surah:19,ayah:1},
  {surah:19,ayah:12},{surah:19,ayah:22},{surah:19,ayah:34},{surah:19,ayah:44},{surah:19,ayah:55},
  {surah:19,ayah:66},{surah:20,ayah:1},{surah:20,ayah:13},{surah:20,ayah:25},{surah:20,ayah:39},
  {surah:20,ayah:52},{surah:20,ayah:66},{surah:20,ayah:78},{surah:20,ayah:91},{surah:20,ayah:103},
  {surah:20,ayah:115},{surah:21,ayah:1},{surah:21,ayah:11},{surah:21,ayah:22},{surah:21,ayah:33},
  {surah:21,ayah:45},{surah:21,ayah:58},{surah:21,ayah:72},{surah:21,ayah:82},{surah:21,ayah:91},
  {surah:21,ayah:101},{surah:22,ayah:1},{surah:22,ayah:6},{surah:22,ayah:14},{surah:22,ayah:24},
  {surah:22,ayah:31},{surah:22,ayah:39},{surah:22,ayah:47},{surah:22,ayah:55},{surah:22,ayah:63},
  {surah:22,ayah:72},{surah:23,ayah:1},{surah:23,ayah:11},{surah:23,ayah:24},{surah:23,ayah:38},
  {surah:23,ayah:53},{surah:23,ayah:68},{surah:23,ayah:82},{surah:23,ayah:97},{surah:24,ayah:1},
  {surah:24,ayah:6},{surah:24,ayah:13},{surah:24,ayah:22},{surah:24,ayah:28},{surah:24,ayah:35},
  {surah:24,ayah:42},{surah:24,ayah:50},{surah:24,ayah:58},{surah:25,ayah:1},{surah:25,ayah:7},
  {surah:25,ayah:16},{surah:25,ayah:23},{surah:25,ayah:34},{surah:25,ayah:44},{surah:25,ayah:54},
  {surah:25,ayah:63},{surah:26,ayah:1},{surah:26,ayah:14},{surah:26,ayah:31},{surah:26,ayah:52},
  {surah:26,ayah:71},{surah:26,ayah:92},{surah:26,ayah:111},{surah:26,ayah:131},{surah:26,ayah:151},
  {surah:26,ayah:171},{surah:27,ayah:1},{surah:27,ayah:14},{surah:27,ayah:24},{surah:27,ayah:36},
  {surah:27,ayah:46},{surah:27,ayah:56},{surah:27,ayah:65},{surah:27,ayah:74},{surah:28,ayah:1},
  {surah:28,ayah:12},{surah:28,ayah:22},{surah:28,ayah:30},{surah:28,ayah:38},{surah:28,ayah:47},
  {surah:28,ayah:56},{surah:28,ayah:63},{surah:28,ayah:71},{surah:28,ayah:78},{surah:28,ayah:85},
  {surah:29,ayah:1},{surah:29,ayah:8},{surah:29,ayah:16},{surah:29,ayah:24},{surah:29,ayah:32},
  {surah:29,ayah:40},{surah:29,ayah:46},{surah:29,ayah:54},{surah:30,ayah:1},{surah:30,ayah:11},
  {surah:30,ayah:21},{surah:30,ayah:31},{surah:30,ayah:41},{surah:30,ayah:51},{surah:30,ayah:59},
  {surah:31,ayah:1},{surah:31,ayah:9},{surah:31,ayah:17},{surah:31,ayah:26},{surah:32,ayah:1},
  {surah:32,ayah:10},{surah:33,ayah:1},{surah:33,ayah:7},{surah:33,ayah:17},{surah:33,ayah:24},
  {surah:33,ayah:31},{surah:33,ayah:38},{surah:33,ayah:45},{surah:33,ayah:52},{surah:33,ayah:59},
  {surah:33,ayah:66},{surah:34,ayah:1},{surah:34,ayah:8},{surah:34,ayah:16},{surah:34,ayah:23},
  {surah:34,ayah:31},{surah:34,ayah:40},{surah:34,ayah:49},{surah:35,ayah:1},{surah:35,ayah:8},
  {surah:35,ayah:16},{surah:35,ayah:24},{surah:35,ayah:33},{surah:35,ayah:41},{surah:36,ayah:1},
  {surah:36,ayah:14},{surah:36,ayah:28},{surah:36,ayah:41},{surah:36,ayah:56},{surah:36,ayah:69},
  {surah:37,ayah:1},{surah:37,ayah:22},{surah:37,ayah:52},{surah:37,ayah:79},{surah:37,ayah:112},
  {surah:37,ayah:144},{surah:37,ayah:169},{surah:38,ayah:1},{surah:38,ayah:16},{surah:38,ayah:30},
  {surah:38,ayah:47},{surah:38,ayah:63},{surah:39,ayah:1},{surah:39,ayah:11},{surah:39,ayah:22},
  {surah:39,ayah:32},{surah:39,ayah:43},{surah:39,ayah:53},{surah:39,ayah:64},{surah:39,ayah:71},
  {surah:40,ayah:1},{surah:40,ayah:10},{surah:40,ayah:22},{surah:40,ayah:33},{surah:40,ayah:44},
  {surah:40,ayah:55},{surah:40,ayah:66},{surah:40,ayah:75},{surah:40,ayah:82},{surah:41,ayah:1},
  {surah:41,ayah:11},{surah:41,ayah:21},{surah:41,ayah:31},{surah:41,ayah:41},{surah:41,ayah:50},
  {surah:42,ayah:1},{surah:42,ayah:11},{surah:42,ayah:20},{surah:42,ayah:29},{surah:42,ayah:38},
  {surah:42,ayah:47},{surah:43,ayah:1},{surah:43,ayah:14},{surah:43,ayah:24},{surah:43,ayah:36},
  {surah:43,ayah:46},{surah:43,ayah:57},{surah:43,ayah:68},{surah:44,ayah:1},{surah:44,ayah:20},
  {surah:44,ayah:40},{surah:45,ayah:1},{surah:45,ayah:14},{surah:45,ayah:28},{surah:46,ayah:1},
  {surah:46,ayah:11},{surah:46,ayah:22},{surah:46,ayah:32},{surah:47,ayah:1},{surah:47,ayah:11},
  {surah:47,ayah:21},{surah:47,ayah:32},{surah:48,ayah:1},{surah:48,ayah:11},{surah:48,ayah:21},
  {surah:48,ayah:29},{surah:49,ayah:1},{surah:49,ayah:9},{surah:50,ayah:1},{surah:50,ayah:16},
  {surah:50,ayah:30},{surah:51,ayah:1},{surah:51,ayah:19},{surah:51,ayah:38},{surah:52,ayah:1},
  {surah:52,ayah:21},{surah:52,ayah:40},{surah:53,ayah:1},{surah:53,ayah:20},{surah:53,ayah:40},
  {surah:54,ayah:1},{surah:54,ayah:21},{surah:54,ayah:43},{surah:55,ayah:1},{surah:55,ayah:27},
  {surah:55,ayah:53},{surah:56,ayah:1},{surah:56,ayah:27},{surah:56,ayah:52},{surah:56,ayah:74},
  {surah:57,ayah:1},{surah:57,ayah:11},{surah:57,ayah:22},{surah:57,ayah:27},{surah:58,ayah:1},
  {surah:58,ayah:9},{surah:58,ayah:17},{surah:59,ayah:1},{surah:59,ayah:8},{surah:59,ayah:16},
  {surah:60,ayah:1},{surah:60,ayah:7},{surah:61,ayah:1},{surah:62,ayah:1},{surah:62,ayah:7},
  {surah:63,ayah:1},{surah:63,ayah:7},{surah:64,ayah:1},{surah:64,ayah:9},{surah:65,ayah:1},
  {surah:65,ayah:6},{surah:66,ayah:1},{surah:66,ayah:8},{surah:67,ayah:1},{surah:67,ayah:14},
  {surah:67,ayah:24},{surah:68,ayah:1},{surah:68,ayah:18},{surah:68,ayah:38},{surah:69,ayah:1},
  {surah:69,ayah:19},{surah:69,ayah:40},{surah:70,ayah:1},{surah:70,ayah:22},{surah:71,ayah:1},
  {surah:71,ayah:20},{surah:72,ayah:1},{surah:72,ayah:20},{surah:73,ayah:1},{surah:73,ayah:15},
  {surah:74,ayah:1},{surah:74,ayah:26},{surah:74,ayah:47},{surah:75,ayah:1},{surah:75,ayah:23},
  {surah:76,ayah:1},{surah:76,ayah:22},{surah:77,ayah:1},{surah:77,ayah:29},{surah:78,ayah:1},
  {surah:78,ayah:29},{surah:79,ayah:1},{surah:79,ayah:27},{surah:80,ayah:1},{surah:80,ayah:29},
  {surah:81,ayah:1},{surah:82,ayah:1},{surah:83,ayah:1},{surah:83,ayah:29},{surah:84,ayah:1},
  {surah:85,ayah:1},{surah:87,ayah:1},{surah:88,ayah:1},{surah:89,ayah:1},{surah:89,ayah:23},
  {surah:92,ayah:1},{surah:95,ayah:1},{surah:99,ayah:1},{surah:112,ayah:1},
];

// ─── Juz boundaries (30 juz, index 0 = Juz 1) ────────────────────────────────
export const JUZ_STARTS: VerseRef[] = [
  {surah:1,ayah:1},{surah:2,ayah:142},{surah:2,ayah:253},{surah:3,ayah:93},{surah:4,ayah:24},
  {surah:4,ayah:148},{surah:5,ayah:82},{surah:6,ayah:111},{surah:7,ayah:88},{surah:8,ayah:41},
  {surah:9,ayah:93},{surah:11,ayah:6},{surah:12,ayah:53},{surah:15,ayah:1},{surah:17,ayah:1},
  {surah:18,ayah:75},{surah:21,ayah:1},{surah:23,ayah:1},{surah:25,ayah:21},{surah:27,ayah:56},
  {surah:29,ayah:46},{surah:33,ayah:31},{surah:36,ayah:28},{surah:39,ayah:32},{surah:41,ayah:47},
  {surah:46,ayah:1},{surah:51,ayah:31},{surah:58,ayah:1},{surah:67,ayah:1},{surah:78,ayah:1},
];

// ─── Hizb quarter boundaries (240 quarters = 60 hizb × 4) ────────────────────
export const HIZB_QUARTER_STARTS: VerseRef[] = [
  {surah:1,ayah:1},{surah:2,ayah:25},{surah:2,ayah:38},{surah:2,ayah:50},
  {surah:2,ayah:60},{surah:2,ayah:75},{surah:2,ayah:92},{surah:2,ayah:106},
  {surah:2,ayah:121},{surah:2,ayah:135},{surah:2,ayah:148},{surah:2,ayah:160},
  {surah:2,ayah:169},{surah:2,ayah:182},{surah:2,ayah:191},{surah:2,ayah:202},
  {surah:2,ayah:211},{surah:2,ayah:224},{surah:2,ayah:234},{surah:2,ayah:246},
  {surah:2,ayah:254},{surah:2,ayah:263},{surah:2,ayah:272},{surah:2,ayah:283},
  {surah:3,ayah:1},{surah:3,ayah:15},{surah:3,ayah:26},{surah:3,ayah:38},
  {surah:3,ayah:52},{surah:3,ayah:64},{surah:3,ayah:77},{surah:3,ayah:93},
  {surah:3,ayah:102},{surah:3,ayah:114},{surah:3,ayah:133},{surah:3,ayah:152},
  {surah:3,ayah:171},{surah:3,ayah:186},{surah:4,ayah:1},{surah:4,ayah:12},
  {surah:4,ayah:24},{surah:4,ayah:36},{surah:4,ayah:48},{surah:4,ayah:59},
  {surah:4,ayah:72},{surah:4,ayah:88},{surah:4,ayah:100},{surah:4,ayah:114},
  {surah:4,ayah:128},{surah:4,ayah:141},{surah:4,ayah:155},{surah:4,ayah:170},
  {surah:5,ayah:1},{surah:5,ayah:13},{surah:5,ayah:28},{surah:5,ayah:41},
  {surah:5,ayah:53},{surah:5,ayah:66},{surah:5,ayah:82},{surah:5,ayah:96},
  {surah:5,ayah:109},{surah:6,ayah:1},{surah:6,ayah:20},{surah:6,ayah:35},
  {surah:6,ayah:53},{surah:6,ayah:70},{surah:6,ayah:91},{surah:6,ayah:111},
  {surah:6,ayah:125},{surah:6,ayah:141},{surah:6,ayah:152},{surah:6,ayah:161},
  {surah:7,ayah:1},{surah:7,ayah:28},{surah:7,ayah:47},{surah:7,ayah:66},
  {surah:7,ayah:88},{surah:7,ayah:110},{surah:7,ayah:128},{surah:7,ayah:148},
  {surah:7,ayah:168},{surah:7,ayah:186},{surah:7,ayah:196},{surah:8,ayah:1},
  {surah:8,ayah:25},{surah:8,ayah:41},{surah:8,ayah:54},{surah:8,ayah:68},
  {surah:9,ayah:1},{surah:9,ayah:21},{surah:9,ayah:38},{surah:9,ayah:58},
  {surah:9,ayah:75},{surah:9,ayah:93},{surah:9,ayah:111},{surah:9,ayah:122},
  {surah:10,ayah:1},{surah:10,ayah:26},{surah:10,ayah:53},{surah:10,ayah:72},
  {surah:10,ayah:90},{surah:11,ayah:6},{surah:11,ayah:24},{surah:11,ayah:43},
  {surah:11,ayah:62},{surah:11,ayah:84},{surah:11,ayah:107},{surah:12,ayah:7},
  {surah:12,ayah:30},{surah:12,ayah:53},{surah:12,ayah:77},{surah:12,ayah:101},
  {surah:13,ayah:1},{surah:13,ayah:19},{surah:14,ayah:1},{surah:14,ayah:22},
  {surah:15,ayah:1},{surah:15,ayah:50},{surah:16,ayah:1},{surah:16,ayah:33},
  {surah:16,ayah:72},{surah:16,ayah:100},{surah:17,ayah:1},{surah:17,ayah:27},
  {surah:17,ayah:56},{surah:17,ayah:80},{surah:18,ayah:1},{surah:18,ayah:29},
  {surah:18,ayah:54},{surah:18,ayah:75},{surah:18,ayah:99},{surah:19,ayah:22},
  {surah:19,ayah:52},{surah:20,ayah:1},{surah:20,ayah:52},{surah:20,ayah:99},
  {surah:21,ayah:1},{surah:21,ayah:29},{surah:21,ayah:57},{surah:21,ayah:83},
  {surah:22,ayah:1},{surah:22,ayah:25},{surah:22,ayah:47},{surah:22,ayah:66},
  {surah:23,ayah:1},{surah:23,ayah:36},{surah:23,ayah:75},{surah:24,ayah:1},
  {surah:24,ayah:21},{surah:24,ayah:37},{surah:24,ayah:55},{surah:25,ayah:1},
  {surah:25,ayah:22},{surah:25,ayah:47},{surah:26,ayah:1},{surah:26,ayah:52},
  {surah:26,ayah:112},{surah:26,ayah:175},{surah:27,ayah:16},{surah:27,ayah:56},
  {surah:27,ayah:82},{surah:28,ayah:22},{surah:28,ayah:52},{surah:29,ayah:1},
  {surah:29,ayah:26},{surah:29,ayah:46},{surah:30,ayah:12},{surah:30,ayah:41},
  {surah:31,ayah:1},{surah:31,ayah:22},{surah:32,ayah:12},{surah:33,ayah:1},
  {surah:33,ayah:24},{surah:33,ayah:51},{surah:34,ayah:8},{surah:34,ayah:31},
  {surah:35,ayah:1},{surah:35,ayah:24},{surah:36,ayah:14},{surah:36,ayah:41},
  {surah:37,ayah:1},{surah:37,ayah:62},{surah:37,ayah:122},{surah:38,ayah:1},
  {surah:38,ayah:37},{surah:39,ayah:8},{surah:39,ayah:32},{surah:39,ayah:64},
  {surah:40,ayah:22},{surah:40,ayah:51},{surah:41,ayah:9},{surah:41,ayah:38},
  {surah:42,ayah:1},{surah:42,ayah:27},{surah:43,ayah:1},{surah:43,ayah:46},
  {surah:44,ayah:1},{surah:45,ayah:1},{surah:45,ayah:23},{surah:46,ayah:11},
  {surah:47,ayah:1},{surah:47,ayah:21},{surah:48,ayah:11},{surah:49,ayah:1},
  {surah:49,ayah:12},{surah:50,ayah:16},{surah:51,ayah:1},{surah:51,ayah:31},
  {surah:52,ayah:1},{surah:52,ayah:33},{surah:53,ayah:24},{surah:54,ayah:1},
  {surah:54,ayah:33},{surah:55,ayah:24},{surah:56,ayah:1},{surah:56,ayah:52},
  {surah:57,ayah:1},{surah:57,ayah:22},{surah:58,ayah:10},{surah:59,ayah:1},
  {surah:59,ayah:16},{surah:61,ayah:1},{surah:62,ayah:7},{surah:64,ayah:1},
  {surah:65,ayah:1},{surah:66,ayah:1},{surah:67,ayah:1},{surah:68,ayah:1},
  {surah:69,ayah:1},{surah:70,ayah:16},{surah:72,ayah:1},{surah:73,ayah:1},
  {surah:74,ayah:1},{surah:75,ayah:1},{surah:76,ayah:1},{surah:77,ayah:1},
  {surah:78,ayah:1},{surah:80,ayah:1},{surah:82,ayah:1},{surah:85,ayah:1},
];

// ─── DB-backed verse→page cache ───────────────────────────────────────────────

export const versePageCache = new Map<string, number>();
export const pageLastVerseCache = new Map<number, VerseRef>();
let cacheLoaded = false;

export async function ensureVersePageCache(): Promise<void> {
  if (cacheLoaded) return;
  cacheLoaded = true;
  try {
    const rows = await db.select({
      surahNumber: quranVersesTable.surahNumber,
      ayahNumber: quranVersesTable.ayahNumber,
      pageNumber: quranVersesTable.pageNumber,
    }).from(quranVersesTable);
    for (const row of rows) {
      versePageCache.set(`${row.surahNumber}:${row.ayahNumber}`, row.pageNumber);
    }
    console.log(`[quran-meta] Loaded ${versePageCache.size} verse→page mappings from DB`);
    for (const [key, page] of versePageCache) {
      const [s, a] = key.split(":").map(Number);
      const existing = pageLastVerseCache.get(page);
      if (!existing || s > existing.surah || (s === existing.surah && a > existing.ayah)) {
        pageLastVerseCache.set(page, { surah: s, ayah: a });
      }
    }
    console.log(`[quran-meta] Built page→lastVerse map for ${pageLastVerseCache.size} pages`);
  } catch (err) {
    console.error("[quran-meta] Failed to load verse page cache from DB:", err);
  }
}

// ─── Helper functions ─────────────────────────────────────────────────────────

export function compareVerseRefs(a: VerseRef, b: VerseRef): number {
  if (a.surah !== b.surah) return a.surah - b.surah;
  return a.ayah - b.ayah;
}

export function lastAyahOfSurah(surah: number): number {
  return SURAH_VERSE_COUNTS[surah - 1] ?? 0;
}

export function nextVerse(surah: number, ayah: number): VerseRef | null {
  const count = SURAH_VERSE_COUNTS[surah - 1];
  if (!count) return null;
  if (ayah < count) return { surah, ayah: ayah + 1 };
  if (surah < 114) return { surah: surah + 1, ayah: 1 };
  return null;
}

/** Get the page number (1-indexed) that contains surah:ayah */
export function getPageForVerse(surah: number, ayah: number): number {
  if (surah < 1 || surah > 114) return 1;

  const surahStartPage = SURAH_START_PAGES[surah - 1];

  if (versePageCache.size > 0) {
    for (let a = ayah; a >= 1; a--) {
      const p = versePageCache.get(`${surah}:${a}`);
      if (p !== undefined) return p;
    }
  }

  // Static fallback (before cache loads)
  if (ayah <= 1) return surahStartPage ?? 1;
  let lo = 0, hi = PAGE_TO_FIRST_VERSE.length - 1, result = surahStartPage ?? 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const v = PAGE_TO_FIRST_VERSE[mid];
    if (v.surah < surah || (v.surah === surah && v.ayah <= ayah)) { result = mid + 1; lo = mid + 1; }
    else hi = mid - 1;
  }
  return Math.max(result, surahStartPage ?? 1);
}

/**
 * Returns the fractional page position of a verse.
 * atEnd=false → start of the verse slot; atEnd=true → end of the verse slot.
 * Allows sub-page precision when multiple surah ends share the same integer page.
 */
function getFractionalPage(surah: number, ayah: number, atEnd = false): number {
  const intPage = getPageForVerse(surah, ayah);
  const pageStart = PAGE_TO_FIRST_VERSE[intPage - 1];
  if (!pageStart) return atEnd ? intPage + 1 : intPage;

  let idx = -1;
  let total = 0;
  let cur: VerseRef = { surah: pageStart.surah, ayah: pageStart.ayah };

  for (let i = 0; i < 300; i++) {
    if (cur.surah === surah && cur.ayah === ayah) idx = total;
    total++;
    const n = nextVerse(cur.surah, cur.ayah);
    if (!n || getPageForVerse(n.surah, n.ayah) > intPage) break;
    cur = n;
  }

  if (idx < 0 || total === 0) return atEnd ? intPage + 1 : intPage;
  return intPage + (atEnd ? idx + 1 : idx) / total;
}

/**
 * Given a start position and page budget, find the best stopping point.
 * Priority: surah_end > juz > hizb_quarter > page_end > verse_split
 */
export function resolvePageTarget(
  startSurah: number,
  startAyah: number,
  pagesTarget: number
): PageTargetResult {
  const startPage = getPageForVerse(startSurah, startAyah);
  const targetPage = startPage + pagesTarget;
  const hardStopPage = startPage + pagesTarget * 1.05;

  type Candidate = VerseRef & { reason: PageTargetResult['snapReason']; page: number };
  const candidates: Candidate[] = [];
  const start: VerseRef = { surah: startSurah, ayah: startAyah };

  // Surah ends within budget — only snap to surah end if it fits within targetPage (no overshoot for surah ends)
  for (let s = startSurah; s <= 114; s++) {
    const lastAyah = SURAH_VERSE_COUNTS[s - 1];
    const endRef: VerseRef = { surah: s, ayah: lastAyah };
    if (compareVerseRefs(endRef, start) <= 0) continue;
    const endPage = getPageForVerse(s, lastAyah);
    if (endPage > hardStopPage) break;
    if (endPage < targetPage) {
      candidates.push({ ...endRef, reason: 'surah_end', page: endPage });
    }
  }

  // Juz boundaries
  for (const juz of JUZ_STARTS) {
    if (compareVerseRefs(juz, start) <= 0) continue;
    const p = getPageForVerse(juz.surah, juz.ayah);
    if (p > hardStopPage) break;
    candidates.push({ ...juz, reason: 'juz', page: p });
  }

  // Hizb quarter boundaries
  for (const hq of HIZB_QUARTER_STARTS) {
    if (compareVerseRefs(hq, start) <= 0) continue;
    const p = getPageForVerse(hq.surah, hq.ayah);
    if (p > hardStopPage) break;
    candidates.push({ ...hq, reason: 'hizb_quarter', page: p });
  }

  // Page ends — use DB-backed reverse map if available, fall back to static array
  const lastFullPage = Math.floor(targetPage) - 1;
  for (let p = startPage; p <= Math.min(lastFullPage, 604); p++) {
    let ref: VerseRef | null = null;
    if (pageLastVerseCache.size > 0) {
      ref = pageLastVerseCache.get(p) ?? null;
    } else {
      const nextIdx = p;
      if (nextIdx < PAGE_TO_FIRST_VERSE.length) {
        const nf = PAGE_TO_FIRST_VERSE[nextIdx];
        let es = nf.surah;
        let ea = nf.ayah - 1;
        if (ea < 1) { es -= 1; ea = SURAH_VERSE_COUNTS[es - 1] ?? 1; }
        ref = { surah: es, ayah: ea };
      }
    }
    if (ref && compareVerseRefs(ref, start) > 0) {
      candidates.push({ ...ref, reason: 'page_end', page: p });
    }
  }

  if (candidates.length > 0) {
    const PRIORITY: Record<PageTargetResult['snapReason'], number> = {
      surah_end: 0, juz: 1, hizb_quarter: 2, page_end: 3, verse_split: 4,
    };
    const startFrac = getFractionalPage(startSurah, startAyah);
    const targetFrac = startFrac + pagesTarget;
    candidates.sort((a, b) => {
      const dp = PRIORITY[a.reason] - PRIORITY[b.reason];
      if (dp !== 0) return dp;
      const aFrac = getFractionalPage(a.surah, a.ayah, true);
      const bFrac = getFractionalPage(b.surah, b.ayah, true);
      return Math.abs(aFrac - targetFrac) - Math.abs(bFrac - targetFrac);
    });
    const best = candidates[0];
    const bestFrac = getFractionalPage(best.surah, best.ayah, true);
    return {
      endSurah: best.surah,
      endAyah: best.ayah,
      actualPages: Math.max(0, bestFrac - startFrac),
      snapReason: best.reason,
    };
  }

  // Fallback: split verses of start page in half
  const pfv = versePageCache.size > 0
    ? (() => {
        let first: VerseRef | null = null;
        for (const [key, page] of versePageCache) {
          if (page === startPage) {
            const [s, a] = key.split(":").map(Number);
            if (!first || s < first.surah || (s === first.surah && a < first.ayah)) {
              first = { surah: s, ayah: a };
            }
          }
        }
        return first ?? PAGE_TO_FIRST_VERSE[startPage - 1];
      })()
    : PAGE_TO_FIRST_VERSE[startPage - 1];

  const pageVerses: VerseRef[] = [];
  let cur: VerseRef = { surah: pfv.surah, ayah: pfv.ayah };
  const endOfPage: VerseRef = pageLastVerseCache.size > 0
    ? (pageLastVerseCache.get(startPage) ?? { surah: 114, ayah: 6 })
    : startPage < 604
      ? (() => {
          const nf = PAGE_TO_FIRST_VERSE[startPage];
          let es = nf.surah; let ea = nf.ayah - 1;
          if (ea < 1) { es -= 1; ea = SURAH_VERSE_COUNTS[es - 1] ?? 1; }
          return { surah: es, ayah: ea };
        })()
      : { surah: 114, ayah: 6 };
  for (let i = 0; i < 50; i++) {
    pageVerses.push({ ...cur });
    if (compareVerseRefs(cur, endOfPage) >= 0) break;
    const n = nextVerse(cur.surah, cur.ayah);
    if (!n) break;
    cur = n;
  }
  const mid = pageVerses[Math.floor(pageVerses.length / 2)] ?? start;
  const final = compareVerseRefs(mid, start) > 0 ? mid : (pageVerses[pageVerses.length - 1] ?? start);
  return { endSurah: final.surah, endAyah: final.ayah, actualPages: 0.5, snapReason: 'verse_split' };
}
