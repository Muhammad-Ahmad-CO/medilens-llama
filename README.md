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

## No medical advice
This app does NOT give dosage, usage or treatment advice. It only checks what is printed on the pack.
Screening only. If in doubt, show the pack to a pharmacist.

## Plan A / Plan B
- Plan A (default): Meta Model API, `muse-spark-1.3`, `https://api.meta.ai/v1`
- Plan B: Baseten, `meta-models/muse-spark-open` (set `BASETEN_MODEL` if your dashboard shows a dated slug),
  `https://inference.baseten.co/v1`. Baseten does not support JSON mode for this model, so the app
  parses JSON out of the reply text. If Plan B is used, the UI footer "Built with Muse Spark Open" applies.

## Env (server only, never commit)
```
AI_PROVIDER=meta
META_API_KEY=
# or
AI_PROVIDER=baseten
BASETEN_API_KEY=
BASETEN_MODEL=meta-models/muse-spark-open
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
