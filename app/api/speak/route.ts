import { NextRequest, NextResponse } from "next/server";
import { VOICE_LANGS, isVoiceLang } from "@/lib/voice";
import { synthesizeEdge } from "@/lib/edge-v2";
import { ttsF53 } from "@/lib/edge-f53";

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
  // First the mirrored-Python flow (3 attempts), then the proven f53 flow
  // with the v2 token as a final attempt before reporting failure.
  let audio: Buffer;
  try {
    audio = await withTimeout(
      synthesizeEdge(spoken, cfg.voice),
      65000,
      "VOICE_TIMEOUT",
      "Voice service timed out. Try again.",
    );
  } catch (e1) {
    try {
      audio = await withTimeout(
        ttsF53(spoken, cfg.voice),
        50000,
        "VOICE_TIMEOUT",
        "Voice service timed out. Try again.",
      );
    } catch (e2) {
      const msg = e2 instanceof Error ? e2.message : "";
      const first = e1 instanceof Error ? e1.message : "";
      // Diagnostic: is the Edge service itself reachable from this server?
      let listNote = "";
      try {
        const lr = await fetch(
          "https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list?trustedclienttoken=6A5AA1D4EAFF4E9FB37E23D68491D6F4",
          { signal: AbortSignal.timeout(10000), headers: { "User-Agent": "Mozilla/5.0" } },
        );
        listNote = ` voices-list: HTTP ${lr.status}.`;
      } catch {
        listNote = " voices-list: unreachable.";
      }
      return err(502, "VOICE_FAILED", (`Voice failed for ${cfg.voice}: f53 flow: ${msg.slice(0, 120)} | python flow: ${first.slice(0, 200)}` + listNote).slice(0, 500));
    }
  }
  if (!audio || audio.length === 0) {
    return err(502, "VOICE_FAILED", `Voice returned empty audio for ${cfg.voice}. Try again.`);
  }
  return new Response(audio as unknown as BodyInit, {
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
  });
}
