import { NextRequest, NextResponse } from "next/server";
import { VOICE_LANGS, isVoiceLang } from "@/lib/voice";
import { tts as edgeTts } from "edge-tts/out/index.js";

// POST { text, lang } -> audio bytes for tap-only playback.
// Free server stack, no key, no card:
//   1) Translation: MyMemory (free, no key) English -> target language.
//      Skipped for English locales (myMemory null) and for Roman Urdu,
//      which uses the Urdu translation (spoken Urdu is script-independent).
//   2) Speech: Microsoft Edge neural voices via the `edge-tts` package
//      (free, no key, unofficial service — Microsoft can change it).
// The written site and written verdict always stay English. Only the
// spoken output changes language. Never autoplay, never fake audio:
// every failure returns an exact error instead of audio in another language.
// Limits: 10 listens/minute per IP, text max 500 chars (short demo verdicts).
const hits = new Map<string, { count: number; reset: number }>();

function err(status: number, code: string, message: string) {
  return NextResponse.json({ error: code, message }, { status });
}

function withTimeout<T>(p: Promise<T>, ms: number, code: string, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error(message), { code })), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const h = hits.get(ip);
  if (h && h.reset > now && h.count >= 10) {
    return err(429, "RATE_LIMITED", "Too many listens. Wait a minute and try again.");
  }
  hits.set(ip, h && h.reset > now ? { count: h.count + 1, reset: h.reset } : { count: 1, reset: now + 60000 });

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const lang = body?.lang;
  if (!text || text.length > 500) {
    return err(400, "BAD_TEXT", "Send a short verdict text (1 to 500 characters).");
  }
  if (!isVoiceLang(lang)) {
    return err(400, "BAD_LANG", "Voice language must be one of the Edge voice locales in the list.");
  }

  const cfg = VOICE_LANGS[lang];
  let spoken = text;

  // 1) Translate English -> target language (skip for English locales).
  if (cfg.myMemory) {
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
    spoken = translated;
  }

  // 2) Speak the (translated) text with the Edge voice for this locale.
  let audio: Buffer;
  try {
    audio = await withTimeout(
      edgeTts(spoken, { voice: cfg.voice }),
      60000,
      "VOICE_TIMEOUT",
      "Voice service timed out. Try again.",
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("403") || msg.includes("401")) {
      return err(502, "VOICE_AUTH_FAILED", `Edge voice service rejected the request for voice ${cfg.voice}. Try again later.`);
    }
    return err(502, "VOICE_FAILED", msg ? `Voice failed for ${cfg.voice}: ${msg.slice(0, 200)}` : `Voice failed for ${cfg.voice}. Try again.`);
  }
  if (!audio || audio.length === 0) {
    return err(502, "VOICE_FAILED", `Voice returned empty audio for ${cfg.voice}. Try again.`);
  }
  return new Response(audio as unknown as BodyInit, {
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
  });
}
