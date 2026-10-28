import { NextResponse } from "next/server";

// RETIRED 2026-10-28. This route used to return Edge server audio, but
// Edge synthesis never worked from this Vercel deployment: 7 distinct
// configurations were tried (npm client + v1 token, CS64 v2 token,
// full Python-client mirror, proven f53 JS flow) and all failed — 403,
// no WebSocket upgrade, or a connection close with no audio — while
// the voices-list REST check returned HTTP 200. The site now uses the
// phone's own voice (Web Speech API); translation lives in
// /api/translate. This stub stays so an old client gets an exact
// answer instead of a silent 404. It is never called by the current UI.
export async function POST() {
  return NextResponse.json(
    {
      error: "VOICE_RETIRED",
      message: "Server voice is retired. The site now uses your phone's own voice — tap Listen.",
    },
    { status: 410 },
  );
}
