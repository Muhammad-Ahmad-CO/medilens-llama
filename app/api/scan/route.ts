import { NextRequest, NextResponse } from "next/server";
import { extractLabel, providerConfig } from "@/lib/extract";
import { findDrug } from "@/lib/drugs";
import { evaluate, DISCLAIMER } from "@/lib/verdict";
import { mergeLabels } from "@/lib/merge";

// Item 1: 1 to 4 photos per scan, 6 MB per photo, 10 scans/minute per IP
// (in-memory, single instance). One request counts as one scan, however
// many photos it carries.
const MAX_BYTES = 6 * 1024 * 1024;
const hits = new Map<string, { count: number; reset: number }>();

// Must match the amber title in lib/verdict.ts (TITLES.amber). Verdict
// rules themselves are untouched: a conflict only downgrades GREEN to
// AMBER here, it never changes a RED, and never creates a GREEN.
const AMBER_TITLE = "Be careful — check before use";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const h = hits.get(ip);
  if (h && h.reset > now && h.count >= 10) {
    return NextResponse.json({ error: "Too many scans. Wait a minute and try again." }, { status: 429 });
  }
  hits.set(ip, h && h.reset > now ? { count: h.count + 1, reset: h.reset } : { count: 1, reset: now + 60000 });

  const body = await req.json().catch(() => null);
  // Accept { images: [1..4] } (new multi-photo flow) or { image } (old
  // single-photo flow, kept working).
  let images: string[] = [];
  if (Array.isArray(body?.images)) {
    images = body.images.map((img: unknown) => String(img).replace(/^data:image\/\w+;base64,/, ""));
  } else if (body?.image) {
    images = [String(body.image).replace(/^data:image\/\w+;base64,/, "")];
  }
  if (images.length < 1 || images.length > 4) {
    return NextResponse.json({ error: "Send 1 to 4 photos." }, { status: 400 });
  }
  for (const img of images) {
    if (img.length > MAX_BYTES) {
      return NextResponse.json({ error: "Photo too large. Use a photo under ~4 MB." }, { status: 413 });
    }
  }

  // Read each photo separately, in parallel. A photo the vision step
  // fails on simply contributes nothing; the merged label is built from
  // the photos that DID read. If none read, we still return a proper
  // result — an "unreadable" card with exact retake guidance — never a
  // dead-end error page. (A missing API key stays a 503: that is a setup
  // problem, not a photo problem.)
  const reads = await Promise.allSettled(images.map((img) => extractLabel(img)));
  type Readout = { label: import("@/lib/verdict").Label | null; attempts: number; rawReplies: string[] };
  const readouts: Readout[] = reads
    .filter((r): r is PromiseFulfilledResult<Readout> => r.status === "fulfilled")
    .map((r) => r.value);
  const attempts = readouts.reduce((n, r) => n + r.attempts, 0);
  // debug=1 exposes short samples of the raw vision replies so a failed
  // read can be diagnosed (what did the model actually say?). Never on
  // by default; samples are truncated to 200 chars and contain no images.
  const debug = new URL(req.url).searchParams.get("debug") === "1";
  const debugInfo = debug
    ? { debug: { attempts, rawReplies: readouts.flatMap((r) => r.rawReplies) } }
    : {};
  const labels = readouts
    .map((r) => r.label)
    .filter((l): l is import("@/lib/verdict").Label => l !== null);
  if (labels.length === 0) {
    const failed = reads.some((r) => r.status === "rejected");
    if (failed) {
      const firstError = reads.find((r) => r.status === "rejected") as PromiseRejectedResult;
      return NextResponse.json({ error: `Vision API failed: ${firstError.reason instanceof Error ? firstError.reason.message : "unknown"}` }, { status: 502 });
    }
    // Audit fix: a missing key and an unreadable photo are different
    // failures. Do not blame the key when the key is set but no photo
    // could be read.
    if (!providerConfig().key) {
      return NextResponse.json({ error: "AI_NOT_CONFIGURED", message: "Vision API key is not set on the server yet." }, { status: 503 });
    }
    return NextResponse.json({
      unreadable: true,
      verdict: {
        level: "unreadable",
        title: "Couldn't read the photo",
        reasons: [
          "The photo was analysed several times — including rotated and enhanced copies — but no label text could be read.",
          "Make sure the full label is inside the photo: the batch number and expiry date must be fully visible, not cut off at the edge.",
          "Hold the phone steady, move a little closer, and avoid glare or shadows falling on the pack.",
        ],
      },
      label: null,
      perPhoto: [],
      conflicts: [],
      photosSent: images.length,
      photosRead: 0,
      attempts,
      ...debugInfo,
      disclaimer: DISCLAIMER,
    });
  }

  const merged = mergeLabels(labels);
  const drug = findDrug(merged.label.drugName);
  const verdict = evaluate(merged.label, drug);
  // Conflict handling (Item 1): a conflict can only pull GREEN down to
  // AMBER. RED stays RED, AMBER stays AMBER, with the reasons visible.
  if (merged.conflicts.length > 0 && verdict.level === "green") {
    verdict.level = "amber";
    verdict.title = AMBER_TITLE;
    verdict.reasons = [...merged.conflicts, ...verdict.reasons];
  } else if (merged.conflicts.length > 0) {
    verdict.reasons = [...merged.conflicts, ...verdict.reasons];
  }

  // Feature 1 — Barcode vs Text Cross-Check. Honest limit: a bare barcode
  // number cannot be mapped to a medicine name (no GTIN registry), so a
  // mismatch fires ONLY when the barcode label itself carries a product
  // name that resolves to a DIFFERENT known drug than the front of the
  // pack. An unreadable/absent barcode, or a barcode name that matches
  // the front name, never changes the verdict. Like a conflict, a
  // mismatch only pulls GREEN down to AMBER, never changes a RED.
  const barcodeDrug = findDrug(merged.label.barcodeProduct);
  if (
    merged.label.barcodeProduct &&
    barcodeDrug &&
    drug &&
    barcodeDrug.name !== drug.name
  ) {
    const reason =
      `Barcode does not match the printed medicine name. ` +
      `Barcode label shows "${merged.label.barcodeProduct}" but the front of the pack shows "${merged.label.drugName}".`;
    if (verdict.level === "green") {
      verdict.level = "amber";
      verdict.title = AMBER_TITLE;
    }
    verdict.reasons = [reason, ...verdict.reasons];
  }

  return NextResponse.json({
    label: merged.label,
    perPhoto: merged.perPhoto,
    conflicts: merged.conflicts,
    photosSent: images.length,
    photosRead: labels.length,
    matchedDrug: drug,
    verdict,
    attempts,
    ...debugInfo,
    disclaimer: DISCLAIMER,
  });
}
