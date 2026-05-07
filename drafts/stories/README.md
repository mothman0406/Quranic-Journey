# Story Draft Pipeline

This folder holds in-progress story drafts for NoorPath. Final approved stories live in `artifacts/api-server/src/data/stories.json`; drafts stay here until they are reviewed and promoted.

## Source Corpus

The primary source corpus is Arabic Tafsir Ibn Kathir from Wikisource. The full raw corpus is not committed because it is about 22 MiB. Rebuild the local cache when authoring stories:

```bash
node scripts/fetch-ibn-kathir.mjs
```

The command writes raw MediaWiki markup to `.local/corpus/ibn-kathir-ar/raw/surah-###.wiki.txt` and a manifest to `.local/corpus/ibn-kathir-ar/manifest.json`. It is idempotent: rerunning it fetches only missing surah files and skips files already present. The markup contains templates such as `{{ص}}`, headers, and section markers; AI authoring context can mostly ignore that syntax while preserving the meaning of the Arabic source text.

## Draft Files

Create one JSON draft per story:

```text
drafts/stories/{slug}.json
```

Start from `_template.json`. Drafts match the app's `StoryData` shape plus metadata:

- `reviewStatus`: `draft`, `needs-revision`, `approved`, or `approved-replace`
- `replaceStoryId`: required for `approved-replace`; identifies the existing story ID to preserve
- `aiModel`: model used to draft the story
- `generatedAt`: ISO timestamp
- `sourceVerseRanges`: candidate verse ranges and corpus files used
- `reviewNotes`: human review notes

`ageGroup` is assigned after the story is drafted by assessing the finished content. Candidate rows intentionally do not include age bands. Write the source-faithful story first, then choose `toddler`, `child`, `preteen`, or `teen` using the post-generation assessment in `_authoring-prompt.md`.

## Approval Paths

Use `reviewStatus: "approved"` for a new story. The merge script assigns the next available ID and rejects duplicate slugs.

Use `reviewStatus: "approved-replace"` with `replaceStoryId` to update an existing story. The merge script looks up the existing story by ID, preserves its `id`, replaces the other `StoryData` fields including a changed slug when needed, strips metadata, deletes the draft file, and reports it as a replacement. Set `replaceStoryId` even when the slug stays the same so replacements are explicit.

## Merge Approved Drafts

After review:

```bash
node scripts/merge-story-drafts.mjs
```

The script validates approved drafts, strips metadata, updates `stories.json`, deletes merged draft files, and reports new stories and replacements.

## Authoring Flow

1. Pick a candidate from `_candidates.md`.
2. Fetch the source corpus if needed.
3. Copy `_authoring-prompt.md` into Claude as the system prompt.
4. Paste the candidate row plus the relevant Arabic Ibn Kathir raw text.
5. Confirm the prompt's post-generation `ageGroup` assessment matches the finished story content.
6. Save the JSON output as `drafts/stories/{slug}.json`.
7. Review with `_review-checklist.md`.
8. Mark the draft `approved` or `approved-replace`.
9. Run `node scripts/merge-story-drafts.mjs`.
10. Typecheck and verify the API endpoint for the new slug.
