import { NextRequest, NextResponse } from "next/server";
import { extractLabel } from "@/lib/extract";
import { findDrug } from "@/lib/drugs";
import { evaluate, DISCLAIMER } from "@/lib/verdict";

// MVP limits: 1 photo, 6 MB, 10 scans/minute per IP (in-memory, single instance).
const MAX_BYTES = 6 * 1024 * 1024;
const hits = new Map<string, { count: number; reset: number }>();

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const h = hits.get(ip);
  if (h && h.reset > now && h.count >= 10) {
    return NextResponse.json({ error: "Too many scans. Wait a minute and try again." }, { status: 429 });
  }
  hits.set(ip, h && h.reset > now ? { count: h.count + 1, reset: h.reset } : { count: 1, reset: now + 60000 });

  const body = await req.json().catch(() => null);
  const image = body?.image ? String(body.image).replace(/^data:image\/\w+;base64,/, "") : "";
  if (!image) return NextResponse.json({ error: "Send { image } as base64." }, { status: 400 });
  if (image.length > MAX_BYTES) return NextResponse.json({ error: "Photo too large. Use a photo under ~4 MB." }, { status: 413 });

  let label;
  try {
    label = await extractLabel(image);
  } catch (e) {
    return NextResponse.json({ error: `Vision API failed: ${e instanceof Error ? e.message : "unknown"}` }, { status: 502 });
  }
  if (!label) {
    return NextResponse.json({ error: "AI_NOT_CONFIGURED", message: "Vision API key is not set on the server yet." }, { status: 503 });
  }
  const drug = findDrug(label.drugName);
  const verdict = evaluate(label, drug);
  return NextResponse.json({ label, matchedDrug: drug, verdict, disclaimer: DISCLAIMER });
}
