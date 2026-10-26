import { NextRequest, NextResponse } from "next/server";
import { extractLabel } from "@/lib/extract";
import { findDrug } from "@/lib/drugs";
import { evaluate, DISCLAIMER } from "@/lib/verdict";
import { mergeLabels } from "@/lib/merge";

// Item 1: 1 to 3 photos per scan, 6 MB per photo, 10 scans/minute per IP
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
  // Accept { images: [1..3] } (new multi-photo flow) or { image } (old
  // single-photo flow, kept working).
  let images: string[] = [];
  if (Array.isArray(body?.images)) {
    images = body.images.map((img: unknown) => String(img).replace(/^data:image\/\w+;base64,/, ""));
  } else if (body?.image) {
    images = [String(body.image).replace(/^data:image\/\w+;base64,/, "")];
  }
  if (images.length < 1 || images.length > 3) {
    return NextResponse.json({ error: "Send 1 to 3 photos." }, { status: 400 });
  }
  for (const img of images) {
    if (img.length > MAX_BYTES) {
      return NextResponse.json({ error: "Photo too large. Use a photo under ~4 MB." }, { status: 413 });
    }
  }

  // Read each photo separately, in parallel. A photo the vision step
  // fails on simply contributes nothing; the merged label is built from
  // the photos that DID read. If none read, report the failure honestly
  // instead of inventing a verdict.
  const reads = await Promise.allSettled(images.map((img) => extractLabel(img)));
  const labels = reads
    .filter((r): r is PromiseFulfilledResult<import("@/lib/verdict").Label | null> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((l): l is import("@/lib/verdict").Label => l !== null);
  if (labels.length === 0) {
    const failed = reads.some((r) => r.status === "rejected");
    if (failed) {
      const firstError = reads.find((r) => r.status === "rejected") as PromiseRejectedResult;
      return NextResponse.json({ error: `Vision API failed: ${firstError.reason instanceof Error ? firstError.reason.message : "unknown"}` }, { status: 502 });
    }
    return NextResponse.json({ error: "AI_NOT_CONFIGURED", message: "Vision API key is not set on the server yet." }, { status: 503 });
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

  return NextResponse.json({
    label: merged.label,
    perPhoto: merged.perPhoto,
    conflicts: merged.conflicts,
    photosSent: images.length,
    photosRead: labels.length,
    matchedDrug: drug,
    verdict,
    disclaimer: DISCLAIMER,
  });
}
