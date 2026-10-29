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

const PROMPT = `Read this medicine pack photo. Return ONLY a JSON object, no other text:
{"drugName": string or null, "manufacturer": string or null, "batchNumber": string or null, "expiryDate": string or null, "confidence": number 0 to 1, "barcode": string or null, "barcodeProduct": string or null}
Rules: copy text exactly as printed. If a field is not readable, use null — never guess. barcode is the digits printed under the barcode, if visible, else null. barcodeProduct is a product name printed on or next to the barcode label, if one is visible, else null. Do not give dosage, usage or medical advice.`;

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

export async function extractLabel(imageBase64: string): Promise<Label | null> {
  const cfg = providerConfig();
  if (!cfg.key) return null;
  // 120s cap: never hang the request forever if the vision API stalls.
  // (Vercel kills the function at its own timeout anyway; this surfaces
  // an exact error instead of a silent hang.)
  const res = await fetch(`${cfg.base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.key}` },
    signal: AbortSignal.timeout(120000),
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
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
  return parseLabelText(text);
}
