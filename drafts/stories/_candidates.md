# NoorPath Story Candidates — Master Plan

This is the locked candidates list for the bulk story authoring campaign opened by kk.ag.c.

Status legend:
- `shipped` — already in stories.json
- `replace` — existing story to be replaced via approved-replace
- `new` — to be authored

Age band is intentionally omitted; assigned post-hoc per kk.ag.b principle.

`previousStoryId` is the intended prior story relationship. Existing IDs are written when already known; unresolved new-story links are resolved at author/merge time after the prior story has a stable ID.

`replaceStoryId` is draft metadata for `approved-replace` only. It is stripped by the merge script and never written to final story JSON.

## Already shipped (10 stories)

| id | slug | type | previousStoryId |
|----|------|------|-----------------|
| 1 | the-elephant-army | quranic_narrative | null |
| 2 | ibrahim-and-the-fire | quranic_narrative | pending id for ibrahim-debates-the-king |
| 3 | musa-and-the-baby-basket | quranic_narrative | null |
| 4 | the-cave-of-thawr | seerah_context | pending id for migration-to-abyssinia |
| 5 | bilal-and-the-hot-desert | seerah_context (TO BE REPLACED — expand with Sumayya) | null |
| 6 | yusuf-and-the-brothers | quranic_narrative (TO BE REPLACED — split into 5) | null |
| 7 | the-ant-and-prophet-sulayman | quranic_narrative | pending id for sulayman-and-the-jinn |
| 8 | khadijah-the-first-believer | seerah_context | null |
| 9 | battle-of-badr-help | seerah_context | null |
| 10 | people-of-the-cave | quranic_narrative | null |

## Adam arc (3 new)

| status | slug | type | verses | previousStoryId |
|--------|------|------|--------|-----------------|
| new | adam-creation-and-prostration | quranic_narrative | 2:30-39, 7:11-25, 15:26-44, 38:71-85 | null |
| new | adam-and-the-tree | quranic_narrative | 2:35-37, 7:19-25, 20:115-123 | id of adam-creation-and-prostration |
| new | sons-of-adam-qabil-and-habil | quranic_narrative | 5:27-31 | id of adam-and-the-tree |

## Nuh (1 new)

| status | slug | type | verses | previousStoryId |
|--------|------|------|--------|-----------------|
| new | nuh-and-the-ark | quranic_narrative | 11:25-49, 71:1-28, 7:59-64 | null |

## Hud, Salih, Shuaib (3 new)

| status | slug | type | verses | previousStoryId |
|--------|------|------|--------|-----------------|
| new | hud-and-the-people-of-ad | quranic_narrative | 7:65-72, 11:50-60, 46:21-26 | null |
| new | salih-and-the-she-camel | quranic_narrative | 7:73-79, 11:61-68, 26:141-159 | null |
| new | shuaib-and-the-people-of-madyan | quranic_narrative | 7:85-93, 11:84-95, 26:176-191 | null |

## Ibrahim arc (7 new — joins existing ibrahim-and-the-fire)

| status | slug | type | verses | previousStoryId |
|--------|------|------|--------|-----------------|
| new | ibrahim-questions-the-stars | quranic_narrative | 6:74-79 | null |
| new | ibrahim-debates-the-king | quranic_narrative | 2:258 | id of ibrahim-questions-the-stars |
| shipped | ibrahim-and-the-fire | quranic_narrative | 21:51-70, 37:83-98 | id of ibrahim-debates-the-king |
| new | ibrahim-three-angel-guests | quranic_narrative | 11:69-73, 51:24-30 | 2 |
| new | ibrahim-leaves-hajar-and-ismail | quranic_narrative | 14:37 | id of ibrahim-three-angel-guests |
| new | ibrahim-and-the-sacrifice | quranic_narrative | 37:99-113 | id of ibrahim-leaves-hajar-and-ismail |
| new | ibrahim-builds-the-kabah | quranic_narrative | 2:125-129, 14:35-41, 22:26-29 | id of ibrahim-and-the-sacrifice |
| new | ibrahim-and-the-birds | quranic_narrative | 2:260 | id of ibrahim-builds-the-kabah |

## Lut (1 new)

| status | slug | type | verses | previousStoryId |
|--------|------|------|--------|-----------------|
| new | people-of-lut | quranic_narrative | 7:80-84, 11:77-83, 26:160-175, 27:54-58 | null |

## Yusuf split (5 stories replacing 1 existing)

| status | slug | type | verses | previousStoryId | replaceStoryId |
|--------|------|------|--------|-----------------|----------------|
| replace | yusuf-the-dream-and-the-brothers | quranic_narrative | 12:4-20 | null | 6 |
| new | yusuf-in-egypt-and-the-trial | quranic_narrative | 12:21-35 | 6 | null |
| new | yusuf-in-prison-and-the-dreams | quranic_narrative | 12:36-49 | id of yusuf-in-egypt-and-the-trial | null |
| new | yusuf-meets-his-brothers-again | quranic_narrative | 12:58-93 | id of yusuf-in-prison-and-the-dreams | null |
| new | yusuf-reunion-with-yaqub | quranic_narrative | 12:93-101 | id of yusuf-meets-his-brothers-again | null |

## Musa arc (8 new — joins existing musa-and-the-baby-basket)

| status | slug | type | verses | previousStoryId |
|--------|------|------|--------|-----------------|
| shipped | musa-and-the-baby-basket | quranic_narrative | 28:7-13, 20:38-40 | null |
| new | musa-flees-egypt | quranic_narrative | 28:14-28 | 3 |
| new | musa-burning-bush | quranic_narrative | 20:9-36, 28:29-35 | id of musa-flees-egypt |
| new | musa-confronts-pharaoh | quranic_narrative | 20:42-71, 26:10-51 | id of musa-burning-bush |
| new | musa-plagues-of-egypt | quranic_narrative | 7:130-137 | id of musa-confronts-pharaoh |
| new | musa-splitting-the-sea | quranic_narrative | 26:52-68, 20:77-79 | id of musa-plagues-of-egypt |
| new | musa-and-the-golden-calf | quranic_narrative | 7:148-156, 20:83-98 | id of musa-splitting-the-sea |
| new | musa-and-the-cow | quranic_narrative | 2:67-74 | id of musa-and-the-golden-calf |
| new | musa-and-khidr | quranic_narrative | 18:60-82 | id of musa-and-the-cow |

## Harun (1 new)

| status | slug | type | verses | previousStoryId |
|--------|------|------|--------|-----------------|
| new | harun-the-helper | companion_profile | 20:25-36, 20:90-94 | null |

## Dawud and Sulayman (4 new — joins existing the-ant-and-prophet-sulayman)

| status | slug | type | verses | previousStoryId |
|--------|------|------|--------|-----------------|
| new | dawud-defeats-jalut | quranic_narrative | 2:246-251 | null |
| new | dawud-the-two-disputants | quranic_narrative | 38:21-26 | id of dawud-defeats-jalut |
| new | sulayman-and-the-jinn | quranic_narrative | 27:15-19, 34:12-14, 38:30-40 | null |
| shipped | the-ant-and-prophet-sulayman | quranic_narrative | 27:18-19 | id of sulayman-and-the-jinn |
| new | sulayman-and-the-queen-of-sheba | quranic_narrative | 27:20-44 | 7 |

## Ayyub (1 new)

| status | slug | type | verses | previousStoryId |
|--------|------|------|--------|-----------------|
| new | ayyub-and-patience | quranic_narrative | 21:83-84, 38:41-44 | null |

## Yunus (1 new)

| status | slug | type | verses | previousStoryId |
|--------|------|------|--------|-----------------|
| new | yunus-and-the-whale | quranic_narrative | 21:87-88, 37:139-148, 10:98 | null |

## Zakariya, Yahya, Maryam, Isa (5 new)

| status | slug | type | verses | previousStoryId |
|--------|------|------|--------|-----------------|
| new | zakariya-prays-for-a-son | quranic_narrative | 19:2-15, 3:37-41 | null |
| new | yahya-the-prophet | quranic_narrative | 19:12-15, 3:39 | id of zakariya-prays-for-a-son |
| new | maryam-the-righteous | quranic_narrative | 3:35-37, 19:16-22 | null |
| new | birth-of-isa | quranic_narrative | 19:16-34, 3:42-49 | id of maryam-the-righteous |
| new | isas-mission | quranic_narrative | 3:49-55, 5:110-115 | id of birth-of-isa |

## Brief-mention prophets (3 new — short stories, may merge if too thin)

| status | slug | type | verses | previousStoryId |
|--------|------|------|--------|-----------------|
| new | idris-and-his-rank | quranic_narrative | 19:56-57, 21:85-86 | null |
| new | ilyas-against-baal | quranic_narrative | 37:123-132 | null |
| new | dhul-kifl-and-al-yasa | quranic_narrative | 21:85-86, 38:48 | null |

If either Dhul-Kifl or Al-Yasa has too little material to stand alone, combine them into one stub story. Idris likewise.

## Quranic narratives without single prophet centerpiece (8 new)

| status | slug | type | verses | previousStoryId |
|--------|------|------|--------|-----------------|
| new | dhul-qarnayn | quranic_narrative | 18:83-98 | null |
| new | the-man-with-two-gardens | moral_lesson | 18:32-44 | null |
| new | owners-of-the-garden | moral_lesson | 68:17-33 | null |
| new | the-people-of-the-ditch | moral_lesson | 85:4-9 | null |
| new | qarun-and-his-treasures | moral_lesson | 28:76-82 | null |
| new | the-believer-from-pharaohs-family | moral_lesson | 40:28-45 | null |
| new | pharaohs-magicians-believe | quranic_narrative | 7:113-126, 26:38-51 | null |
| new | luqmans-advice | moral_lesson | 31:12-19 | null |

## Notable women (4 new)

| status | slug | type | verses | previousStoryId |
|--------|------|------|--------|-----------------|
| new | asiyah-pharaohs-believing-wife | companion_profile | 66:11, 28:9 | null |
| new | the-wife-of-imran | quranic_narrative | 3:35-37 | null |
| new | the-wives-of-nuh-and-lut | moral_lesson | 66:10 | null |
| new | umm-sulaim-and-her-test | companion_profile | sahih sources | null |

## Concepts via narrative (3 new)

| status | slug | type | verses | previousStoryId |
|--------|------|------|--------|-----------------|
| new | the-night-of-power | quranic_narrative | 97:1-5 | null |
| new | the-spider-and-allahs-similitude | moral_lesson | 29:41 | null |
| new | the-mountains-and-trust | moral_lesson | 33:72 | null |

## Isra and Miraj (1 new)

| status | slug | type | verses | previousStoryId |
|--------|------|------|--------|-----------------|
| new | isra-and-miraj | seerah_context | 17:1, 53:1-18 | null |

## Seerah events (12 new — joins existing the-cave-of-thawr, khadijah-the-first-believer, battle-of-badr-help)

| status | slug | type | verses | previousStoryId | replaceStoryId |
|--------|------|------|--------|-----------------|----------------|
| shipped | khadijah-the-first-believer | seerah_context | 96:1-5 | null | null |
| new | first-revelation-cave-of-hira | seerah_context | 96:1-5 | null | null |
| replace | bilal-and-the-hot-desert | seerah_context | 16:106 plus sahih Sumayya/Bilal reports | null | 5 |
| new | migration-to-abyssinia | seerah_context | 16:41-42 | 5 | null |
| shipped | the-cave-of-thawr | seerah_context | 9:40 | id of migration-to-abyssinia | null |
| new | change-of-qiblah | seerah_context | 2:142-150 | null | null |
| shipped | battle-of-badr-help | seerah_context | 8:9-12, 3:123-127 | null | null |
| new | battle-of-uhud | seerah_context | 3:121-129, 3:152-155 | 9 | null |
| new | battle-of-the-trench | seerah_context | 33:9-27 | id of battle-of-uhud | null |
| new | treaty-of-hudaybiyyah | seerah_context | 48:1-29 | id of battle-of-the-trench | null |
| new | conquest-of-makkah | seerah_context | 48:1-3, 110:1-3 | id of treaty-of-hudaybiyyah | null |
| new | battle-of-tabuk | seerah_context | 9:38-99 | id of conquest-of-makkah | null |
| new | three-who-stayed-behind | seerah_context | 9:118 | id of battle-of-tabuk | null |
| new | slander-of-aisha | seerah_context | 24:11-26 | null | null |
| new | farewell-pilgrimage | seerah_context | 5:3 | id of conquest-of-makkah | null |

## Caliphs (5 new — joins existing the-cave-of-thawr arc)

| status | slug | type | verses | previousStoryId |
|--------|------|------|--------|-----------------|
| new | abu-bakr-as-siddiq | companion_profile | 9:40, 92:5-7 | null |
| new | umar-becomes-muslim | companion_profile | 20:1-8 | null |
| new | umar-the-just-caliph | companion_profile | sahih sources | id of umar-becomes-muslim |
| new | uthman-of-the-two-lights | companion_profile | 9:117 | null |
| new | ali-the-young-believer | companion_profile | 5:55-56, 9:40 | null |

## Other companions (6 new)

| status | slug | type | verses | previousStoryId |
|--------|------|------|--------|-----------------|
| new | musab-ibn-umair | companion_profile | referenced via 33:23 | null |
| new | hamza-the-lion | companion_profile | sahih sources | null |
| new | khalid-ibn-al-walid-the-sword | companion_profile | sahih sources | null |
| new | salman-al-farsi | companion_profile | referenced via 24:55 | null |
| new | asma-bint-abi-bakr-of-the-two-belts | companion_profile | 9:40 | 4 |
| new | the-ansar-share-with-the-muhajirun | seerah_context | 59:9 | id of conquest-of-makkah |

## Total breakdown

- Already shipped: 10
- To be authored as new: about 78
- To be replaced via approved-replace: 2 (Yusuf single-story -> 5 stories; Bilal story expanded with Sumayya)
- Existing stories getting `previousStoryId` set via approved-replace: 4 (ibrahim-and-the-fire, musa-and-the-baby-basket where needed, the-ant-and-prophet-sulayman, the-cave-of-thawr)

Grand total library: about 89 stories.
