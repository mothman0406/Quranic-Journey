import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");
const LAB_DIR = path.join(ROOT_DIR, "artifacts", "recite-lab");
const ATTEMPTS_FILE = path.join(LAB_DIR, "attempts.jsonl");
const OVERRIDES_FILE = path.join(LAB_DIR, "label-overrides.json");
const DATASET_FILE = path.join(LAB_DIR, "analysis", "dataset.jsonl");
const LABELS = new Set(["correct", "skip", "repeat", "wrong", "noisy"]);

function usage() {
  return [
    "Usage:",
    "  node scripts/recite-lab-label.mjs review [--latest N]",
    "  node scripts/recite-lab-label.mjs set <attempt-id-prefix> <label> [reason...]",
    "  node scripts/recite-lab-label.mjs unset <attempt-id-prefix>",
    "",
    "Labels: correct, skip, repeat, wrong, noisy",
  ].join("\n");
}

async function readJsonl(filePath) {
  if (!existsSync(filePath)) return [];
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

async function readOverrides() {
  if (!existsSync(OVERRIDES_FILE)) {
    return {
      version: 1,
      notes:
        "Local Recite Lab label corrections. This file is intentionally ignored by git and does not rewrite raw attempts.jsonl.",
      overrides: {},
    };
  }
  const parsed = JSON.parse(await readFile(OVERRIDES_FILE, "utf8"));
  return {
    version: parsed.version ?? 1,
    notes:
      parsed.notes ??
      "Local Recite Lab label corrections. This file is intentionally ignored by git and does not rewrite raw attempts.jsonl.",
    overrides: parsed.overrides && typeof parsed.overrides === "object" ? parsed.overrides : {},
  };
}

async function writeOverrides(overrides) {
  await writeFile(OVERRIDES_FILE, `${JSON.stringify(overrides, null, 2)}\n`, "utf8");
}

async function resolveAttemptId(prefix) {
  const attempts = await readJsonl(ATTEMPTS_FILE);
  const matches = attempts.filter((attempt) => attempt.id?.startsWith(prefix));
  if (matches.length === 0) {
    throw new Error(`No attempt id starts with ${prefix}.`);
  }
  if (matches.length > 1) {
    throw new Error(
      `Attempt prefix ${prefix} is ambiguous: ${matches
        .slice(0, 8)
        .map((attempt) => attempt.id.slice(0, 8))
        .join(", ")}`,
    );
  }
  return matches[0].id;
}

function expectedDecision(label) {
  if (label === "correct") return "pass";
  if (label === "skip" || label === "repeat" || label === "wrong") return label;
  return null;
}

function summarizeIssue(issue) {
  if (!issue) return "";
  return `${issue.type ?? ""} ${issue.expected ?? ""}/${issue.heard ?? ""}`.trim();
}

function formatReviewRow(row) {
  const label = row.labels?.effective ?? "unlabeled";
  const raw = row.labels?.raw ?? "unlabeled";
  const decision = row.comparison?.decision ?? "unknown";
  const expected = expectedDecision(label);
  const mismatch = expected && expected !== decision;
  const overridden = row.labels?.overridden ? `${raw}->${label}` : label;
  const issue = summarizeIssue(row.comparison?.firstIssues?.[0]);
  return [
    row.id.slice(0, 8),
    mismatch ? "mismatch" : "ok",
    overridden,
    decision,
    row.expectedScope?.label ?? row.expectedScope?.mode ?? "unknown",
    `${row.window?.acceptedCount ?? "?"}/${row.counts?.expected ?? "?"}`,
    row.window?.status ?? "unknown",
    issue,
  ].join("  ");
}

function parseLatest(args) {
  const index = args.indexOf("--latest");
  if (index === -1) return null;
  const value = Number.parseInt(args[index + 1] ?? "", 10);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("--latest must be followed by a positive number.");
  }
  return value;
}

async function review(args) {
  const latest = parseLatest(args);
  const rows = await readJsonl(DATASET_FILE);
  const selected = latest ? rows.slice(-latest) : rows;
  const reviewRows = selected.filter((row) => {
    const label = row.labels?.effective ?? "unlabeled";
    const expected = expectedDecision(label);
    return row.labels?.overridden || (expected && expected !== row.comparison?.decision);
  });

  console.log("ID        status    label       decision  scope      progress  window       issue");
  for (const row of reviewRows.slice(-30)) console.log(formatReviewRow(row));
  if (reviewRows.length === 0) console.log("No label/decision mismatches in the selected rows.");
}

async function setOverride(args) {
  const [prefix, label, ...reasonParts] = args;
  if (!prefix || !label) throw new Error(usage());
  if (!LABELS.has(label)) throw new Error(`Invalid label: ${label}. ${usage()}`);
  const id = await resolveAttemptId(prefix);
  const overrides = await readOverrides();
  const reason =
    reasonParts.join(" ").trim() ||
    `Manual Recite Lab correction set via scripts/recite-lab-label.mjs.`;
  overrides.overrides[id] = {
    label,
    reason,
    updatedAt: new Date().toISOString(),
  };
  await writeOverrides(overrides);
  console.log(`Set ${id.slice(0, 8)} -> ${label}`);
  console.log("Run: node scripts/analyze-recite-lab.mjs --write");
}

async function unsetOverride(args) {
  const [prefix] = args;
  if (!prefix) throw new Error(usage());
  const id = await resolveAttemptId(prefix);
  const overrides = await readOverrides();
  if (!overrides.overrides[id]) {
    console.log(`No override exists for ${id.slice(0, 8)}.`);
    return;
  }
  delete overrides.overrides[id];
  await writeOverrides(overrides);
  console.log(`Removed override for ${id.slice(0, 8)}`);
  console.log("Run: node scripts/analyze-recite-lab.mjs --write");
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === "--help" || command === "-h") {
    console.log(usage());
    return;
  }

  if (command === "review") {
    await review(args);
  } else if (command === "set") {
    await setOverride(args);
  } else if (command === "unset") {
    await unsetOverride(args);
  } else {
    throw new Error(usage());
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
