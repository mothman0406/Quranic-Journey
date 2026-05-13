import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");
const ANALYSIS_DIR = path.join(ROOT_DIR, "artifacts", "recite-lab", "analysis");
const DATASET_FILE = path.join(ANALYSIS_DIR, "dataset.jsonl");
const DEFAULT_SCOPES = ["1:1-7", "66:1-7"];

function parseArgs(argv) {
  const options = {
    audioOnly: true,
    scopes: [],
    skipAcoustic: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") {
      continue;
    } else if (arg === "--all-rows") {
      options.audioOnly = false;
    } else if (arg === "--scope") {
      const value = argv[index + 1];
      if (!value) throw new Error("--scope must be followed by a scope label.");
      options.scopes.push(value);
      index += 1;
    } else if (arg === "--skip-acoustic") {
      options.skipAcoustic = true;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function runNode(script, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: ROOT_DIR,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${script} exited with code ${code}`));
    });
  });
}

async function readJsonl(filePath) {
  if (!existsSync(filePath)) return [];
  const content = await readFile(filePath, "utf8");
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function inferScopes(options) {
  if (options.scopes.length > 0) return options.scopes;
  const rows = await readJsonl(DATASET_FILE);
  const scopes = new Set(
    rows
      .filter((row) => !options.audioOnly || row.audio?.hasAudio)
      .map((row) => row.expectedScope?.label ?? row.expectedScope?.mode)
      .filter(Boolean),
  );
  const preferred = DEFAULT_SCOPES.filter((scope) => scopes.has(scope));
  return preferred.length > 0 ? preferred : [...scopes].sort().slice(0, 4);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const reportArgs = options.audioOnly ? ["--audio-only"] : [];

  console.log("Refreshing Recite Lab analysis...");
  await runNode("scripts/analyze-recite-lab.mjs", ["--write"]);

  console.log("");
  console.log("Writing reports...");
  await runNode("scripts/recite-lab-report.mjs", ["--write"]);
  await runNode("scripts/recite-lab-report.mjs", [...reportArgs, "--write"]);
  await runNode("scripts/recite-lab-policy-sim.mjs", [...reportArgs, "--write"]);

  const scopes = await inferScopes(options);
  for (const scope of scopes) {
    console.log("");
    console.log(`Refreshing scope ${scope}...`);
    await runNode("scripts/recite-lab-report.mjs", ["--scope", scope, ...reportArgs, "--write"]);
    await runNode("scripts/recite-lab-policy-sim.mjs", ["--scope", scope, ...reportArgs, "--write"]);
    if (!options.skipAcoustic) {
      await runNode("scripts/recite-lab-window-acoustic-rescue.mjs", ["--scope", scope, "--write"]);
    }
  }

  console.log("");
  console.log("Done. Main outputs:");
  console.log(`- ${path.relative(ROOT_DIR, path.join(ANALYSIS_DIR, "report-audio-only.md"))}`);
  console.log(`- ${path.relative(ROOT_DIR, path.join(ANALYSIS_DIR, "policy-sim-audio-only.md"))}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
