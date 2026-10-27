# MediLens — Meta Global AI Developer Hackathon MVP
Indie track, theme: Build for Your World. Built fresh during the hackathon window (27 Oct – 4 Nov 2026).
This is NOT the old MediLens repo: new code, new repo, MVP scope only.

## What it does
Phone photo of a medicine pack -> Meta Muse vision reads drug name, maker, batch, expiry ->
rule-based GREEN / AMBER / RED screening verdict with reasons.

Rules: expired = RED. Unknown drug = RED. No drug name readable = RED.
Missing batch or expiry = AMBER. Maker mismatch = AMBER. Expiry within 90 days = AMBER.
Otherwise GREEN. A fake copying a real batch/expiry can still score GREEN — no batch registry exists,
so GREEN is never proof of authenticity.

## Design (hackathon build)
Clinical light design, built fresh for this repo: clean white, teal-green `#0E7A5F` accent, Manrope headlines, Inter body, IBM Plex Mono for batch/expiry. Dense sections (hero + scanner, real photo strip, deep-green crisis band, sample scan feed, how it works, verdict showcase, full 50-medicine index, features, closing), flat colours, hairline borders, no gradients, no orbs, no marquee, no emoji icons. Photos are the 3 real JPGs from the old MediLens homepage (pharmacy, researcher, lab), stored locally in `public/img/` — never hotlinked, never AVIF. Only `app/layout.tsx`, `app/page.tsx`, `app/globals.css` and the `DRUG_LIST` export in `lib/drugs.ts` carry it; scan logic, verdict rules, drug list entries and voice code are untouched by the design.

## Multi-photo scan (Item 1, hackathon build)
Send 1 to 3 photos: front (drug name and maker), batch/expiry strip
(batch and expiry), full pack/seal (whole pack). Each photo is read
separately by the same vision model, then `lib/merge.ts` combines them:
first non-null value wins per field, confidence is the lowest
confidence among photos that actually contributed a field (a photo
that read nothing does not drag the verdict down). Different drug
names, batch numbers, or expiry dates across photos are conflicts:
they pull a GREEN verdict down to AMBER with a visible reason, never
silently pick one, and never turn a RED into GREEN. The old
single-photo `{ image }` request still works. One request counts as
one scan for the 10/minute limit. Phone photos are downscaled in the
browser to max 1280px JPEG before upload, so 3 photos stay within the
6 MB per-photo limit.

## Drug list (Item 2, hackathon build)
50 common Pakistan medicines, written fresh in the hackathon window:
the original 12 MVP entries plus 38 new entries. Maker is recorded
only when confident, otherwise null (no maker check). No strength is
recorded, so no strength check is made. No controlled, narcotic, or
sedative medicines are included. This is NOT a copy of any old list.

## No medical advice
This app does NOT give dosage, usage or treatment advice. It only checks what is printed on the pack.
Screening only. If in doubt, show the pack to a pharmacist.

## Plan A / Plan B
- Plan A (default): Meta Model API, `muse-spark-1.3`, `https://api.meta.ai/v1`
- Plan B: Baseten, `meta-models/muse-spark-open` (set `BASETEN_MODEL` if your dashboard shows a dated slug),
  `https://inference.baseten.co/v1`. Baseten does not support JSON mode for this model, so the app
  parses JSON out of the reply text. If Plan B is used, the UI footer "Built with Muse Spark Open" applies.

## Voice (free Meta models, no card, no endpoint)
Beside every verdict there is a Listen button with a language choice:
English (default), Urdu, Sindhi, Punjabi. The written site and written
verdict always stay in English; changing the voice language only changes
the spoken verdict. Playback is tap-only, never autoplay.

How it works (server-side `/api/speak`, token in server env only):
- Translation: Meta NLLB `facebook/nllb-200-distilled-600M` (English ->
  `urd_Arab`, `snd_Arab`, `pan_Guru`) via the Hugging Face Inference API.
- Voice: Meta MMS-TTS via the same API — `facebook/mms-tts-eng`,
  `facebook/mms-tts-urd-script_arabic`, `facebook/mms-tts-snd`,
  `facebook/mms-tts-pan` (Punjabi is listed as Eastern/Gurmukhi side, so it
  may not match Shahmukhi perfectly).
- Limits: 10 listens/minute per IP, spoken text capped at 500 characters,
  short demo verdicts only. First request can wait while a free model loads.
- Honest limits: Sindhi voice (`facebook/mms-tts-snd`) is NOT yet confirmed
  by a live test — if HF returns 404 the button shows that exact error
  instead of fake audio. MMS/NLLB are CC-BY-NC, fine for a hackathon demo.
- Superseded plan: the earlier SeamlessM4T v2 Inference Endpoint plan was
  cancelled — it needed a card/billing. This stack needs no endpoint.

If Hugging Face returns 401/403, the token is the problem: a plain Read
token may not be enough for HF's newer Inference Providers routing. Make a
fine-grained token with "Make calls to Inference Providers" enabled and put
it in the server env instead. Never put any token in chat or in the repo.

## Env (server only, never commit)
```
AI_PROVIDER=meta
META_API_KEY=
# or
AI_PROVIDER=baseten
BASETEN_API_KEY=
BASETEN_MODEL=meta-models/muse-spark-open
# voice (Hugging Face, server only):
HF_TOKEN=
```

## Run
```
npm install
npm run build
npm run dev
# API test (key from env only):
META_API_KEY=... node scripts/test-api.mjs
```

## Submission
Public repo + live link + 3-minute demo video showing ONLY this hackathon build.
Submission deadline: 4 Nov 2026, 9 PM ET = 5 Nov 2026, 7:00 AM PKT, via the Cerebral Valley platform.

## New features (Part 2 expansion, hackathon build)

Feature 1 — Barcode vs Text Cross-Check: the vision prompt also reads the
digits printed under the barcode (`barcode`) and any product name printed
on or next to the barcode label (`barcodeProduct`). The scan route
compares the barcode name against the front-of-pack name: if the barcode
name resolves to a DIFFERENT known drug, the verdict drops GREEN to AMBER
with the reason "Barcode does not match the printed medicine name."
An unreadable or absent barcode never changes the verdict, and a RED
verdict is never changed by a barcode mismatch. The barcode value is
shown in the result when it was read. Honest limit: a bare barcode
number cannot be mapped to a medicine name — there is no GTIN registry
in this repo, and none was invented — so a mismatch fires only when the
barcode label itself carries a different product name.

Feature 2 — Voice-Guided Scan Journey + 50-Language Voice: the scanner
card has a "Start voice guide" button (tap-only, never autoplay) that
speaks, in the selected guide language, "Show the front of the pack",
"Now show the side with batch and expiry", "Now show the full pack and
seal", then the verdict on tap ("Hear guide verdict"). If the scan
confidence is below 0.6, the verdict speech is prefixed with "Photo is
blurry, please retake." — low confidence is the honest trigger, because
a separate blur detector is out of scope this round. Listen and guide
share the same 50-language list (English, Urdu, Sindhi, Punjabi, Roman
Urdu (testing), Arabic, French, Spanish, German, Italian, Portuguese,
Russian, Mandarin Chinese, Japanese, Korean, Hindi, Bengali, Tamil,
Telugu, Marathi, Gujarati, Malayalam, Kannada, Nepali, Sinhala, Thai,
Vietnamese, Indonesian, Malay, Turkish, Persian, Pashto, Balochi,
Saraiki, Dutch, Swedish, Norwegian, Danish, Finnish, Polish, Ukrainian,
Czech, Romanian, Greek, Hebrew, Hungarian, Swahili, Hausa, Amharic,
Somali) on the same free Meta stack (NLLB + MMS-TTS via HF Inference
API). Written site and verdict always stay English. 500-char cap and
first-2-reasons rule still apply. If a language model is missing (404)
or fails, /api/speak reports that exact error — never fake audio, never
a silent fallback to English. Rare language codes (Balochi, Saraiki,
Pashto, Persian, Malay, Norwegian, Mandarin) are best-effort ISO codes
and are NOT live-verified until a phone test passes.

Feature 3 — Family Medicine Cabinet + Expiry Alerts: after a scan, "Save
to cabinet" (tap only, never auto-save) stores name, batch, expiry and
scan date in browser localStorage only — no server storage, no Supabase.
The /cabinet page lists saved medicines, flags expired medicines RED
and medicines expiring within 30 days as "Expiring soon". No push
notifications. Scans are still never stored server-side.

Not built in this round (per plan): hotspot map, pack-defect check,
photo-quality check, tamper forensics, shareable verdict card.

Live vision + voice tests still pending Vercel env vars (META_API_KEY
or BASETEN_API_KEY, HF_TOKEN) and a phone test — the code above is
build-verified, not live-verified.

## Design v3 (cinematic hero, hackathon build)

Same teal-green identity, denser and more cinematic: the hero is a dark
deep-green band with a large display headline, a real pharmacy photo
with a CSS-only animated scan frame and beam (labelled "Demo animation
— not a real scan result", never a fake verdict), and the white scanner
card floating on it. The verdict showcase is interactive (tap
GREEN/AMBER/RED to see that level's example), the medicine index has a
live search box (name or maker, with a shown-count), the crisis band
has a real lab photo at low opacity behind it for depth, and cards lift
slightly on hover. All motion stops under prefers-reduced-motion, and
everything is CSS/JS that works on older browsers (no WebGL, no AVIF).
Design files only (app/page.tsx, app/globals.css); scan, verdict, voice
and cabinet logic are untouched by v3. Recheck note: the dark hero
needed explicit dark-ink overrides for the light scanner/verdict/guide
cards inside it, otherwise white text would have been invisible on
white cards — fixed and verified at 1366px, 900px and 390px.
