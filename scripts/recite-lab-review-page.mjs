import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");
const LAB_DIR = path.join(ROOT_DIR, "artifacts", "recite-lab");
const ANALYSIS_DIR = path.join(LAB_DIR, "analysis");
const DATASET_FILE = path.join(ANALYSIS_DIR, "dataset.jsonl");
const REVIEW_FILE = path.join(ANALYSIS_DIR, "review.html");
const PASS_LABELS = new Set(["correct"]);
const NOT_PASS_LABELS = new Set(["skip", "repeat", "wrong"]);

function parseArgs(argv) {
  const options = {
    scope: null,
    latest: null,
    allAudio: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") {
      continue;
    } else if (arg === "--scope") {
      const value = argv[index + 1];
      if (!value) throw new Error("--scope must be followed by a scope label.");
      options.scope = value;
      index += 1;
    } else if (arg === "--latest") {
      const value = Number.parseInt(argv[index + 1] ?? "", 10);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error("--latest must be followed by a positive number.");
      }
      options.latest = value;
      index += 1;
    } else if (arg === "--all-audio") {
      options.allAudio = true;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

async function readJsonl(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`Missing dataset. Run: node scripts/analyze-recite-lab.mjs --write`);
  }
  const content = await readFile(filePath, "utf8");
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Could not parse ${path.basename(filePath)} line ${index + 1}: ${message}`);
      }
    });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function rowScope(row) {
  return row.expectedScope?.label ?? row.expectedScope?.mode ?? "unknown";
}

function expectedPassDecision(row) {
  const label = row.labels?.effective ?? "unlabeled";
  if (PASS_LABELS.has(label)) return "pass";
  if (NOT_PASS_LABELS.has(label)) return "not_pass";
  return null;
}

function predictedPassDecision(row) {
  return row.comparison?.decision === "pass" ? "pass" : "not_pass";
}

function reviewReason(row) {
  if (row.labels?.overridden) return "label override";
  const expected = expectedPassDecision(row);
  if (expected && expected !== predictedPassDecision(row)) {
    return expected === "not_pass" ? "false pass" : "false reject";
  }
  if (row.review?.missingAudio) return "missing audio";
  return "context";
}

function summarizeIssue(issue) {
  if (!issue) return "";
  const parts = [issue.type, issue.expected, issue.heard].filter(Boolean);
  return parts.join(" / ");
}

function audioSrc(row) {
  if (!row.audio?.file) return null;
  return path.relative(ANALYSIS_DIR, path.join(ROOT_DIR, row.audio.file)).replaceAll(path.sep, "/");
}

function labelCommand(row, label) {
  return `/Users/mothmanaurascape.ai/Library/pnpm/pnpm --filter @workspace/scripts run recite-lab:label -- set ${row.id.slice(
    0,
    8,
  )} ${label} "Reviewed existing audio"`;
}

function renderRow(row) {
  const src = audioSrc(row);
  const label = row.labels?.effective ?? "unlabeled";
  const rawLabel = row.labels?.raw ?? label;
  const decision = row.comparison?.decision ?? "unknown";
  const reason = reviewReason(row);
  const issue = summarizeIssue(row.comparison?.firstIssues?.[0]);
  const expectedText = (row.expectedWords ?? []).join(" ");
  const transcriptText = row.transcript ?? (row.transcriptTokens ?? []).join(" ");

  return `
    <article class="card ${escapeHtml(reason).replace(/\s+/g, "-")}">
      <header>
        <div>
          <h2>${escapeHtml(row.id.slice(0, 8))}</h2>
          <p>${escapeHtml(reason)} · ${escapeHtml(rowScope(row))}</p>
        </div>
        <span class="decision">${escapeHtml(label)} → ${escapeHtml(decision)}</span>
      </header>
      ${
        src
          ? `<audio controls preload="none" src="${escapeHtml(src)}"></audio>`
          : `<p class="no-audio">No audio uploaded for this attempt.</p>`
      }
      <dl>
        <div><dt>Raw label</dt><dd>${escapeHtml(rawLabel)}</dd></div>
        <div><dt>Window</dt><dd>${escapeHtml(row.window?.status)} ${escapeHtml(
          row.window?.acceptedCount,
        )}/${escapeHtml(row.counts?.expected)}</dd></div>
        <div><dt>Score</dt><dd>${Number.isFinite(row.comparison?.score) ? row.comparison.score.toFixed(3) : ""}</dd></div>
        <div><dt>Issue</dt><dd>${escapeHtml(issue)}</dd></div>
        <div><dt>Timing</dt><dd>${escapeHtml(row.timing?.firstResultLatencyMs)} ms first result</dd></div>
      </dl>
      <details>
        <summary>Transcript</summary>
        <p dir="rtl">${escapeHtml(transcriptText)}</p>
      </details>
      <details>
        <summary>Expected</summary>
        <p dir="rtl">${escapeHtml(expectedText)}</p>
      </details>
      <details>
        <summary>Label commands</summary>
        <pre>${escapeHtml(labelCommand(row, "correct"))}
${escapeHtml(labelCommand(row, "skip"))}
${escapeHtml(labelCommand(row, "repeat"))}
${escapeHtml(labelCommand(row, "wrong"))}
${escapeHtml(labelCommand(row, "noisy"))}</pre>
      </details>
    </article>
  `;
}

function renderHtml(rows, options) {
  const generatedAt = new Date().toISOString();
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Recite Lab Review</title>
  <style>
    :root {
      color-scheme: light;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f7f7f4;
      color: #20221f;
    }
    body {
      margin: 0;
      padding: 28px;
    }
    main {
      max-width: 1160px;
      margin: 0 auto;
    }
    h1 {
      margin: 0 0 4px;
      font-size: 28px;
    }
    .meta {
      margin: 0 0 24px;
      color: #62675e;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 14px;
    }
    .card {
      background: #ffffff;
      border: 1px solid #deded6;
      border-radius: 8px;
      padding: 14px;
    }
    .false-pass {
      border-color: #b3261e;
    }
    .false-reject {
      border-color: #b98100;
    }
    header {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: flex-start;
      margin-bottom: 12px;
    }
    h2 {
      font-size: 18px;
      margin: 0;
    }
    header p {
      margin: 3px 0 0;
      color: #62675e;
      font-size: 13px;
    }
    .decision {
      background: #eceee8;
      border-radius: 999px;
      padding: 5px 9px;
      white-space: nowrap;
      font-size: 12px;
    }
    audio {
      width: 100%;
      margin: 2px 0 12px;
    }
    dl {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      margin: 0 0 12px;
    }
    dt {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #777b73;
    }
    dd {
      margin: 2px 0 0;
      font-size: 14px;
    }
    details {
      border-top: 1px solid #eceee8;
      padding-top: 8px;
      margin-top: 8px;
    }
    summary {
      cursor: pointer;
      font-size: 13px;
      font-weight: 650;
    }
    p[dir="rtl"] {
      font-size: 18px;
      line-height: 1.9;
    }
    pre {
      overflow-x: auto;
      white-space: pre-wrap;
      background: #f1f2ed;
      border-radius: 6px;
      padding: 10px;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <main>
    <h1>Recite Lab Review</h1>
    <p class="meta">Generated ${escapeHtml(generatedAt)} · ${rows.length} rows · scope ${
      options.scope ? escapeHtml(options.scope) : "all"
    }</p>
    <section class="grid">
      ${rows.map(renderRow).join("\n")}
    </section>
  </main>
</body>
</html>
`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  let rows = await readJsonl(DATASET_FILE);
  if (options.scope) rows = rows.filter((row) => rowScope(row) === options.scope);
  if (options.latest) rows = rows.slice(-options.latest);
  rows = rows.filter((row) => row.audio?.hasAudio);
  if (!options.allAudio) {
    rows = rows.filter((row) => {
      const expected = expectedPassDecision(row);
      return row.labels?.overridden || (expected && expected !== predictedPassDecision(row));
    });
  }

  await mkdir(ANALYSIS_DIR, { recursive: true });
  await writeFile(REVIEW_FILE, renderHtml(rows, options), "utf8");
  console.log(`Wrote ${path.relative(ROOT_DIR, REVIEW_FILE)} (${rows.length} rows)`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
