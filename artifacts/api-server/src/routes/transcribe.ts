import { Router, type IRouter } from "express";

const router: IRouter = Router();

// Accept raw audio body and proxy to HuggingFace Whisper endpoint.
// express.raw() is applied per-route so it doesn't affect other routes.
router.post(
  "/transcribe",
  (req, res, next) => {
    // Parse raw binary body for audio/* content types
    const contentType = req.headers["content-type"] ?? "";
    if (contentType.startsWith("audio/")) {
      let chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => {
        (req as any).rawBody = Buffer.concat(chunks);
        next();
      });
      req.on("error", next);
    } else {
      next();
    }
  },
  async (req, res) => {
    const apiKey = process.env.HUGGINGFACE_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: "HUGGINGFACE_API_KEY not configured" });
      return;
    }

    const body: Buffer | undefined = (req as any).rawBody;
    if (!body || body.length === 0) {
      res.status(400).json({ error: "Empty audio body" });
      return;
    }

    try {
      const hfRes = await fetch(
        "https://api-inference.huggingface.co/models/tarteel-ai/whisper-base-ar-quran",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": req.headers["content-type"] ?? "audio/wav",
          },
          body,
        }
      );

      const rawText = await hfRes.text();
      console.log("HuggingFace status:", hfRes.status);
      console.log("HuggingFace response:", rawText);
      res.status(hfRes.status).send(rawText);
    } catch (err) {
      console.error("HuggingFace proxy error:", err);
      res.status(502).json({ error: "Upstream transcription request failed" });
    }
  }
);

export default router;
