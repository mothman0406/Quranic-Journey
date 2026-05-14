import { randomUUID } from "node:crypto";
import { mkdir, appendFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import express, { Router, type IRouter, type Request } from "express";

const router: IRouter = Router();
const attemptsFile = fileURLToPath(new URL("../../../recite-lab/attempts.jsonl", import.meta.url));
const audioEventsFile = fileURLToPath(
  new URL("../../../recite-lab/audio-events.jsonl", import.meta.url),
);
const audioDir = fileURLToPath(new URL("../../../recite-lab/audio/", import.meta.url));
const ATTEMPT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireJsonObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected a JSON object.");
  }
  return value as Record<string, unknown>;
}

function getAudioExtension(contentType: string | undefined) {
  const normalized = contentType?.split(";")[0]?.trim().toLowerCase();
  switch (normalized) {
    case "audio/wav":
    case "audio/wave":
    case "audio/vnd.wave":
    case "audio/x-wav":
      return ".wav";
    case "audio/mp4":
    case "audio/m4a":
    case "audio/x-m4a":
      return ".m4a";
    case "audio/aac":
      return ".aac";
    case "audio/mpeg":
      return ".mp3";
    case "audio/x-caf":
      return ".caf";
    default:
      return ".audio";
  }
}

async function appendAudioEvent(
  attemptId: string,
  payload: Record<string, unknown>,
  req: Request,
) {
  const savedAt = new Date().toISOString();
  const record = {
    id: randomUUID(),
    attemptId,
    savedAt,
    source: "noor-mobile-recite-lab",
    remoteAddress: req.ip,
    userAgent: req.get("user-agent") ?? null,
    payload,
  };

  await mkdir(dirname(audioEventsFile), { recursive: true });
  await appendFile(audioEventsFile, `${JSON.stringify(record)}\n`, "utf8");

  return record;
}

router.get("/status", (_req, res) => {
  res.json({
    ok: true,
    file: "artifacts/recite-lab/attempts.jsonl",
    audioEventsFile: "artifacts/recite-lab/audio-events.jsonl",
    audioDir: "artifacts/recite-lab/audio",
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

router.post("/attempts/:id/audio-events", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!ATTEMPT_ID_PATTERN.test(id)) {
      res.status(400).json({ ok: false, error: "Invalid attempt id." });
      return;
    }

    const payload = requireJsonObject(req.body);
    const record = await appendAudioEvent(id, payload, req);

    res.status(201).json({
      ok: true,
      id: record.id,
      attemptId: id,
      savedAt: record.savedAt,
      file: "artifacts/recite-lab/audio-events.jsonl",
    });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/attempts/:id/audio",
  express.raw({ type: ["audio/*", "application/octet-stream"], limit: "50mb" }),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!ATTEMPT_ID_PATTERN.test(id)) {
        res.status(400).json({ ok: false, error: "Invalid attempt id." });
        return;
      }

      const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body ?? []);
      if (body.length === 0) {
        res.status(400).json({ ok: false, error: "Audio body is empty." });
        return;
      }

      const contentType = req.get("content-type") ?? "application/octet-stream";
      const extension = getAudioExtension(contentType);
      const receivedAt = new Date().toISOString();
      const relativeFile = `artifacts/recite-lab/audio/${id}${extension}`;
      const filePath = join(audioDir, `${id}${extension}`);
      const metadataPath = join(audioDir, `${id}.json`);
      const metadata = {
        id,
        receivedAt,
        source: "noor-mobile-recite-lab",
        remoteAddress: req.ip,
        userAgent: req.get("user-agent") ?? null,
        contentType,
        bytes: body.length,
        file: relativeFile,
      };

      await mkdir(audioDir, { recursive: true });
      await writeFile(filePath, body);
      await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
      await appendAudioEvent(
        id,
        {
          status: "server_received",
          receivedAt,
          contentType,
          bytes: body.length,
          file: relativeFile,
        },
        req,
      );

      res.status(201).json({
        ok: true,
        id,
        receivedAt,
        file: relativeFile,
        bytes: body.length,
        contentType,
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
