import { Router } from "express";

// Server-side proxy to Sarvam AI translation so the API key never reaches the
// browser. Results are cached in-memory per (text, target) so repeated UI
// toggles don't re-hit the API. Translation errors are surfaced to the client;
// silently returning English makes a Hindi toggle look successful when it is not.

export const translateRouter = Router();

const SARVAM_URL = "https://api.sarvam.ai/translate";
const cache = new Map<string, string>();

async function translateOne(text: string, target: string): Promise<string> {
  const key = `${target}::${text}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) throw new Error("SARVAM_API_KEY is not configured");

  const resp = await fetch(SARVAM_URL, {
    method: "POST",
    headers: { "api-subscription-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      input: text,
      source_language_code: "en-IN",
      target_language_code: target,
    }),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    throw new Error(`Sarvam returned ${resp.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
  }
  const data = (await resp.json()) as { translated_text?: string };
  if (typeof data.translated_text !== "string" || !data.translated_text.trim()) {
    throw new Error("Sarvam returned no translated_text");
  }
  const out = data.translated_text;
  cache.set(key, out);
  return out;
}

/**
 * @openapi
 * /translate:
 *   post:
 *     summary: Translate an array of UI strings via Sarvam AI
 *     tags: [Translate]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [texts]
 *             properties:
 *               texts: { type: array, items: { type: string } }
 *               target: { type: string, default: "hi-IN" }
 *     responses:
 *       200: { description: "{ translations: string[] } aligned to the input order" }
 */
translateRouter.post("/", async (req, res) => {
  const { texts, target = "hi-IN" } = req.body ?? {};
  if (!Array.isArray(texts) || texts.some((t) => typeof t !== "string")) {
    return res.status(400).json({ error: "texts must be an array of strings" });
  }
  if (texts.length > 200) {
    return res.status(400).json({ error: "too many strings in one request (max 200)" });
  }

  if (typeof target !== "string" || !/^[a-z]{2}-[A-Z]{2}$/.test(target)) {
    return res.status(400).json({ error: "target must be a language code such as hi-IN" });
  }

  try {
    const translations = await Promise.all(texts.map((t: string) => translateOne(t, target)));
    res.json({ translations });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Translation failed";
    const status = message.includes("not configured") ? 503 : 502;
    res.status(status).json({ error: message });
  }
});
