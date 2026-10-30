/**
 * Vision extraction through Meta models, provider-swappable.
 * Plan A (default): Meta Model API, model muse-spark-1.3, base https://api.meta.ai/v1
 * Plan B: Baseten Model API, base https://inference.baseten.co/v1
 *   Docs list the slug as meta-models/muse-spark-open. If your Baseten dashboard
 *   shows a dated slug (e.g. muse-spark-open-1026), set BASETEN_MODEL to that slug.
 *   Baseten does NOT support JSON mode for Muse Spark Open, so we always parse
 *   JSON out of the model's text reply instead of relying on response_format.
 * Keys live ONLY in server env vars (Vercel) or local .env — never in code or git.
 */
import type { Label } from "./verdict";
import { DRUG_LIST } from "./drugs";

const PROMPT = `Read this medicine pack photo. Return ONLY a JSON object, no other text:
{"drugName": string or null, "manufacturer": string or null, "batchNumber": string or null, "expiryDate": string or null, "confidence": number 0 to 1, "barcode": string or null, "barcodeProduct": string or null}
Rules: copy text exactly as printed. The photo may be rotated or tilted — read rotated text as if it were upright. Look closely at small printed lines such as Batch / MFG / EXP / MRP. If a field is not readable, use null — never guess. You MUST always return the JSON object, even if you can read nothing (then use null for every field and confidence 0). Never reply with plain text, explanations, or refusals. barcode is the digits printed under the barcode, if visible, else null. barcodeProduct is a product name printed on or next to the barcode label, if one is visible, else null. Do not give dosage, usage or medical advice.`;

// Stage-2 fallback prompt: when the model will not return strict JSON,
// ask for plain visible text instead and extract fields with regexps.
// Free text is NEVER trusted blindly — batch/expiry need explicit labels
// (Batch, MFG, EXP) and drug names must match the fixed medicine list.
const FREETEXT_PROMPT = `Read this medicine pack photo and write down every line of text you can see, one line per line. Copy text exactly as printed. The photo may be rotated or tilted. If you cannot see any text clearly, reply with exactly: NO_TEXT_VISIBLE. Do not give dosage, usage or medical advice.`;

export function providerConfig() {
  const provider = (process.env.AI_PROVIDER || "meta").toLowerCase();
  if (provider === "baseten") {
    return {
      provider,
      base: "https://inference.baseten.co/v1",
      model: process.env.BASETEN_MODEL || "meta-models/muse-spark-open",
      key: process.env.BASETEN_API_KEY || "",
    };
  }
  return {
    provider: "meta",
    base: "https://api.meta.ai/v1",
    model: process.env.META_MODEL || "muse-spark-1.3",
    key: process.env.META_API_KEY || "",
  };
}

export function parseLabelText(text: string): Label | null {
  // Non-greedy: take the FIRST complete {...} block. The label JSON is
  // flat (no nested objects), so if the model adds chatter with braces
  // after the JSON, we still grab the JSON and not the chatter.
  const m = text.match(/\{[\s\S]*?\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]);
    if (typeof j !== "object" || j === null) return null;
    // Defensive: the prompt says "string or null", but if the model
    // returns a number/boolean for a text field, coerce instead of
    // crashing downstream (norm() calls .toLowerCase()).
    const str = (v: unknown): string | null =>
      typeof v === "string" ? v : v == null ? null : String(v);
    return {
      drugName: str(j.drugName),
      manufacturer: str(j.manufacturer),
      batchNumber: str(j.batchNumber),
      expiryDate: str(j.expiryDate),
      confidence: typeof j.confidence === "number" ? j.confidence : 0.55,
      // Barcode digits often come back as a JSON number (8901234567890)
      // instead of a string — coerce numbers to string, otherwise the
      // barcode value would be silently dropped to null.
      barcode:
        typeof j.barcode === "string"
          ? j.barcode
          : typeof j.barcode === "number"
            ? String(j.barcode)
            : null,
      barcodeProduct: typeof j.barcodeProduct === "string" ? j.barcodeProduct : null,
    };
  } catch {
    return null;
  }
}

export async function extractLabel(
  imageBase64: string
): Promise<{ label: Label | null; attempts: number }> {
  const cfg = providerConfig();
  if (!cfg.key) return { label: null, attempts: 0 };
  let attempts = 0;
  // Robustness loop, stage 1: a tilted, dark or low-contrast photo can make
  // the vision model return no usable JSON. So we try up to 4 variants of
  // the same photo — original, rotated 90°, rotated 270°, and an enhanced
  // (auto-contrast + sharpen) copy — and keep the FIRST one that parses.
  // API errors (bad key, rate limit) still throw immediately; only an
  // unparseable reply moves on to the next variant.
  const variants = await buildVariants(imageBase64);
  for (const v of variants) {
    attempts++;
    const label = await tryVisionCall(v, cfg);
    if (label) return { label, attempts };
  }
  // Stage 2: the model sometimes will not return strict JSON at all. Ask
  // for plain visible text instead (original + enhanced copy) and extract
  // fields conservatively with regexps. Never guesses: batch/expiry need
  // explicit printed labels, drug names must match the fixed list.
  for (const v of [variants[0], variants[variants.length - 1]]) {
    attempts++;
    const text = await tryFreeText(v, cfg);
    const label = text ? labelFromFreeText(text) : null;
    if (label) return { label, attempts };
  }
  return { label: null, attempts };
}

// One vision attempt against a single image variant. Returns the parsed
// label, or null when the reply has no usable JSON. Throws on API errors.
async function tryVisionCall(
  jpegBase64: string,
  cfg: ReturnType<typeof providerConfig>
): Promise<Label | null> {
  const text = await callVision(jpegBase64, PROMPT, cfg, 30000);
  return parseLabelText(text);
}

// One free-text attempt: returns the raw visible text, or null when the
// model reports NO_TEXT_VISIBLE or the reply is empty. Throws on API errors.
async function tryFreeText(
  jpegBase64: string,
  cfg: ReturnType<typeof providerConfig>
): Promise<string | null> {
  const text = await callVision(jpegBase64, FREETEXT_PROMPT, cfg, 30000);
  if (!text || /NO_TEXT_VISIBLE/.test(text)) return null;
  return text;
}

// Shared vision call: 30s cap per attempt (the model usually answers in
// seconds). Vercel kills the function at its own timeout anyway; this
// surfaces an exact error instead of a silent hang.
async function callVision(
  jpegBase64: string,
  prompt: string,
  cfg: ReturnType<typeof providerConfig>,
  timeoutMs: number
): Promise<string> {
  const res = await fetch(`${cfg.base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.key}` },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${jpegBase64}` } },
          ],
        },
      ],
      max_tokens: 512,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${cfg.provider} API ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = await res.json();
  const rawContent: unknown = json?.choices?.[0]?.message?.content;
  // Some providers return content as blocks [{type:"text",text:"..."}];
  // join those, otherwise use the plain string.
  const text: string = Array.isArray(rawContent)
    ? rawContent.map((b) => (typeof b?.text === "string" ? b.text : "")).join("")
    : typeof rawContent === "string"
      ? rawContent
      : "";
  return text;
}

// Build a Label from free-text visible lines. Conservative by design:
// - batch/expiry are only taken when an explicit printed label
//   (Batch/B.No, EXP/Expiry) precedes the value — never guessed. The
//   label needs a word boundary so "blurry" or "Nuberol" cannot fake it.
// - drugName must match the fixed medicine list, searched line by line
//   top to bottom (brand name is usually the first line), longest names
//   first. Parenthesised segments are stripped first so ingredient lists
//   like "(Paracetamol BP)" cannot masquerade as the brand name.
// Returns null when nothing usable was extracted.
export function labelFromFreeText(text: string): Label | null {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\([^)]*\)/g, " "));
  const names = [...DRUG_LIST].map((d) => d.name).sort((a, b) => b.length - a.length);
  let drugName: string | null = null;
  outer: for (const line of lines) {
    const low = ` ${line.toLowerCase().replace(/[^a-z0-9+.\- ]/g, " ")} `;
    for (const n of names) {
      const norm = ` ${n.toLowerCase().replace(/[^a-z0-9+.\- ]/g, " ")} `;
      if (low.includes(norm)) { drugName = n; break outer; }
    }
  }
  const batch =
    /\b(?:batch|b\.?\s*no\.?)[\s:.\-]*([A-Z0-9][A-Z0-9\-]{2,20})/i.exec(text)?.[1] ?? null;
  const expiry =
    /(?:exp(?:iry)?\.?)[\s:.\-]*(\d{1,2}[\/\-.]\d{2,4})/i.exec(text)?.[1] ?? null;
  if (!drugName && !batch && !expiry) return null;
  return {
    drugName,
    manufacturer: null,
    batchNumber: batch,
    expiryDate: expiry,
    confidence: 0.4,
    barcode: null,
    barcodeProduct: null,
  };
}

// Build the image variants for the robustness loop. Returns base64 JPEG
// strings, original first. If sharp is unavailable or the image cannot be
// processed, falls back to the single original image.
async function buildVariants(imageBase64: string): Promise<string[]> {
  try {
    const sharp = (await import("sharp")).default;
    const input = Buffer.from(imageBase64, "base64");
    const meta = await sharp(input).metadata();
    if (!meta.width || !meta.height) return [imageBase64];
    const variants: string[] = [];
    // 0: original, normalised to JPEG.
    variants.push(
      (await sharp(input).jpeg({ quality: 88 }).toBuffer()).toString("base64")
    );
    // 1-2: 90° / 270° rotations for tilted photos.
    variants.push(
      (await sharp(input).rotate(90).jpeg({ quality: 88 }).toBuffer()).toString("base64")
    );
    variants.push(
      (await sharp(input).rotate(270).jpeg({ quality: 88 }).toBuffer()).toString("base64")
    );
    // 3: enhanced — auto-contrast + sharpen for dark / washed-out photos.
    variants.push(
      (
        await sharp(input).normalize().sharpen().jpeg({ quality: 88 }).toBuffer()
      ).toString("base64")
    );
    return variants;
  } catch {
    return [imageBase64];
  }
}
