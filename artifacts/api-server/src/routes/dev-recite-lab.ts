import { randomUUID } from "node:crypto";
import { mkdir, appendFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { Router, type IRouter } from "express";

const router: IRouter = Router();
const attemptsFile = fileURLToPath(new URL("../../../recite-lab/attempts.jsonl", import.meta.url));

function requireJsonObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected a JSON object.");
  }
  return value as Record<string, unknown>;
}

router.get("/status", (_req, res) => {
  res.json({
    ok: true,
    file: "artifacts/recite-lab/attempts.jsonl",
  });
});

router.post("/attempts", async (req, res, next) => {
  try {
    const payload = requireJsonObject(req.body);
    const savedAt = new Date().toISOString();
    const id = randomUUID();
    const record = {
      id,
      savedAt,
      source: "noor-mobile-recite-lab",
      remoteAddress: req.ip,
      userAgent: req.get("user-agent") ?? null,
      payload,
    };

    await mkdir(dirname(attemptsFile), { recursive: true });
    await appendFile(attemptsFile, `${JSON.stringify(record)}\n`, "utf8");

    res.status(201).json({
      ok: true,
      id,
      savedAt,
      file: "artifacts/recite-lab/attempts.jsonl",
    });
  } catch (error) {
    next(error);
  }
});

export default router;
