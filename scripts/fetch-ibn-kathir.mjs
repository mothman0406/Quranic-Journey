#!/usr/bin/env node

import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const INDEX_TITLE = "تفسير ابن كثير";
const WIKISOURCE_ORIGIN = "https://ar.wikisource.org";
const OUTPUT_ROOT = path.resolve(".local/corpus/ibn-kathir-ar");
const RAW_DIR = path.join(OUTPUT_ROOT, "raw");
const MANIFEST_PATH = path.join(OUTPUT_ROOT, "manifest.json");
const FETCH_DELAY_MS = 300;
const MAX_ATTEMPTS = 5;

const arabicDigitValues = new Map([
  ["0", 0],
  ["1", 1],
  ["2", 2],
  ["3", 3],
  ["4", 4],
  ["5", 5],
  ["6", 6],
  ["7", 7],
  ["8", 8],
  ["9", 9],
  ["٠", 0],
  ["١", 1],
  ["٢", 2],
  ["٣", 3],
  ["٤", 4],
  ["٥", 5],
  ["٦", 6],
  ["٧", 7],
  ["٨", 8],
  ["٩", 9],
]);

function pageUrl(title) {
  return `${WIKISOURCE_ORIGIN}/wiki/${encodeURIComponent(title).replaceAll("%20", "_")}`;
}

function rawUrl(title) {
  const url = new URL("/w/index.php", WIKISOURCE_ORIGIN);
  url.searchParams.set("title", title);
  url.searchParams.set("action", "raw");
  return url.toString();
}

function parseArabicNumber(value) {
  let total = 0;
  for (const char of value.trim()) {
    const digit = arabicDigitValues.get(char);
    if (digit == null) {
      throw new Error(`Cannot parse Arabic numeral ${value}`);
    }
    total = total * 10 + digit;
  }
  return total;
}

function parseSurahLinks(indexRaw) {
  const links = [];
  const pattern = /^\s*([0-9٠-٩]+)\s+\[\[(تفسير ابن كثير\/سورة [^\]|]+)\|([^\]]+)\]\]/gm;
  let match;

  while ((match = pattern.exec(indexRaw)) != null) {
    links.push({
      number: parseArabicNumber(match[1]),
      title: match[2],
      displayTitle: match[3],
    });
  }

  links.sort((a, b) => a.number - b.number);
  return links;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(url) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "NoorPathStoryCorpusFetcher/1.0",
        },
      });

      if (response.ok) {
        return response.text();
      }

      lastError = new Error(`Failed ${response.status} ${response.statusText}: ${url}`);
      if (response.status !== 429 || attempt === MAX_ATTEMPTS) {
        throw lastError;
      }

      const retryAfterSeconds = Number(response.headers.get("retry-after"));
      const retryDelayMs = Number.isFinite(retryAfterSeconds)
        ? retryAfterSeconds * 1000
        : 2500 * attempt;
      await sleep(retryDelayMs);
    } catch (error) {
      lastError = error;
      if (attempt === MAX_ATTEMPTS) {
        throw error;
      }
      await sleep(1000 * attempt);
    }
  }

  throw lastError;
}

async function fileExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error && error.code === "ENOENT") return false;
    throw error;
  }
}

async function main() {
  await mkdir(RAW_DIR, { recursive: true });

  const indexRaw = await fetchText(rawUrl(INDEX_TITLE));
  const links = parseSurahLinks(indexRaw);

  if (links.length !== 114) {
    throw new Error(`Expected 114 surah links from Wikisource index, found ${links.length}`);
  }

  let fetchedCount = 0;
  let skippedCount = 0;
  let totalBytes = 0;
  const manifest = {
    source: pageUrl(INDEX_TITLE),
    rawIndex: rawUrl(INDEX_TITLE),
    fetchedAt: new Date().toISOString(),
    note: "Files contain raw MediaWiki markup from Arabic Wikisource.",
    surahs: [],
  };

  for (const link of links) {
    const filename = `surah-${String(link.number).padStart(3, "0")}.wiki.txt`;
    const filePath = path.join(RAW_DIR, filename);

    if (!(await fileExists(filePath))) {
      const text = await fetchText(rawUrl(link.title));
      await writeFile(filePath, text, "utf8");
      fetchedCount += 1;
      await sleep(FETCH_DELAY_MS);
    } else {
      skippedCount += 1;
    }

    const text = await readFile(filePath, "utf8");
    const bytes = Buffer.byteLength(text, "utf8");
    totalBytes += bytes;
    manifest.surahs.push({
      number: link.number,
      title: link.title,
      displayTitle: link.displayTitle,
      filename,
      bytes,
      sourceUrl: pageUrl(link.title),
      rawUrl: rawUrl(link.title),
    });
  }

  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log(`Ibn Kathir Arabic corpus fetch complete`);
  console.log(`Output: ${OUTPUT_ROOT}`);
  console.log(`Surahs: ${links.length}`);
  console.log(`Fetched: ${fetchedCount}`);
  console.log(`Skipped existing: ${skippedCount}`);
  console.log(`Total raw size: ${totalBytes} bytes (${(totalBytes / 1024 / 1024).toFixed(2)} MiB)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
