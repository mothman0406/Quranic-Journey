#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const pageCount = 604;
const imageWidth = 1920;
const imageHeight = 3106;
const assetDir = path.join(
  repoRoot,
  "artifacts/noor-mobile/assets/mushaf-pages/quran-com-1405",
);
const dbPath = path.join(assetDir, "ayahinfo_1920.db");
const coordsPath = path.join(assetDir, "ayahinfo_1920.json");
const pageImagesPath = path.join(
  repoRoot,
  "artifacts/noor-mobile/src/lib/quran-com-1405-page-images.ts",
);

function readSqlJson(query) {
  const output = execFileSync("sqlite3", ["-json", dbPath, query], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(output || "[]");
}

function assertInputFiles() {
  if (!existsSync(dbPath)) {
    throw new Error(`Missing SQLite database: ${dbPath}`);
  }

  const pages = readdirSync(assetDir).filter((file) => /^page\d{3}\.png$/.test(file));
  if (pages.length !== pageCount) {
    throw new Error(`Expected ${pageCount} page PNGs, found ${pages.length}`);
  }
}

function getTables() {
  const rows = readSqlJson("select name from sqlite_master where type = 'table' order by name");
  return new Set(rows.map((row) => row.name));
}

function buildCoordinateJson() {
  const tables = getTables();
  if (!tables.has("glyphs")) {
    throw new Error("Expected glyphs table in ayahinfo_1920.db");
  }

  const glyphRows = readSqlJson(`
    select
      page_number as page,
      glyph_id as glyphId,
      line_number as line,
      sura_number as surah,
      ayah_number as ayah,
      position,
      min_x as minX,
      max_x as maxX,
      min_y as minY,
      max_y as maxY
    from glyphs
    order by page_number, line_number, min_y, min_x
  `);

  const pages = {};
  const rectsByKey = new Map();

  for (let page = 1; page <= pageCount; page += 1) {
    pages[String(page)] = {
      glyphs: [],
      ayahRects: [],
      suraHeaders: [],
      ayahMarkers: [],
    };
  }

  for (const row of glyphRows) {
    const page = pages[String(row.page)];
    page.glyphs.push([
      row.glyphId,
      row.line,
      row.surah,
      row.ayah,
      row.position,
      row.minX,
      row.maxX,
      row.minY,
      row.maxY,
    ]);

    const key = `${row.page}:${row.surah}:${row.ayah}:${row.line}`;
    const existing = rectsByKey.get(key);
    if (existing) {
      existing[3] = Math.min(existing[3], row.minX);
      existing[4] = Math.max(existing[4], row.maxX);
      existing[5] = Math.min(existing[5], row.minY);
      existing[6] = Math.max(existing[6], row.maxY);
      existing[7] += 1;
    } else {
      const rect = [
        row.surah,
        row.ayah,
        row.line,
        row.minX,
        row.maxX,
        row.minY,
        row.maxY,
        1,
      ];
      rectsByKey.set(key, rect);
      pages[String(row.page)].ayahRects.push(rect);
    }
  }

  for (const page of Object.values(pages)) {
    page.glyphs.sort((a, b) => a[1] - b[1] || a[7] - b[7] || b[6] - a[6]);
    page.ayahRects.sort((a, b) => a[2] - b[2] || a[5] - b[5] || b[4] - a[4]);
  }

  if (tables.has("sura_headers")) {
    const rows = readSqlJson(`
      select
        page_number as page,
        sura_number as surah,
        x,
        y,
        width,
        height
      from sura_headers
      order by page_number, y, x
    `);
    for (const row of rows) {
      pages[String(row.page)].suraHeaders.push([
        row.surah,
        row.x,
        row.y,
        row.width,
        row.height,
      ]);
    }
  }

  if (tables.has("ayah_markers")) {
    const rows = readSqlJson(`
      select
        page_number as page,
        sura_number as surah,
        ayah_number as ayah,
        x,
        y
      from ayah_markers
      order by page_number, y, x
    `);
    for (const row of rows) {
      pages[String(row.page)].ayahMarkers.push([
        row.surah,
        row.ayah,
        row.x,
        row.y,
      ]);
    }
  }

  return {
    metadata: {
      source: "quran/quran-ios Example/QuranEngineApp/Resources/hafs_1405/images_1920",
      edition: "hafs_1405",
      pageCount,
      imageWidth,
      imageHeight,
      coordinateSpace: "pixel",
      glyphTuple: [
        "glyphId",
        "line",
        "surah",
        "ayah",
        "position",
        "minX",
        "maxX",
        "minY",
        "maxY",
      ],
      ayahRectTuple: [
        "surah",
        "ayah",
        "line",
        "minX",
        "maxX",
        "minY",
        "maxY",
        "glyphCount",
      ],
      suraHeaderTuple: ["surah", "x", "y", "width", "height"],
      ayahMarkerTuple: ["surah", "ayah", "x", "y"],
      sourceTables: {
        glyphs: tables.has("glyphs"),
        suraHeaders: tables.has("sura_headers"),
        ayahMarkers: tables.has("ayah_markers"),
      },
    },
    pages,
  };
}

function buildPageImagesFile() {
  const lines = [
    "// AUTOGENERATED static require map for Quran.com hafs_1405 1920px page images.",
    "// Required because React Native Metro cannot resolve dynamic require() at runtime.",
    "",
    "const PAGE_IMAGES: Record<number, number> = {",
  ];

  for (let page = 1; page <= pageCount; page += 1) {
    const file = `page${String(page).padStart(3, "0")}.png`;
    lines.push(`  ${page}: require("../../assets/mushaf-pages/quran-com-1405/${file}"),`);
  }

  lines.push(
    "};",
    "",
    "export function getQuranCom1405PageImage(pageNumber: number) {",
    "  return PAGE_IMAGES[pageNumber] ?? null;",
    "}",
    "",
    "export const TOTAL_QURAN_COM_1405_PAGES = 604;",
    "export const QURAN_COM_1405_PAGE_WIDTH = 1920;",
    "export const QURAN_COM_1405_PAGE_HEIGHT = 3106;",
    "",
  );

  return `${lines.join("\n")}`;
}

assertInputFiles();
const coordinateJson = buildCoordinateJson();
writeFileSync(coordsPath, JSON.stringify(coordinateJson));
writeFileSync(pageImagesPath, buildPageImagesFile());

const glyphCount = Object.values(coordinateJson.pages).reduce(
  (sum, page) => sum + page.glyphs.length,
  0,
);
const rectCount = Object.values(coordinateJson.pages).reduce(
  (sum, page) => sum + page.ayahRects.length,
  0,
);

console.log(`Wrote ${path.relative(repoRoot, coordsPath)} (${glyphCount} glyphs, ${rectCount} ayah rects)`);
console.log(`Wrote ${path.relative(repoRoot, pageImagesPath)}`);
