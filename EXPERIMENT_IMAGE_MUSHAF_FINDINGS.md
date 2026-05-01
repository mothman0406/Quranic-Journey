# Image-based Mushaf Experiment Findings

Branch: `experiment/image-mushaf`

Date: 2026-05-01

## Summary

The current Quran.com public v4 endpoints I could reach do not expose page-image bounding boxes. They expose useful word metadata (`position`, `location`, `line_number`, QCF `code_v1`/`code_v2`, `v1_page`/`v2_page`) and ayah image slice URLs, but not `x/y/width/height` coordinates for either words or ayahs on a full page image.

Conclusion: a Tarteel-style image Mushaf with word-level taps/highlights needs a separate coordinate source. The best Quran.com-adjacent lead is the `quran/quran.com-images` generator/database schema, which has bbox tables, but the public SQL dump I inspected has those bbox tables empty and no public API endpoint serving them.

## Question 1: Word-level bounding boxes

### Tested Quran.com endpoints

| URL | Result | Shape | Bounding boxes | Coordinate system |
| --- | --- | --- | --- | --- |
| `https://api.quran.com/api/v4/quran/glyphs/page/1` | 404 HTML | None | None | None |
| `https://api.quran.com/api/v4/glyphs/by_page/1` | 404 HTML | None | None | None |
| `https://api.qurancdn.com/api/v4/quran/glyphs/page/1` | 404 HTML | None | None | None |
| `https://static.quran.com/api/v4/quran/glyphs/page/1` | 404 HTML | None | None | None |
| `https://api.quran.com/api/v4/verses/by_page/1?words=true&word_fields=text_uthmani,line_number,page_number,position,location,code_v1,code_v2,v1_page,v2_page&fields=image_url,image_width,page_number` | 200 JSON | `verses[]`, each verse has ayah metadata and `words[]` | None | None |
| `https://api.qurancdn.com/api/v4/verses/by_page/1?words=true&word_fields=text_uthmani,line_number,page_number,position,location,code_v1,code_v2,v1_page,v2_page&fields=image_url,image_width,page_number` | 200 JSON, same useful shape as `api.quran.com` | `verses[]`, each verse has ayah metadata and `words[]` | None | None |
| `https://api.quran.com/api/v4/quran/verses/code_v1?chapter_number=1` | 200 JSON | `verses[]` with `{ id, verse_key, code_v1, v1_page }` | None | None |
| `https://api.quran.com/api/v4/quran/verses/v1_image?chapter_number=1` | 200 JSON | `verses[]` with `{ id, verse_key, image_url }` | None | None |

Useful `verses/by_page` shape:

```ts
type QuranComPageResponse = {
  verses: Array<{
    id: number;
    verse_number: number;
    verse_key: string;
    page_number: number;
    image_url?: string;
    image_width?: number;
    words: Array<{
      id: number;
      position: number;
      char_type_name: "word" | "end" | string;
      text_uthmani?: string;
      line_number: number;
      location: string; // e.g. surah:ayah:word
      code_v1?: string;
      code_v2?: string;
      v1_page?: number;
      v2_page?: number;
      page_number: number;
    }>;
  }>;
  pagination: {
    per_page: number;
    current_page: number;
    next_page: number | null;
    total_pages: number;
    total_records: number;
  };
};
```

The Quran.com docs confirm the public word fields are page/line/glyph/text style fields, not bounding boxes: `page_number`, `line_number`, `location`, `code_v1`, `code_v2`, `v1_page`, and `v2_page`.

### Quran.com repo alternatives

`quran/quran.com-images` is relevant. Its README says it generates Quran page images based on old Madani fonts from the King Fahd Quran Complex and updates a database with glyph bounds for highlighting words or verses.

The schema has bbox tables:

- `glyph_ayah_bbox`: `glyph_ayah_id`, `img_width`, `min_x`, `max_x`, `min_y`, `max_y`
- `glyph_page_line_bbox`: `glyph_page_line_id`, `img_width`, `min_x`, `max_x`, `min_y`, `max_y`

However, the public `sql/02-database.sql` dump I downloaded has empty bbox table dumps. It includes `glyph`, `glyph_ayah`, `glyph_page_line`, and `word` rows, but not populated bbox rows. That means it can be a generator path, not an immediately consumable public coordinate dataset.

Third-party lead: `qurancoor` advertises generating page coordinates from mushaf images plus `quran.com-images`. This may be worth testing only if we decide to build/own a coordinate dataset.

## Question 2: Page image source

Source file: `artifacts/noor-mobile/src/lib/mushaf.ts`

```ts
export function mushafPageUrl(page: number): string {
  const padded = String(page).padStart(3, "0");
  return `https://raw.githubusercontent.com/GovarJabbar/Quran-PNG/master/${padded}.png`;
}
```

Page 1 URL:

`https://raw.githubusercontent.com/GovarJabbar/Quran-PNG/master/001.png`

Inspected native dimensions:

- `2600 x 4206`
- PNG, 4-bit colormap, interlaced
- page 1 response `content-length`: `106592`

Higher-resolution variants:

- The GitHub repo root exposes one numbered PNG set (`000.png` through `604.png`) plus demo/index files.
- I did not find alternate density folders or a documented higher-resolution variant in this repo.
- The repo index links separate downloads for page-by-page JPG and one-line/two-line assets, but not a higher-res page PNG variant.
- `quran/quran.com-images` can generate images at a requested width, but that is a different source pipeline.

Canonical source note:

- The current app source is `GovarJabbar/Quran-PNG`, not a Quran.com or King Fahd Complex endpoint.
- Visually, page 1 matches a Madani page-by-page Mushaf layout.
- Provenance is not documented in `mushaf.ts` or the repo index I inspected. For production, we should either verify the GovarJabbar asset provenance/licensing or switch to a Quran.com/King Fahd-derived image pipeline that matches the coordinate source.

## Question 3: Animation feasibility prototype

Added:

`artifacts/noor-mobile/app/experimental/mushaf-image-prototype.tsx`

Prototype behavior:

- Loads page 1 with `mushafPageUrl(1)`.
- Uses the measured native page size (`2600 x 4206`) to scale a hardcoded ayah rectangle.
- Renders an absolute `Animated.View` overlay with semi-transparent yellow fill.
- Loops opacity over 2 seconds with `useNativeDriver: true`.
- Includes the label `Image-based Mushaf prototype` and a `Tap to seek` affordance.

Access on hardware:

- Open a child profile.
- Go to `More`.
- Tap the temporary red `[EXPERIMENTAL] Image Mushaf` button.
- The route is also available at `/experimental/mushaf-image-prototype`. It is intentionally not added to any layout stack; the More button is a temporary debug entry and should be removed before merging this experiment back to main.

## Recommendation

Do not start a full image-based memorization slice until the coordinate source is chosen. The public Quran.com API is enough for text/glyph rendering and line-aware layout, but not for image-page hit testing. If we want exact word-level interactivity, the next slice should prove one of these paths:

1. Generate our own coordinates from the exact page image set we will ship.
2. Use `quran/quran.com-images` as both image and bbox generation source, then export a compact JSON dataset.
3. Find a maintained public coordinate dataset and verify it aligns pixel-perfectly with the image source.
