# Story Review Checklist

Use this checklist before changing a draft to `reviewStatus: "approved"` or `reviewStatus: "approved-replace"`.

## Schema

- [ ] JSON is valid.
- [ ] Story matches the `StoryData` shape in `artifacts/api-server/src/data/stories.ts`.
- [ ] `storyType` is one of the four locked enum values.
- [ ] `ageGroup` is one of `toddler`, `child`, `preteen`, or `teen`.
- [ ] `prophets` uses only locked lowercase prophet IDs, ordered by prominence, or `[]` for stories without a Quran-named prophet centerpiece.
- [ ] `themes` uses 1-3 locked lowercase theme IDs.
- [ ] `relatedAyahs` is populated with correct surah and ayah ranges.
- [ ] `sources.primary` is set.

## Source Accuracy

- [ ] All Quran citations match the claimed verse range.
- [ ] All Arabic Quran citations and labels are accurate.
- [ ] Any hadith citation is verifiable with collection and number.
- [ ] No invented hadith appears in the story.
- [ ] No invented narrative detail appears beyond what the source corpus supports.
- [ ] No invented dialogue, motives, or sensory details appear unless the source supports them.
- [ ] Multiple events are distinguished rather than blended together.

## Authenticity Tier

- [ ] Is any detail in this draft flagged in the source as weak, disputed, Israeliyyat, or from non-Quranic sources?

If yes, choose one:

- [ ] Omit the detail from the final story.
- [ ] Move it to `sources.notes` with the source's caveat preserved.
- [ ] Reject the draft entirely if the disputed detail is core to the story's plot.

This is the most important theological accuracy check.

## Child Readability

- [ ] Prose is age-appropriate.
- [ ] The story avoids graphic violence.
- [ ] The story avoids complex theology beyond the age band.
- [ ] Morals are specific and genuine, not generic platitudes.
- [ ] Discussion questions are open-ended and developmentally appropriate.

## Merge Path

- [ ] Use `approved` only for a new slug.
- [ ] Use `approved-replace` only when intentionally replacing an existing story with the same slug.
- [ ] For replacements, confirm preserving the existing ID is desired.
