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

const PROMPT = `Read this medicine pack or strip photo. The photo may show the outer pack/box OR the medicine strip itself (the foil/blister "patta" holding the tablets). Return ONLY a JSON object, no other text:
{"drugName": string or null, "manufacturer": string or null, "batchNumber": string or null, "expiryDate": string or null, "confidence": number 0 to 1, "barcode": string or null, "barcodeProduct": string or null}
Rules: copy text exactly as printed. On a strip, the drug name is usually printed on the foil — read it from there. The photo may be rotated or tilted — read rotated text as if it were upright. Look closely at small printed lines such as Batch / MFG / EXP / MRP. If a field is not readable, use null — never guess. You MUST always return the JSON object, even if you can read nothing (then use null for every field and confidence 0). Never reply with plain text, explanations, or refusals. barcode is the digits printed under the barcode, if visible, else null. barcodeProduct is a product name printed on or next to the barcode label, if one is visible, else null. Do not give dosage, usage or medical advice.`;

// Stage-2 fallback prompt: when the model will not return strict JSON,
// ask for plain visible text instead and extract fields with regexps.
// Free text is NEVER trusted blindly — batch/expiry need explicit labels
// (Batch, MFG, EXP) and drug names must match the fixed medicine list.
const FREETEXT_PROMPT = `Read this medicine pack or strip photo and write down every line of text you can see, one line per line. The photo may show the outer pack/box or the medicine strip itself (foil/blister). Copy text exactly as printed. The photo may be rotated or tilted. If you cannot see any text clearly, reply with exactly: NO_TEXT_VISIBLE. Do not give dosage, usage or medical advice.`;

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
): Promise<{ label: Label | null; attempts: number; rawReplies: string[] }> {
  const cfg = providerConfig();
  if (!cfg.key) return { label: null, attempts: 0, rawReplies: [] };
  let attempts = 0;
  const rawReplies: string[] = [];
  const take = async (v: string, prompt: string, free: boolean) => {
    attempts++;
    const text = await callVision(v, prompt, cfg, 30000);
    // Keep a short sample of every raw reply for debug=1 diagnostics.
    rawReplies.push(text.slice(0, 200));
    const label = free
      ? text && !/NO_TEXT_VISIBLE/.test(text)
        ? labelFromFreeText(text)
        : null
      : parseLabelText(text);
    return label;
  };
  // Robustness loop, stage 1: a tilted, dark or low-contrast photo — or one
  // carrying a dense 2D barcode the vision model blanks on — can make the
  // model return no usable JSON. So we try several variants of the same
  // photo — original, code-masked, downscaled, rotated 90°/270°, enhanced —
  // and keep the FIRST one that parses. API errors (bad key, rate limit)
  // still throw immediately; only an unparseable reply moves on to the
  // next variant.
  const variants = await buildVariants(imageBase64);
  for (const v of variants) {
    const label = await take(v, PROMPT, false);
    if (label) return { label, attempts, rawReplies };
  }
  // Stage 2: the model sometimes will not return strict JSON at all. Ask
  // for plain visible text instead (original + last variant) and extract
  // fields conservatively with regexps. Never guesses: batch/expiry need
  // explicit printed labels, drug names must match the fixed list.
  const stage2 = variants.length > 1 ? [variants[0], variants[variants.length - 1]] : [variants[0]];
  for (const v of stage2) {
    const label = await take(v, FREETEXT_PROMPT, true);
    if (label) return { label, attempts, rawReplies };
  }
  return { label: null, attempts, rawReplies };
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
    const toB64 = (b: Buffer) => b.toString("base64");
    // 0: original, normalised to JPEG.
    variants.push(toB64(await sharp(input).jpeg({ quality: 88 }).toBuffer()));
    // 1: code-masked — covers the densest 2D-barcode-like region with
    // white (see maskCodeRegion). Added only when such a region
    // is actually found.
    const masked = await maskCodeRegion(input);
    if (masked) variants.push(toB64(masked));
    // 2: small (0.35x) — second line of 2D-code evasion: the code pattern
    // becomes unresolvable while big text stays readable.
    variants.push(
      toB64(
        await sharp(input)
          .resize({ width: Math.max(240, Math.round((meta.width || 800) * 0.35)) })
          .jpeg({ quality: 88 })
          .toBuffer()
      )
    );
    // 3-4: 90° / 270° rotations for tilted photos.
    variants.push(
      (await sharp(input).rotate(90).jpeg({ quality: 88 }).toBuffer()).toString("base64")
    );
    variants.push(
      (await sharp(input).rotate(270).jpeg({ quality: 88 }).toBuffer()).toString("base64")
    );
    // 5: enhanced — auto-contrast + sharpen for dark / washed-out photos.
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

// Dense 2D-code masking. Pakistani packs carry a DRAP Data Matrix code,
// and the vision model returns EMPTY replies for images where that code
// pattern is resolvable (a 2D-barcode safety filter). Covering the code
// with a white box breaks the pattern while the rest of the label stays
// fully readable.
// Detection: edge-density grid. A 2D code is a compact square region far
// denser than the image median. From each peak-density cell we expand in
// the four directions independently while cells stay dense — this centers
// the box on the code even when the peak cell itself is off-center. We
// repeat for up to 3 separate peaks (packs can carry more than one code;
// masking only the densest leaves the others triggering the filter).
// Returns a JPEG buffer with all found regions whited out, or null when
// no code-like region is found (the caller then simply skips this variant).
async function maskCodeRegion(input: Buffer): Promise<Buffer | null> {
  try {
    const sharp = (await import("sharp")).default;
    const { data, info } = await sharp(input)
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const W = info.width || 0;
    const H = info.height || 0;
    if (!W || !H) return null;
    const CELL = 16;
    const gw = Math.ceil(W / CELL);
    const gh = Math.ceil(H / CELL);
    const scores = new Float32Array(gw * gh);
    for (let y = 0; y < H - 1; y++) {
      for (let x = 0; x < W - 1; x++) {
        const i = y * W + x;
        const e = Math.abs(data[i] - data[i + 1]) + Math.abs(data[i] - data[i + W]);
        scores[Math.floor(y / CELL) * gw + Math.floor(x / CELL)] += e;
      }
    }
    const per = CELL * CELL;
    for (let i = 0; i < scores.length; i++) scores[i] /= per;
    const sorted = Array.from(scores).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] || 1;
    // A real code region is dramatically denser than the background.
    if (median <= 0) return null;
    const dense = (x: number, y: number) =>
      x >= 0 && y >= 0 && x < gw && y < gh && scores[y * gw + x] > median * 3;
    const cap = Math.ceil(Math.min(W, H) * 0.12 / CELL);
    const work = Float32Array.from(scores);
    const boxes: { left: number; top: number; width: number; height: number }[] = [];
    for (let iter = 0; iter < 3; iter++) {
      let pi = -1;
      let peak = 0;
      for (let i = 0; i < work.length; i++) {
        if (work[i] > peak) { peak = work[i]; pi = i; }
      }
      if (pi < 0 || peak < median * 6) break;
      const px = pi % gw;
      const py = Math.floor(pi / gw);
      let l = 0, r = 0, u = 0, d = 0;
      const colDense = (x: number, y0: number, y1: number) => {
        for (let y = y0; y <= y1; y++) if (dense(x, y)) return true;
        return false;
      };
      const rowDense = (y: number, x0: number, x1: number) => {
        for (let x = x0; x <= x1; x++) if (dense(x, y)) return true;
        return false;
      };
      while (l < cap && colDense(px - l - 1, py - u, py + d)) l++;
      while (r < cap && colDense(px + r + 1, py - u, py + d)) r++;
      while (u < cap && rowDense(py - u - 1, px - l, px + r)) u++;
      while (d < cap && rowDense(py + d + 1, px - l, px + r)) d++;
      // Sanity: the region must look like a code — roughly square and
      // not tiny, not huge.
      const bwCells = l + r + 1;
      const bhCells = u + d + 1;
      const aspect = Math.max(bwCells, bhCells) / Math.max(1, Math.min(bwCells, bhCells));
      const pad = 10;
      const left = Math.max(0, (px - l) * CELL - pad);
      const top = Math.max(0, (py - u) * CELL - pad);
      const width = Math.min(W - left, bwCells * CELL + pad * 2);
      const height = Math.min(H - top, bhCells * CELL + pad * 2);
      // Suppress this region so the next iteration finds a different peak.
      // (Always suppress, even if the box fails validation — otherwise a
      // rejected peak would be picked again forever.)
      const sx0 = Math.max(0, px - l - 1);
      const sx1 = Math.min(gw - 1, px + r + 1);
      const sy0 = Math.max(0, py - u - 1);
      const sy1 = Math.min(gh - 1, py + d + 1);
      for (let y = sy0; y <= sy1; y++)
        for (let x = sx0; x <= sx1; x++) work[y * gw + x] = 0;
      if (aspect > 2) continue;
      if (bwCells * CELL < 24 || bhCells * CELL < 24) continue;
      // Uniformity check: a 2D code is dense EVERYWHERE inside its box,
      // while printed text has low-density gaps between lines. Split the
      // box into 3x3 and require every sub-cell to stay well above the
      // median — this keeps brand text readable and only masks real codes.
      let uniform = true;
      for (let cy = 0; cy < 3 && uniform; cy++) {
        for (let cx = 0; cx < 3 && uniform; cx++) {
          let s = 0;
          let n = 0;
          const xa = Math.floor(px - l + (cx * bwCells) / 3);
          const xb = Math.floor(px - l + ((cx + 1) * bwCells) / 3);
          const ya = Math.floor(py - u + (cy * bhCells) / 3);
          const yb = Math.floor(py - u + ((cy + 1) * bhCells) / 3);
          for (let y = ya; y <= yb; y++) {
            for (let x = xa; x <= xb; x++) {
              if (x < 0 || y < 0 || x >= gw || y >= gh) continue;
              s += scores[y * gw + x];
              n++;
            }
          }
          if (!n || s / n < median * 2) uniform = false;
        }
      }
      if (!uniform) continue;
      boxes.push({ left, top, width, height });
    }
    if (boxes.length === 0) return null;
    const composites: { input: Buffer; left: number; top: number }[] = [];
    for (const b of boxes) {
      const white = await sharp({
        create: { width: b.width, height: b.height, channels: 3, background: { r: 255, g: 255, b: 255 } },
      })
        .jpeg()
        .toBuffer();
      composites.push({ input: white, left: b.left, top: b.top });
    }
    return await sharp(input)
      .composite(composites)
      .jpeg({ quality: 88 })
      .toBuffer();
  } catch {
    return null;
  }
}
