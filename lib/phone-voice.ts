// Phone voice: the device's own text-to-speech (Web Speech API).
//
// Why this replaced the server voice: Microsoft Edge synthesis was
// tried from this Vercel deployment in 7 distinct configurations
// (npm client + v1 token, v2 token, Python-client mirror, f53 flow)
// and never returned audio — 403, no WebSocket upgrade, or a close
// with no audio — while the voices-list REST check returned HTTP 200.
// So no server can be trusted for speech here. The phone speaks
// instead: no server audio, no key, no card, nothing to configure.
//
// Rules kept from the old stack, unchanged:
// - The written site and written verdict always stay in English.
//   Only the spoken output changes language, and only when the user
//   taps Listen or starts the voice guide. Never autoplay.
// - Translation still comes from MyMemory (free, no key), verified
//   live in every test; it runs on the server in /api/translate.
// - Never fake audio, never silently fall back to another language:
//   if the phone has no voice for the picked language, the button
//   shows that exact message and plays nothing.
// - Roman Urdu ("ur-rom") has no device locale, so it is spoken by
//   the Urdu voice and stays labelled "(testing)".
//
// Voice matching: exact locale first (ur-PK), then same-language
// prefix (ur) — an accent difference is fine, a different language
// is not. Matching is pure, so it is unit-tested in the recheck loop.

export interface DeviceVoiceLike {
  lang: string;
  name: string;
}

export function normalizeLangTag(tag: string): string {
  return tag.trim().toLowerCase().replace(/_/g, "-");
}

// Device locale to look for. Only Roman Urdu is remapped: it is Urdu
// spoken aloud, so the Urdu voice is the honest match.
export function resolveDeviceLang(lang: string): string {
  return lang === "ur-rom" ? "ur-PK" : lang;
}

export function matchDeviceVoice<T extends DeviceVoiceLike>(
  lang: string,
  voices: T[],
): T | null {
  const want = normalizeLangTag(resolveDeviceLang(lang));
  if (!want) return null;
  const exact = voices.find((v) => normalizeLangTag(v.lang) === want);
  if (exact) return exact;
  const prefix = want.split("-")[0];
  return voices.find((v) => normalizeLangTag(v.lang).split("-")[0] === prefix) ?? null;
}
