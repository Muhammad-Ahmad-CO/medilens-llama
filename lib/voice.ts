// Voice for the hackathon build — phone voice, no server, no key, no card.
//
// Translation: MyMemory (free, no key) English -> target language, via
// /api/translate (verified live in every test).
// Speech: the phone's OWN voice (Web Speech API, lib/phone-voice.ts).
// The server-voice stack is RETIRED 2026-10-28: Microsoft Edge
// synthesis failed from this Vercel deployment in 7 configurations
// (403, no WebSocket upgrade, close with no audio) while the
// voices-list check returned HTTP 200, so no server speech is trusted.
// The written site and written verdict always stay in English. Only
// the spoken output changes language, and only when the user taps
// Listen or starts the voice guide. Never autoplay.
//
// Language table: the locales the site offers for listening. Whether a
// locale actually speaks depends on the PHONE: the dropdown marks
// locales the phone has no voice for, and tapping Listen for one
// shows that exact message instead of playing another language's
// audio. Sindhi therefore counts as working only if the user's phone
// itself has a Sindhi voice — it is not promised by this list.
// Punjabi uses pa-IN (Gurmukhi side), as before. Roman Urdu is
// labelled "(testing)" and is spoken by the Urdu voice.
//
// MyMemory translation is best-effort per language: if it does not
// support a listed locale, the button reports that exact error.

export type VoiceLang = string;

export interface VoiceConfig { label: string; myMemory: string | null; }

export const VOICE_LANGS: Record<string, VoiceConfig> = {
  "af-ZA": { label: "Afrikaans (South Africa)", myMemory: "af" },
  "am-ET": { label: "Amharic (Ethiopia)", myMemory: "am" },
  "ar-AE": { label: "Arabic (UAE)", myMemory: "ar" },
  "ar-BH": { label: "Arabic (Bahrain)", myMemory: "ar" },
  "ar-DZ": { label: "Arabic (Algeria)", myMemory: "ar" },
  "ar-EG": { label: "Arabic (Egypt)", myMemory: "ar" },
  "ar-IQ": { label: "Arabic (Iraq)", myMemory: "ar" },
  "ar-JO": { label: "Arabic (Jordan)", myMemory: "ar" },
  "ar-KW": { label: "Arabic (Kuwait)", myMemory: "ar" },
  "ar-LB": { label: "Arabic (Lebanon)", myMemory: "ar" },
  "ar-LY": { label: "Arabic (Libya)", myMemory: "ar" },
  "ar-MA": { label: "Arabic (Morocco)", myMemory: "ar" },
  "ar-OM": { label: "Arabic (Oman)", myMemory: "ar" },
  "ar-QA": { label: "Arabic (Qatar)", myMemory: "ar" },
  "ar-SA": { label: "Arabic (Saudi Arabia)", myMemory: "ar" },
  "ar-SY": { label: "Arabic (Syria)", myMemory: "ar" },
  "ar-TN": { label: "Arabic (Tunisia)", myMemory: "ar" },
  "ar-YE": { label: "Arabic (Yemen)", myMemory: "ar" },
  "az-AZ": { label: "Azerbaijani (Azerbaijan)", myMemory: "az" },
  "bg-BG": { label: "Bulgarian (Bulgaria)", myMemory: "bg" },
  "bn-BD": { label: "Bengali (Bangladesh)", myMemory: "bn" },
  "bn-IN": { label: "Bengali (India)", myMemory: "bn" },
  "bs-BA": { label: "Bosnian (Bosnia)", myMemory: "bs" },
  "ca-ES": { label: "Catalan (Spain)", myMemory: "ca" },
  "cs-CZ": { label: "Czech (Czechia)", myMemory: "cs" },
  "cy-GB": { label: "Welsh (UK)", myMemory: "cy" },
  "da-DK": { label: "Danish (Denmark)", myMemory: "da" },
  "de-AT": { label: "German (Austria)", myMemory: "de" },
  "de-CH": { label: "German (Switzerland)", myMemory: "de" },
  "de-DE": { label: "German (Germany)", myMemory: "de" },
  "el-GR": { label: "Greek (Greece)", myMemory: "el" },
  "en-AU": { label: "English (Australia)", myMemory: null },
  "en-CA": { label: "English (Canada)", myMemory: null },
  "en-GB": { label: "English (UK)", myMemory: null },
  "en-HK": { label: "English (Hong Kong)", myMemory: null },
  "en-IE": { label: "English (Ireland)", myMemory: null },
  "en-IN": { label: "English (India)", myMemory: null },
  "en-KE": { label: "English (Kenya)", myMemory: null },
  "en-NG": { label: "English (Nigeria)", myMemory: null },
  "en-NZ": { label: "English (New Zealand)", myMemory: null },
  "en-PH": { label: "English (Philippines)", myMemory: null },
  "en-SG": { label: "English (Singapore)", myMemory: null },
  "en-TZ": { label: "English (Tanzania)", myMemory: null },
  "en-US": { label: "English (United States)", myMemory: null },
  "en-ZA": { label: "English (South Africa)", myMemory: null },
  "es-AR": { label: "Spanish (Argentina)", myMemory: "es" },
  "es-BO": { label: "Spanish (Bolivia)", myMemory: "es" },
  "es-CL": { label: "Spanish (Chile)", myMemory: "es" },
  "es-CO": { label: "Spanish (Colombia)", myMemory: "es" },
  "es-CR": { label: "Spanish (Costa Rica)", myMemory: "es" },
  "es-CU": { label: "Spanish (Cuba)", myMemory: "es" },
  "es-DO": { label: "Spanish (Dominican Republic)", myMemory: "es" },
  "es-EC": { label: "Spanish (Ecuador)", myMemory: "es" },
  "es-ES": { label: "Spanish (Spain)", myMemory: "es" },
  "es-GQ": { label: "Spanish (Equatorial Guinea)", myMemory: "es" },
  "es-GT": { label: "Spanish (Guatemala)", myMemory: "es" },
  "es-HN": { label: "Spanish (Honduras)", myMemory: "es" },
  "es-MX": { label: "Spanish (Mexico)", myMemory: "es" },
  "es-NI": { label: "Spanish (Nicaragua)", myMemory: "es" },
  "es-PA": { label: "Spanish (Panama)", myMemory: "es" },
  "es-PE": { label: "Spanish (Peru)", myMemory: "es" },
  "es-PR": { label: "Spanish (Puerto Rico)", myMemory: "es" },
  "es-PY": { label: "Spanish (Paraguay)", myMemory: "es" },
  "es-SV": { label: "Spanish (El Salvador)", myMemory: "es" },
  "es-US": { label: "Spanish (United States)", myMemory: "es" },
  "es-UY": { label: "Spanish (Uruguay)", myMemory: "es" },
  "es-VE": { label: "Spanish (Venezuela)", myMemory: "es" },
  "et-EE": { label: "Estonian (Estonia)", myMemory: "et" },
  "fa-IR": { label: "Persian (Iran)", myMemory: "fa" },
  "fi-FI": { label: "Finnish (Finland)", myMemory: "fi" },
  "fil-PH": { label: "Filipino (Philippines)", myMemory: "tl" },
  "fr-BE": { label: "French (Belgium)", myMemory: "fr" },
  "fr-CA": { label: "French (Canada)", myMemory: "fr" },
  "fr-CH": { label: "French (Switzerland)", myMemory: "fr" },
  "fr-FR": { label: "French (FR)", myMemory: "fr" },
  "ga-IE": { label: "Irish (Ireland)", myMemory: "ga" },
  "gl-ES": { label: "Galician (Spain)", myMemory: "gl" },
  "gu-IN": { label: "Gujarati (India)", myMemory: "gu" },
  "he-IL": { label: "Hebrew (IL)", myMemory: "he" },
  "hi-IN": { label: "Hindi (India)", myMemory: "hi" },
  "hr-HR": { label: "Croatian (Croatia)", myMemory: "hr" },
  "hu-HU": { label: "Hungarian (Hungary)", myMemory: "hu" },
  "id-ID": { label: "Indonesian (Indonesia)", myMemory: "id" },
  "is-IS": { label: "Icelandic (Iceland)", myMemory: "is" },
  "it-IT": { label: "Italian (Italy)", myMemory: "it" },
  "ja-JP": { label: "Japanese (Japan)", myMemory: "ja" },
  "jv-ID": { label: "Javanese (Indonesia)", myMemory: "jv" },
  "ka-GE": { label: "Georgian (Georgia)", myMemory: "ka" },
  "kk-KZ": { label: "Kazakh (Kazakhstan)", myMemory: "kk" },
  "km-KH": { label: "Khmer (Cambodia)", myMemory: "km" },
  "kn-IN": { label: "Kannada (India)", myMemory: "kn" },
  "ko-KR": { label: "Korean (South Korea)", myMemory: "ko" },
  "lo-LA": { label: "Lao (Laos)", myMemory: "lo" },
  "lt-LT": { label: "Lithuanian (Lithuania)", myMemory: "lt" },
  "lv-LV": { label: "Latvian (Latvia)", myMemory: "lv" },
  "mk-MK": { label: "Macedonian (North Macedonia)", myMemory: "mk" },
  "ml-IN": { label: "Malayalam (India)", myMemory: "ml" },
  "mn-MN": { label: "Mongolian (Mongolia)", myMemory: "mn" },
  "mr-IN": { label: "Marathi (India)", myMemory: "mr" },
  "ms-MY": { label: "Malay (Malaysia)", myMemory: "ms" },
  "mt-MT": { label: "Maltese (Malta)", myMemory: "mt" },
  "my-MM": { label: "Burmese (Myanmar)", myMemory: "my" },
  "nb-NO": { label: "Norwegian (Norway)", myMemory: "no" },
  "ne-NP": { label: "Nepali (Nepal)", myMemory: "ne" },
  "nl-BE": { label: "Dutch (Belgium)", myMemory: "nl" },
  "nl-NL": { label: "Dutch (NL)", myMemory: "nl" },
  "pa-IN": { label: "Punjabi (India)", myMemory: "pa" },
  "pl-PL": { label: "Polish (PL)", myMemory: "pl" },
  "ps-AF": { label: "Pashto (Afghanistan)", myMemory: "ps" },
  "pt-BR": { label: "Portuguese (Brazil)", myMemory: "pt" },
  "pt-PT": { label: "Portuguese (Portugal)", myMemory: "pt" },
  "ro-RO": { label: "Romanian (Romania)", myMemory: "ro" },
  "ru-RU": { label: "Russian (Russia)", myMemory: "ru" },
  "sd": { label: "Sindhi (Pakistan)", myMemory: "sd" },
  "si-LK": { label: "Sinhala (Sri Lanka)", myMemory: "si" },
  "sk-SK": { label: "Slovak (Slovakia)", myMemory: "sk" },
  "sl-SI": { label: "Slovenian (Slovenia)", myMemory: "sl" },
  "so-SO": { label: "Somali (Somalia)", myMemory: "so" },
  "sq-AL": { label: "Albanian (Albania)", myMemory: "sq" },
  "sr-RS": { label: "Serbian (Serbia)", myMemory: "sr" },
  "su-ID": { label: "Sundanese (Indonesia)", myMemory: "su" },
  "sv-SE": { label: "Swedish (Sweden)", myMemory: "sv" },
  "sw-KE": { label: "Swahili (Kenya)", myMemory: "sw" },
  "sw-TZ": { label: "Swahili (Tanzania)", myMemory: "sw" },
  "ta-IN": { label: "Tamil (India)", myMemory: "ta" },
  "ta-LK": { label: "Tamil (Sri Lanka)", myMemory: "ta" },
  "ta-MY": { label: "Tamil (Malaysia)", myMemory: "ta" },
  "ta-SG": { label: "Tamil (Singapore)", myMemory: "ta" },
  "te-IN": { label: "Telugu (India)", myMemory: "te" },
  "th-TH": { label: "Thai (Thailand)", myMemory: "th" },
  "tr-TR": { label: "Turkish (Turkey)", myMemory: "tr" },
  "uk-UA": { label: "Ukrainian (Ukraine)", myMemory: "uk" },
  "ur-IN": { label: "Urdu (India)", myMemory: "ur" },
  "ur-PK": { label: "Urdu (Pakistan)", myMemory: "ur" },
  "uz-UZ": { label: "Uzbek (Uzbekistan)", myMemory: "uz" },
  "vi-VN": { label: "Vietnamese (Vietnam)", myMemory: "vi" },
  "zh-CN": { label: "Chinese (China)", myMemory: "zh-CN" },
  "zh-HK": { label: "Chinese (Hong Kong)", myMemory: "zh-CN" },
  "zh-TW": { label: "Chinese (Taiwan)", myMemory: "zh-CN" },
  "zu-ZA": { label: "Zulu (South Africa)", myMemory: "zu" },
  "ur-rom": { label: "Roman Urdu (testing)", myMemory: "ur" },
};

export function isVoiceLang(v: unknown): v is string {
  // hasOwnProperty, NOT `in`: `in` also matches inherited properties, so
  // a lang of "constructor" would wrongly pass and then crash the lookup.
  return (
    typeof v === "string" &&
    Object.prototype.hasOwnProperty.call(VOICE_LANGS, v)
  );
}

// Short spoken form of a verdict. Keep it short: demo verdicts only,
// not long paragraphs.
export function buildSpeakText(
  level: string,
  title: string,
  reasons: string[],
): string {
  const text = `${level.toUpperCase()}. ${title}. ${(reasons || []).slice(0, 2).join(" ")}`;
  return text.replace(/\s+/g, " ").trim().slice(0, 500);
}

// Voice-guide prompts (Feature 2). Written in English on the page;
// spoken in the user's selected guide language by the phone's own voice.
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
