import { NextRequest, NextResponse } from "next/server";
import { VOICE_LANGS, NLLB_MODEL, isVoiceLang } from "@/lib/voice";

// POST { text, lang } -> audio bytes (from HF Inference API) for tap-only playback.
// text must already be English (the written verdict). Translation happens here,
// on the server, so the written page never changes language.
// Limits: 10 listens/minute per IP, text max 500 chars (short demo verdicts).
const hits = new Map<string, { count: number; reset: number }>();
const HF_API = "https://api-inference.huggingface.co/models";

function err(status: number, code: string, message: string) {
  return NextResponse.json({ error: code, message }, { status });
}

async function readHfError(res: Response): Promise<string> {
  try {
    const j = await res.json();
    const msg = j?.error || j?.message || JSON.stringify(j);
    const wait = j?.estimated_time ? ` Model is loading, try again in about ${Math.ceil(j.estimated_time)} seconds.` : "";
    return `${String(msg).slice(0, 240)}${wait}`;
  } catch {
    return `Hugging Face returned status ${res.status}.`;
  }
}

async function hfPost(token: string, model: string, body: unknown): Promise<Response> {
  return fetch(`${HF_API}/${model}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    // HF free models can take a while to wake up on first request.
    signal: AbortSignal.timeout(60000),
  });
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
    return err(400, "BAD_LANG", "Voice language must be one of the 50 supported language codes.");
  }

  const token = process.env.HF_TOKEN;
  if (!token) {
    return err(
      503,
      "VOICE_NOT_CONFIGURED",
      "Voice is not set up on the server yet. The HF token must be added to the server env (Vercel) — never in chat or in the repo.",
    );
  }

  const cfg = VOICE_LANGS[lang];
  let spoken = text;

  // 1) Translate English -> target language (skip for English).
  if (cfg.nllbCode) {
    let tr: Response;
    try {
      tr = await hfPost(token, NLLB_MODEL, {
        inputs: text,
        parameters: { src_lang: "eng_Latn", tgt_lang: cfg.nllbCode },
      });
    } catch {
      return err(502, "TRANSLATION_FAILED", "Translation request failed. Check your connection and try again.");
    }
    if (!tr.ok) {
      const detail = await readHfError(tr);
      if (tr.status === 503) return err(503, "MODEL_LOADING", detail);
      if (tr.status === 401 || tr.status === 403) {
        return err(503, "HF_AUTH_FAILED", `Hugging Face rejected the token (${detail}). If you made a Read token, try a fine-grained token with "Make calls to Inference Providers" enabled instead.`);
      }
      return err(502, "TRANSLATION_FAILED", detail);
    }
    try {
      const j = await tr.json();
      const out = Array.isArray(j) ? j[0]?.translation_text : j?.translation_text;
      if (!out || typeof out !== "string") {
        return err(502, "TRANSLATION_FAILED", "Translation returned no text. Try again.");
      }
      spoken = out;
    } catch {
      return err(502, "TRANSLATION_FAILED", "Translation returned an unreadable reply. Try again.");
    }
  }

  // 2) Speak the (translated) text with Meta MMS-TTS. Returns audio bytes.
  let tts: Response;
  try {
    tts = await hfPost(token, cfg.ttsModel, { inputs: spoken });
  } catch {
    return err(502, "VOICE_FAILED", "Voice request failed. Check your connection and try again.");
  }
  if (!tts.ok) {
    const detail = await readHfError(tts);
    if (tts.status === 503) return err(503, "MODEL_LOADING", detail);
    if (tts.status === 401 || tts.status === 403) {
      return err(503, "HF_AUTH_FAILED", `Hugging Face rejected the token (${detail}). If you made a Read token, try a fine-grained token with "Make calls to Inference Providers" enabled instead.`);
    }
    if (tts.status === 404) {
      return err(502, "VOICE_MODEL_NOT_FOUND", `Voice model ${cfg.ttsModel} was not found on Hugging Face. This language's voice is not confirmed yet — try English or Urdu.`);
    }
    return err(502, "VOICE_FAILED", detail);
  }

  const contentType = tts.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return err(502, "VOICE_FAILED", await readHfError(tts));
  }
  const audio = await tts.arrayBuffer();
  if (!audio.byteLength) {
    return err(502, "VOICE_FAILED", "Voice returned empty audio. Try again.");
  }
  return new Response(audio, {
    headers: {
      "Content-Type": contentType.startsWith("audio/") ? contentType : "audio/wav",
      "Cache-Control": "no-store",
    },
  });
}
