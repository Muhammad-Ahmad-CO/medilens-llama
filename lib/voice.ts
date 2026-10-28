// Voice for the hackathon build — free server stack, no key, no card.
//
// Translation: MyMemory (free, no key) English -> target language.
// Speech: Microsoft Edge neural voices via the `edge-tts` npm package
// (free, no key). The written site and written verdict always stay in
// English. Only the spoken output changes language, and only when the
// user taps Listen or starts the voice guide. Never autoplay.
//
// Language table: EVERY Microsoft Edge locale with a voice (from the
// Edge voice catalog), one voice per locale (female preferred).
// Sindhi is NOT in this table: Edge has no Sindhi voice, so Sindhi
// cannot be spoken by this stack — the route returns an exact error
// for it instead of playing another language's audio and calling it
// Sindhi. Balochi and Saraiki are likewise absent from Edge.
// Punjabi uses pa-IN voices (Gurmukhi side), as before.
//
// MyMemory translation is best-effort per language: if it does not
// support a listed locale, /api/speak reports that exact error.
// Edge is an unofficial free service (no key): Microsoft can change
// it, so the phone test is the proof for each language, not this list.

export type VoiceLang = string;

export interface VoiceConfig { label: string; voice: string; myMemory: string | null; }

export const VOICE_LANGS: Record<string, VoiceConfig> = {
  "af-ZA": { label: "Afrikaans (South Africa)", voice: "af-ZA-AdriNeural", myMemory: "af" },
  "am-ET": { label: "Amharic (Ethiopia)", voice: "am-ET-MekdesNeural", myMemory: "am" },
  "ar-AE": { label: "Arabic (UAE)", voice: "ar-AE-FatimaNeural", myMemory: "ar" },
  "ar-BH": { label: "Arabic (Bahrain)", voice: "ar-BH-LailaNeural", myMemory: "ar" },
  "ar-DZ": { label: "Arabic (Algeria)", voice: "ar-DZ-AminaNeural", myMemory: "ar" },
  "ar-EG": { label: "Arabic (Egypt)", voice: "ar-EG-SalmaNeural", myMemory: "ar" },
  "ar-IQ": { label: "Arabic (Iraq)", voice: "ar-IQ-RanaNeural", myMemory: "ar" },
  "ar-JO": { label: "Arabic (Jordan)", voice: "ar-JO-SanaNeural", myMemory: "ar" },
  "ar-KW": { label: "Arabic (Kuwait)", voice: "ar-KW-NouraNeural", myMemory: "ar" },
  "ar-LB": { label: "Arabic (Lebanon)", voice: "ar-LB-LaylaNeural", myMemory: "ar" },
  "ar-LY": { label: "Arabic (Libya)", voice: "ar-LY-ImanNeural", myMemory: "ar" },
  "ar-MA": { label: "Arabic (Morocco)", voice: "ar-MA-MounaNeural", myMemory: "ar" },
  "ar-OM": { label: "Arabic (Oman)", voice: "ar-OM-AyshaNeural", myMemory: "ar" },
  "ar-QA": { label: "Arabic (Qatar)", voice: "ar-QA-AmalNeural", myMemory: "ar" },
  "ar-SA": { label: "Arabic (Saudi Arabia)", voice: "ar-SA-ZariyahNeural", myMemory: "ar" },
  "ar-SY": { label: "Arabic (Syria)", voice: "ar-SY-AmanyNeural", myMemory: "ar" },
  "ar-TN": { label: "Arabic (Tunisia)", voice: "ar-TN-ReemNeural", myMemory: "ar" },
  "ar-YE": { label: "Arabic (Yemen)", voice: "ar-YE-MaryamNeural", myMemory: "ar" },
  "az-AZ": { label: "Azerbaijani (Azerbaijan)", voice: "az-AZ-BanuNeural", myMemory: "az" },
  "bg-BG": { label: "Bulgarian (Bulgaria)", voice: "bg-BG-KalinaNeural", myMemory: "bg" },
  "bn-BD": { label: "Bengali (Bangladesh)", voice: "bn-BD-NabanitaNeural", myMemory: "bn" },
  "bn-IN": { label: "Bengali (India)", voice: "bn-IN-TanishaaNeural", myMemory: "bn" },
  "bs-BA": { label: "Bosnian (Bosnia)", voice: "bs-BA-VesnaNeural", myMemory: "bs" },
  "ca-ES": { label: "Catalan (Spain)", voice: "ca-ES-JoanaNeural", myMemory: "ca" },
  "cs-CZ": { label: "Czech (Czechia)", voice: "cs-CZ-VlastaNeural", myMemory: "cs" },
  "cy-GB": { label: "Welsh (UK)", voice: "cy-GB-NiaNeural", myMemory: "cy" },
  "da-DK": { label: "Danish (Denmark)", voice: "da-DK-ChristelNeural", myMemory: "da" },
  "de-AT": { label: "German (Austria)", voice: "de-AT-IngridNeural", myMemory: "de" },
  "de-CH": { label: "German (Switzerland)", voice: "de-CH-LeniNeural", myMemory: "de" },
  "de-DE": { label: "German (Germany)", voice: "de-DE-AmalaNeural", myMemory: "de" },
  "el-GR": { label: "Greek (Greece)", voice: "el-GR-AthinaNeural", myMemory: "el" },
  "en-AU": { label: "English (Australia)", voice: "en-AU-NatashaNeural", myMemory: null },
  "en-CA": { label: "English (Canada)", voice: "en-CA-ClaraNeural", myMemory: null },
  "en-GB": { label: "English (UK)", voice: "en-GB-LibbyNeural", myMemory: null },
  "en-HK": { label: "English (Hong Kong)", voice: "en-HK-YanNeural", myMemory: null },
  "en-IE": { label: "English (Ireland)", voice: "en-IE-EmilyNeural", myMemory: null },
  "en-IN": { label: "English (India)", voice: "en-IN-NeerjaExpressiveNeural", myMemory: null },
  "en-KE": { label: "English (Kenya)", voice: "en-KE-AsiliaNeural", myMemory: null },
  "en-NG": { label: "English (Nigeria)", voice: "en-NG-EzinneNeural", myMemory: null },
  "en-NZ": { label: "English (New Zealand)", voice: "en-NZ-MollyNeural", myMemory: null },
  "en-PH": { label: "English (Philippines)", voice: "en-PH-RosaNeural", myMemory: null },
  "en-SG": { label: "English (Singapore)", voice: "en-SG-LunaNeural", myMemory: null },
  "en-TZ": { label: "English (Tanzania)", voice: "en-TZ-ImaniNeural", myMemory: null },
  "en-US": { label: "English (United States)", voice: "en-US-AriaNeural", myMemory: null },
  "en-ZA": { label: "English (South Africa)", voice: "en-ZA-LeahNeural", myMemory: null },
  "es-AR": { label: "Spanish (Argentina)", voice: "es-AR-ElenaNeural", myMemory: "es" },
  "es-BO": { label: "Spanish (Bolivia)", voice: "es-BO-SofiaNeural", myMemory: "es" },
  "es-CL": { label: "Spanish (Chile)", voice: "es-CL-CatalinaNeural", myMemory: "es" },
  "es-CO": { label: "Spanish (Colombia)", voice: "es-CO-SalomeNeural", myMemory: "es" },
  "es-CR": { label: "Spanish (Costa Rica)", voice: "es-CR-MariaNeural", myMemory: "es" },
  "es-CU": { label: "Spanish (Cuba)", voice: "es-CU-BelkysNeural", myMemory: "es" },
  "es-DO": { label: "Spanish (Dominican Republic)", voice: "es-DO-RamonaNeural", myMemory: "es" },
  "es-EC": { label: "Spanish (Ecuador)", voice: "es-EC-AndreaNeural", myMemory: "es" },
  "es-ES": { label: "Spanish (Spain)", voice: "es-ES-ElviraNeural", myMemory: "es" },
  "es-GQ": { label: "Spanish (Equatorial Guinea)", voice: "es-GQ-TeresaNeural", myMemory: "es" },
  "es-GT": { label: "Spanish (Guatemala)", voice: "es-GT-MartaNeural", myMemory: "es" },
  "es-HN": { label: "Spanish (Honduras)", voice: "es-HN-KarlaNeural", myMemory: "es" },
  "es-MX": { label: "Spanish (Mexico)", voice: "es-MX-DaliaNeural", myMemory: "es" },
  "es-NI": { label: "Spanish (Nicaragua)", voice: "es-NI-YolandaNeural", myMemory: "es" },
  "es-PA": { label: "Spanish (Panama)", voice: "es-PA-MargaritaNeural", myMemory: "es" },
  "es-PE": { label: "Spanish (Peru)", voice: "es-PE-CamilaNeural", myMemory: "es" },
  "es-PR": { label: "Spanish (Puerto Rico)", voice: "es-PR-KarinaNeural", myMemory: "es" },
  "es-PY": { label: "Spanish (Paraguay)", voice: "es-PY-TaniaNeural", myMemory: "es" },
  "es-SV": { label: "Spanish (El Salvador)", voice: "es-SV-LorenaNeural", myMemory: "es" },
  "es-US": { label: "Spanish (United States)", voice: "es-US-PalomaNeural", myMemory: "es" },
  "es-UY": { label: "Spanish (Uruguay)", voice: "es-UY-ValentinaNeural", myMemory: "es" },
  "es-VE": { label: "Spanish (Venezuela)", voice: "es-VE-PaolaNeural", myMemory: "es" },
  "et-EE": { label: "Estonian (Estonia)", voice: "et-EE-AnuNeural", myMemory: "et" },
  "fa-IR": { label: "Persian (Iran)", voice: "fa-IR-DilaraNeural", myMemory: "fa" },
  "fi-FI": { label: "Finnish (Finland)", voice: "fi-FI-NooraNeural", myMemory: "fi" },
  "fil-PH": { label: "Filipino (Philippines)", voice: "fil-PH-BlessicaNeural", myMemory: "tl" },
  "fr-BE": { label: "French (Belgium)", voice: "fr-BE-CharlineNeural", myMemory: "fr" },
  "fr-CA": { label: "French (Canada)", voice: "fr-CA-SylvieNeural", myMemory: "fr" },
  "fr-CH": { label: "French (Switzerland)", voice: "fr-CH-ArianeNeural", myMemory: "fr" },
  "fr-FR": { label: "French (FR)", voice: "fr-FR-DeniseNeural", myMemory: "fr" },
  "ga-IE": { label: "Irish (Ireland)", voice: "ga-IE-OrlaNeural", myMemory: "ga" },
  "gl-ES": { label: "Galician (Spain)", voice: "gl-ES-SabelaNeural", myMemory: "gl" },
  "gu-IN": { label: "Gujarati (India)", voice: "gu-IN-DhwaniNeural", myMemory: "gu" },
  "he-IL": { label: "Hebrew (IL)", voice: "he-IL-HilaNeural", myMemory: "he" },
  "hi-IN": { label: "Hindi (India)", voice: "hi-IN-SwaraNeural", myMemory: "hi" },
  "hr-HR": { label: "Croatian (Croatia)", voice: "hr-HR-GabrijelaNeural", myMemory: "hr" },
  "hu-HU": { label: "Hungarian (Hungary)", voice: "hu-HU-NoemiNeural", myMemory: "hu" },
  "id-ID": { label: "Indonesian (Indonesia)", voice: "id-ID-GadisNeural", myMemory: "id" },
  "is-IS": { label: "Icelandic (Iceland)", voice: "is-IS-GudrunNeural", myMemory: "is" },
  "it-IT": { label: "Italian (Italy)", voice: "it-IT-ElsaNeural", myMemory: "it" },
  "ja-JP": { label: "Japanese (Japan)", voice: "ja-JP-NanamiNeural", myMemory: "ja" },
  "jv-ID": { label: "Javanese (Indonesia)", voice: "jv-ID-SitiNeural", myMemory: "jv" },
  "ka-GE": { label: "Georgian (Georgia)", voice: "ka-GE-EkaNeural", myMemory: "ka" },
  "kk-KZ": { label: "Kazakh (Kazakhstan)", voice: "kk-KZ-AigulNeural", myMemory: "kk" },
  "km-KH": { label: "Khmer (Cambodia)", voice: "km-KH-SreymomNeural", myMemory: "km" },
  "kn-IN": { label: "Kannada (India)", voice: "kn-IN-SapnaNeural", myMemory: "kn" },
  "ko-KR": { label: "Korean (South Korea)", voice: "ko-KR-SunHiNeural", myMemory: "ko" },
  "lo-LA": { label: "Lao (Laos)", voice: "lo-LA-KeomanyNeural", myMemory: "lo" },
  "lt-LT": { label: "Lithuanian (Lithuania)", voice: "lt-LT-OnaNeural", myMemory: "lt" },
  "lv-LV": { label: "Latvian (Latvia)", voice: "lv-LV-EveritaNeural", myMemory: "lv" },
  "mk-MK": { label: "Macedonian (North Macedonia)", voice: "mk-MK-MarijaNeural", myMemory: "mk" },
  "ml-IN": { label: "Malayalam (India)", voice: "ml-IN-SobhanaNeural", myMemory: "ml" },
  "mn-MN": { label: "Mongolian (Mongolia)", voice: "mn-MN-YesuiNeural", myMemory: "mn" },
  "mr-IN": { label: "Marathi (India)", voice: "mr-IN-AarohiNeural", myMemory: "mr" },
  "ms-MY": { label: "Malay (Malaysia)", voice: "ms-MY-YasminNeural", myMemory: "ms" },
  "mt-MT": { label: "Maltese (Malta)", voice: "mt-MT-GraceNeural", myMemory: "mt" },
  "my-MM": { label: "Burmese (Myanmar)", voice: "my-MM-NilarNeural", myMemory: "my" },
  "nb-NO": { label: "Norwegian (Norway)", voice: "nb-NO-PernilleNeural", myMemory: "no" },
  "ne-NP": { label: "Nepali (Nepal)", voice: "ne-NP-HemkalaNeural", myMemory: "ne" },
  "nl-BE": { label: "Dutch (Belgium)", voice: "nl-BE-DenaNeural", myMemory: "nl" },
  "nl-NL": { label: "Dutch (NL)", voice: "nl-NL-ColetteNeural", myMemory: "nl" },
  "pa-IN": { label: "Punjabi (India)", voice: "pa-IN-VaaniNeural", myMemory: "pa" },
  "pl-PL": { label: "Polish (PL)", voice: "pl-PL-ZofiaNeural", myMemory: "pl" },
  "ps-AF": { label: "Pashto (Afghanistan)", voice: "ps-AF-LatifaNeural", myMemory: "ps" },
  "pt-BR": { label: "Portuguese (Brazil)", voice: "pt-BR-FranciscaNeural", myMemory: "pt" },
  "pt-PT": { label: "Portuguese (Portugal)", voice: "pt-PT-RaquelNeural", myMemory: "pt" },
  "ro-RO": { label: "Romanian (Romania)", voice: "ro-RO-AlinaNeural", myMemory: "ro" },
  "ru-RU": { label: "Russian (Russia)", voice: "ru-RU-SvetlanaNeural", myMemory: "ru" },
  "si-LK": { label: "Sinhala (Sri Lanka)", voice: "si-LK-ThiliniNeural", myMemory: "si" },
  "sk-SK": { label: "Slovak (Slovakia)", voice: "sk-SK-ViktoriaNeural", myMemory: "sk" },
  "sl-SI": { label: "Slovenian (Slovenia)", voice: "sl-SI-PetraNeural", myMemory: "sl" },
  "so-SO": { label: "Somali (Somalia)", voice: "so-SO-UbaxNeural", myMemory: "so" },
  "sq-AL": { label: "Albanian (Albania)", voice: "sq-AL-AnilaNeural", myMemory: "sq" },
  "sr-RS": { label: "Serbian (Serbia)", voice: "sr-RS-SophieNeural", myMemory: "sr" },
  "su-ID": { label: "Sundanese (Indonesia)", voice: "su-ID-TutiNeural", myMemory: "su" },
  "sv-SE": { label: "Swedish (Sweden)", voice: "sv-SE-SofieNeural", myMemory: "sv" },
  "sw-KE": { label: "Swahili (Kenya)", voice: "sw-KE-ZuriNeural", myMemory: "sw" },
  "sw-TZ": { label: "Swahili (Tanzania)", voice: "sw-TZ-RehemaNeural", myMemory: "sw" },
  "ta-IN": { label: "Tamil (India)", voice: "ta-IN-PallaviNeural", myMemory: "ta" },
  "ta-LK": { label: "Tamil (Sri Lanka)", voice: "ta-LK-SaranyaNeural", myMemory: "ta" },
  "ta-MY": { label: "Tamil (Malaysia)", voice: "ta-MY-KaniNeural", myMemory: "ta" },
  "ta-SG": { label: "Tamil (Singapore)", voice: "ta-SG-VenbaNeural", myMemory: "ta" },
  "te-IN": { label: "Telugu (India)", voice: "te-IN-ShrutiNeural", myMemory: "te" },
  "th-TH": { label: "Thai (Thailand)", voice: "th-TH-PremwadeeNeural", myMemory: "th" },
  "tr-TR": { label: "Turkish (Turkey)", voice: "tr-TR-EmelNeural", myMemory: "tr" },
  "uk-UA": { label: "Ukrainian (Ukraine)", voice: "uk-UA-PolinaNeural", myMemory: "uk" },
  "ur-IN": { label: "Urdu (India)", voice: "ur-IN-GulNeural", myMemory: "ur" },
  "ur-PK": { label: "Urdu (Pakistan)", voice: "ur-PK-UzmaNeural", myMemory: "ur" },
  "uz-UZ": { label: "Uzbek (Uzbekistan)", voice: "uz-UZ-MadinaNeural", myMemory: "uz" },
  "vi-VN": { label: "Vietnamese (Vietnam)", voice: "vi-VN-HoaiMyNeural", myMemory: "vi" },
  "zh-CN": { label: "Chinese (China)", voice: "zh-CN-XiaoxiaoNeural", myMemory: "zh-CN" },
  "zh-HK": { label: "Chinese (Hong Kong)", voice: "zh-HK-HiuGaaiNeural", myMemory: "zh-CN" },
  "zh-TW": { label: "Chinese (Taiwan)", voice: "zh-TW-HsiaoChenNeural", myMemory: "zh-CN" },
  "zu-ZA": { label: "Zulu (South Africa)", voice: "zu-ZA-ThandoNeural", myMemory: "zu" },
  "ur-rom": { label: "Roman Urdu (testing)", voice: "ur-PK-UzmaNeural", myMemory: "ur" },
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
