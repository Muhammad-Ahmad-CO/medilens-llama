// Voice for the hackathon build — free Meta models only, no card, no endpoint.
//
// Translation: Meta NLLB, facebook/nllb-200-distilled-600M, via the
// Hugging Face Inference API (HF_TOKEN in server env only, never in chat/repo).
// Voice: Meta MMS-TTS (Massively Multilingual Speech), also via HF Inference API.
// The written site and written verdict always stay in English. Only the
// spoken verdict changes language, and only when the user taps Listen.
//
// Language table:
//   en  — no translation, facebook/mms-tts-eng (confirmed)
//   ur  — NLLB urd_Arab, facebook/mms-tts-urd-script_arabic (confirmed)
//   pan — NLLB pan_Guru (Gurmukhi side), facebook/mms-tts-pan
//         (listed as Punjabi, Eastern — may not match Shahmukhi perfectly)
//   snd — NLLB snd_Arab, facebook/mms-tts-snd
//         Sindhi voice checkpoint is UNVERIFIED at build time: if HF returns
//         404 / "model not found" for this ID, /api/speak reports that exact
//         error instead of playing Urdu audio and calling it Sindhi.
//         Do not promise Sindhi speech until a live phone test passes.
//
// HF token permission note (2026): the legacy serverless Inference API
// works with a Read token, but HF's newer Inference Providers routing may
// require a fine-grained token with "Make calls to Inference Providers"
// enabled. If HF returns 401/403, that is the first thing to fix in
// Hugging Face Settings -> Access Tokens — never by putting a token in chat.

export type VoiceLang = "en" | "ur" | "snd" | "pan";

export const VOICE_LANGS: Record<
  VoiceLang,
  { label: string; nllbCode: string | null; ttsModel: string }
> = {
  en: { label: "English", nllbCode: null, ttsModel: "facebook/mms-tts-eng" },
  ur: { label: "Urdu", nllbCode: "urd_Arab", ttsModel: "facebook/mms-tts-urd-script_arabic" },
  snd: { label: "Sindhi", nllbCode: "snd_Arab", ttsModel: "facebook/mms-tts-snd" },
  pan: { label: "Punjabi", nllbCode: "pan_Guru", ttsModel: "facebook/mms-tts-pan" },
};

export const NLLB_MODEL = "facebook/nllb-200-distilled-600M";

export function isVoiceLang(v: unknown): v is VoiceLang {
  return v === "en" || v === "ur" || v === "snd" || v === "pan";
}

// Short spoken form of a verdict. Keep it short: HF free inference and
// MMS-TTS are for short demo verdicts, not long paragraphs.
export function buildSpeakText(
  level: string,
  title: string,
  reasons: string[],
): string {
  const text = `${level.toUpperCase()}. ${title}. ${(reasons || []).slice(0, 2).join(" ")}`;
  return text.replace(/\s+/g, " ").trim().slice(0, 500);
}
