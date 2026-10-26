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
Clinical light design, built fresh for this repo: clean white, teal-green `#0E7A5F` accent, Manrope headlines, Inter body, IBM Plex Mono for batch/expiry. Dense sections (hero + scanner, how it works, verdict showcase, features, closing), flat colours, hairline borders, no gradients, no orbs, no marquee, no emoji icons. Only `app/layout.tsx`, `app/page.tsx` and `app/globals.css` carry it; scan logic, verdict rules, drug list and voice code are untouched by the design.

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
