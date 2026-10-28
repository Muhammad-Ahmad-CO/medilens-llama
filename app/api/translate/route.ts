import { NextRequest, NextResponse } from "next/server";
import { VOICE_LANGS, isVoiceLang } from "@/lib/voice";

// POST { text, lang } -> { text: translated } (JSON, never audio).
// Translation only: MyMemory (free, no key), English -> target language.
// The phone itself speaks the returned text (Web Speech API), so this
// route never touches a speech service. Server voice was retired
// 2026-10-28 after Edge synthesis failed from Vercel in 7 configs.
// Skipped for English locales (myMemory null): the text is returned
// unchanged. Roman Urdu uses the Urdu translation, as before.
// Limits: 10 translations/minute per IP, text max 500 chars.
const hits = new Map<string, { count: number; reset: number }>();

function err(status: number, code: string, message: string) {
  return NextResponse.json({ error: code, message }, { status });
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const h = hits.get(ip);
  if (h && h.reset > now && h.count >= 10) {
    return err(429, "RATE_LIMITED", "Too many translations. Wait a minute and try again.");
  }
  hits.set(ip, h && h.reset > now ? { count: h.count + 1, reset: h.reset } : { count: 1, reset: now + 60000 });

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const lang = body?.lang;
  if (!text || text.length > 500) {
    return err(400, "BAD_TEXT", "Send a short verdict text (1 to 500 characters).");
  }
  if (!isVoiceLang(lang)) {
    return err(400, "BAD_LANG", "Voice language must be one of the locales in the list.");
  }

  const cfg = VOICE_LANGS[lang];
  if (!cfg.myMemory) {
    return NextResponse.json({ text });
  }

  let tr: Response;
  try {
    tr = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${cfg.myMemory}`,
      { signal: AbortSignal.timeout(30000) },
    );
  } catch {
    return err(502, "TRANSLATION_FAILED", "Translation service could not be reached. Try again.");
  }
  if (!tr.ok) {
    return err(502, "TRANSLATION_FAILED", `Translation service returned status ${tr.status}. Try again.`);
  }
  const j = await tr.json().catch(() => null);
  const translated = j?.responseData?.translatedText;
  if (j?.quotaFinished) {
    return err(502, "TRANSLATION_LIMIT", "Translation daily limit reached. Try again later.");
  }
  if (String(j?.responseStatus) !== "200" || !translated || typeof translated !== "string") {
    return err(502, "TRANSLATION_FAILED", `Translation failed for this language (${String(j?.responseDetails || "no translated text")}). Try English instead.`);
  }
  return NextResponse.json({ text: translated });
}
