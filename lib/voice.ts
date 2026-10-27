// Voice for the hackathon build — free Meta models only, no card, no endpoint.
//
// Translation: Meta NLLB, facebook/nllb-200-distilled-600M, via the
// Hugging Face Inference API (HF_TOKEN in server env only, never in chat/repo).
// Voice: Meta MMS-TTS (Massively Multilingual Speech), also via HF Inference API.
// The written site and written verdict always stay in English. Only the
// spoken output changes language, and only when the user taps Listen or
// starts the voice guide. Never autoplay.
//
// Language table (50 languages, Feature 2 expansion):
//   en  — no translation, facebook/mms-tts-eng (confirmed)
//   ur  — NLLB urd_Arab, facebook/mms-tts-urd-script_arabic (confirmed)
//   pan — NLLB pan_Guru (Gurmukhi side), facebook/mms-tts-pan
//         (listed as Punjabi, Eastern — may not match Shahmukhi perfectly)
//   snd — NLLB snd_Arab, facebook/mms-tts-snd
//         Sindhi voice checkpoint is UNVERIFIED at build time: if HF returns
//         404 / "model not found" for this ID, /api/speak reports that exact
//         error instead of playing Urdu audio and calling it Sindhi.
//         Do not promise Sindhi speech until a live phone test passes.
//   ur-rom — Roman Urdu (testing): spoken Urdu is the same language
//         regardless of script, so it uses the Urdu pipeline (urd_Arab +
//         urd-script_arabic) and is labelled "(testing)" in the UI until a
//         live test confirms it. Never fake a separate Roman Urdu voice.
//   Other languages: NLLB Flores-200 codes + MMS-TTS model IDs built from
//         ISO 639-3 codes (facebook/mms-tts-<code>). MMS covers 1000+
//         languages, but the rare codes here (bal, skr, pus, pes, msa, nob,
//         cmn) are NOT live-verified at build time. The exact-error rule
//         applies to all of them: a 404 reports the exact model ID, never
//         a silent fallback to English.
//
// HF token permission note (2026): the legacy serverless Inference API
// works with a Read token, but HF's newer Inference Providers routing may
// require a fine-grained token with "Make calls to Inference Providers"
// enabled. If HF returns 401/403, that is the first thing to fix in
// Hugging Face Settings -> Access Tokens — never by putting a token in chat.

export type VoiceLang =
  | "en" | "ur" | "snd" | "pan" | "ur-rom"
  | "ar" | "fr" | "es" | "de" | "it" | "pt" | "ru"
  | "zh" | "ja" | "ko"
  | "hi" | "bn" | "ta" | "te" | "mr" | "gu" | "ml" | "kn"
  | "ne" | "si" | "th" | "vi" | "id" | "ms"
  | "tr" | "fa" | "ps" | "bal" | "skr"
  | "nl" | "sv" | "no" | "da" | "fi"
  | "pl" | "uk" | "cs" | "ro" | "el"
  | "he" | "hu" | "sw" | "ha" | "am" | "so";

export const VOICE_LANGS: Record<
  VoiceLang,
  { label: string; nllbCode: string | null; ttsModel: string }
> = {
  en: { label: "English", nllbCode: null, ttsModel: "facebook/mms-tts-eng" },
  ur: { label: "Urdu", nllbCode: "urd_Arab", ttsModel: "facebook/mms-tts-urd-script_arabic" },
  snd: { label: "Sindhi", nllbCode: "snd_Arab", ttsModel: "facebook/mms-tts-snd" },
  pan: { label: "Punjabi", nllbCode: "pan_Guru", ttsModel: "facebook/mms-tts-pan" },
  "ur-rom": { label: "Roman Urdu (testing)", nllbCode: "urd_Arab", ttsModel: "facebook/mms-tts-urd-script_arabic" },
  ar: { label: "Arabic", nllbCode: "arb_Arab", ttsModel: "facebook/mms-tts-ara" },
  fr: { label: "French", nllbCode: "fra_Latn", ttsModel: "facebook/mms-tts-fra" },
  es: { label: "Spanish", nllbCode: "spa_Latn", ttsModel: "facebook/mms-tts-spa" },
  de: { label: "German", nllbCode: "deu_Latn", ttsModel: "facebook/mms-tts-deu" },
  it: { label: "Italian", nllbCode: "ita_Latn", ttsModel: "facebook/mms-tts-ita" },
  pt: { label: "Portuguese", nllbCode: "por_Latn", ttsModel: "facebook/mms-tts-por" },
  ru: { label: "Russian", nllbCode: "rus_Cyrl", ttsModel: "facebook/mms-tts-rus" },
  zh: { label: "Mandarin Chinese", nllbCode: "zho_Hans", ttsModel: "facebook/mms-tts-cmn" },
  ja: { label: "Japanese", nllbCode: "jpn_Jpan", ttsModel: "facebook/mms-tts-jpn" },
  ko: { label: "Korean", nllbCode: "kor_Hang", ttsModel: "facebook/mms-tts-kor" },
  hi: { label: "Hindi", nllbCode: "hin_Deva", ttsModel: "facebook/mms-tts-hin" },
  bn: { label: "Bengali", nllbCode: "ben_Beng", ttsModel: "facebook/mms-tts-ben" },
  ta: { label: "Tamil", nllbCode: "tam_Taml", ttsModel: "facebook/mms-tts-tam" },
  te: { label: "Telugu", nllbCode: "tel_Telu", ttsModel: "facebook/mms-tts-tel" },
  mr: { label: "Marathi", nllbCode: "mar_Deva", ttsModel: "facebook/mms-tts-mar" },
  gu: { label: "Gujarati", nllbCode: "guj_Gujr", ttsModel: "facebook/mms-tts-guj" },
  ml: { label: "Malayalam", nllbCode: "mal_Mlym", ttsModel: "facebook/mms-tts-mal" },
  kn: { label: "Kannada", nllbCode: "kan_Knda", ttsModel: "facebook/mms-tts-kan" },
  ne: { label: "Nepali", nllbCode: "nep_Deva", ttsModel: "facebook/mms-tts-nep" },
  si: { label: "Sinhala", nllbCode: "sin_Sinh", ttsModel: "facebook/mms-tts-sin" },
  th: { label: "Thai", nllbCode: "tha_Thai", ttsModel: "facebook/mms-tts-tha" },
  vi: { label: "Vietnamese", nllbCode: "vie_Latn", ttsModel: "facebook/mms-tts-vie" },
  id: { label: "Indonesian", nllbCode: "ind_Latn", ttsModel: "facebook/mms-tts-ind" },
  ms: { label: "Malay", nllbCode: "zsm_Latn", ttsModel: "facebook/mms-tts-msa" },
  tr: { label: "Turkish", nllbCode: "tur_Latn", ttsModel: "facebook/mms-tts-tur" },
  fa: { label: "Persian", nllbCode: "pes_Arab", ttsModel: "facebook/mms-tts-pes" },
  ps: { label: "Pashto", nllbCode: "pus_Arab", ttsModel: "facebook/mms-tts-pus" },
  bal: { label: "Balochi", nllbCode: "bal_Arab", ttsModel: "facebook/mms-tts-bal" },
  skr: { label: "Saraiki", nllbCode: "skr_Arab", ttsModel: "facebook/mms-tts-skr" },
  nl: { label: "Dutch", nllbCode: "nld_Latn", ttsModel: "facebook/mms-tts-nld" },
  sv: { label: "Swedish", nllbCode: "swe_Latn", ttsModel: "facebook/mms-tts-swe" },
  no: { label: "Norwegian", nllbCode: "nob_Latn", ttsModel: "facebook/mms-tts-nob" },
  da: { label: "Danish", nllbCode: "dan_Latn", ttsModel: "facebook/mms-tts-dan" },
  fi: { label: "Finnish", nllbCode: "fin_Latn", ttsModel: "facebook/mms-tts-fin" },
  pl: { label: "Polish", nllbCode: "pol_Latn", ttsModel: "facebook/mms-tts-pol" },
  uk: { label: "Ukrainian", nllbCode: "ukr_Cyrl", ttsModel: "facebook/mms-tts-ukr" },
  cs: { label: "Czech", nllbCode: "ces_Latn", ttsModel: "facebook/mms-tts-ces" },
  ro: { label: "Romanian", nllbCode: "ron_Latn", ttsModel: "facebook/mms-tts-ron" },
  el: { label: "Greek", nllbCode: "ell_Grek", ttsModel: "facebook/mms-tts-ell" },
  he: { label: "Hebrew", nllbCode: "heb_Hebr", ttsModel: "facebook/mms-tts-heb" },
  hu: { label: "Hungarian", nllbCode: "hun_Latn", ttsModel: "facebook/mms-tts-hun" },
  sw: { label: "Swahili", nllbCode: "swh_Latn", ttsModel: "facebook/mms-tts-swh" },
  ha: { label: "Hausa", nllbCode: "hau_Latn", ttsModel: "facebook/mms-tts-hau" },
  am: { label: "Amharic", nllbCode: "amh_Ethi", ttsModel: "facebook/mms-tts-amh" },
  so: { label: "Somali", nllbCode: "som_Latn", ttsModel: "facebook/mms-tts-som" },
};

export const NLLB_MODEL = "facebook/nllb-200-distilled-600M";

export function isVoiceLang(v: unknown): v is VoiceLang {
  // hasOwnProperty, NOT `in`: `in` also matches inherited properties, so
  // a lang of "constructor" would wrongly pass and then crash the lookup.
  return (
    typeof v === "string" &&
    Object.prototype.hasOwnProperty.call(VOICE_LANGS, v)
  );
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

// Voice-guide prompts (Feature 2). Written in English on the page;
// spoken in the user's selected guide language via /api/speak.
export const GUIDE_STEPS: string[] = [
  "Show the front of the pack",
  "Now show the side with batch and expiry",
  "Now show the full pack and seal",
];

// Spoken when a scan result is uncertain (confidence below 0.6). This is
// the honest trigger for the "blurry" prompt: there is no separate blur
// detector in this round (photo-quality check is explicitly out of scope),
// so low reading confidence is what triggers it.
export const BLURRY_PROMPT = "Photo is blurry, please retake.";
