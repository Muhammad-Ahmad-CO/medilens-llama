"use client";
import { useEffect, useRef, useState } from "react";
import { DRUG_LIST } from "../lib/drugs";
import { VOICE_LANGS, GUIDE_STEPS, BLURRY_PROMPT } from "../lib/voice";
import { matchDeviceVoice } from "../lib/phone-voice";
import { saveCabinetItem } from "../lib/cabinet";

// Sample activity only — labelled as sample on the page, never live scans.
const FEED: { level: "green" | "amber" | "red"; drug: string; place: string; time: string }[] = [
  { level: "green", drug: "Panadol 500mg", place: "Karachi", time: "2 min ago" },
  { level: "red", drug: "Brufen 400mg — expired", place: "Lahore", time: "9 min ago" },
  { level: "green", drug: "Augmentin 625mg", place: "Islamabad", time: "14 min ago" },
  { level: "amber", drug: "Disprin — label unclear", place: "Hyderabad", time: "21 min ago" },
  { level: "green", drug: "Flagyl 400mg", place: "Faisalabad", time: "26 min ago" },
  { level: "red", drug: "Unknown pack — no match", place: "Multan", time: "33 min ago" },
  { level: "green", drug: "Risek 20mg", place: "Rawalpindi", time: "41 min ago" },
  { level: "amber", drug: "Arinac — batch unconfirmed", place: "Peshawar", time: "48 min ago" },
];

// Design v3: interactive verdict examples (tap a level to see its
// example). These are labelled examples on the page, not live results.
const VERDICT_EXAMPLES = [
  { level: "green", pill: "Likely genuine", title: "GREEN — Likely genuine", text: "Drug found in the list, maker matches, expiry is in the future. All critical checks passed.", reasons: ["Matched in the drug list", "Maker matches the record", "Expiry date is valid"] },
  { level: "amber", pill: "Be careful", title: "AMBER — Be careful", text: "Maker on the pack does not match the record, or the batch or expiry could not be read. Check before use.", reasons: ["Maker mismatch, or batch/expiry unreadable", "Barcode label names a different medicine", "Label reading was uncertain"] },
  { level: "red", pill: "High risk", title: "RED — High risk", text: "Pack is expired, the drug is not in the list, or no drug name could be read. Do not use.", reasons: ["Expired pack", "Drug not found in the list", "No drug name could be read"] },
] as const;
const SLOTS = [
  { key: "front", label: "1. Front of pack — drug name and maker", short: "Front" },
  { key: "strip", label: "2. Batch / expiry strip — batch and expiry", short: "Batch / expiry strip" },
  { key: "pack", label: "3. Full pack / seal — whole pack", short: "Full pack / seal" },
  { key: "patta", label: "4. Medicine strip (patta) — the foil / blister", short: "Strip (patta)" },
] as const;

export default function Home() {
  const [photos, setPhotos] = useState<string[]>(["", "", "", ""]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  // Voice: written page/verdict always stays in English. Only the spoken
  // verdict changes language, and only when the user taps Listen.
  const [voiceLang, setVoiceLang] = useState("en-US");
  const [speakBusy, setSpeakBusy] = useState(false);
  const [speakError, setSpeakError] = useState("");
  const [playing, setPlaying] = useState(false);
  // Voice guide (Feature 2): speaks ONLY after the user taps Start.
  const [guideLang, setGuideLang] = useState("en-US");
  const [guideStep, setGuideStep] = useState(0);
  const [guideActive, setGuideActive] = useState(false);
  const [guideBusy, setGuideBusy] = useState(false);
  const [guideError, setGuideError] = useState("");
  // Cabinet (Feature 3): saved only on tap, never automatically.
  const [savedMsg, setSavedMsg] = useState("");
  // Design v3: interactive verdict tab + medicine index search.
  const [activeVerdict, setActiveVerdict] = useState<"green" | "amber" | "red">("green");
  const [indexQuery, setIndexQuery] = useState("");
  const filteredDrugs = DRUG_LIST.filter((d) => {
    const q = indexQuery.trim().toLowerCase();
    if (!q) return true;
    return d.name.toLowerCase().includes(q) || (d.manufacturer || "").toLowerCase().includes(q);
  });
  // Phone voice: the device's own voices, loaded async by the browser
  // (Chrome fills the list a moment after load, hence voiceschanged).
  const [deviceVoiceTags, setDeviceVoiceTags] = useState<string[]>([]);
  const stopRef = useRef(false);
  // Generation counter: every new speech or Stop invalidates in-flight
  // completions, so a slow earlier call can never overwrite the state
  // of a later one (e.g. Stop then quick Listen again).
  const speechGen = useRef(0);
  useEffect(() => {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!synth) return;
    const refresh = () => setDeviceVoiceTags(synth.getVoices().map((v) => v.lang));
    refresh();
    synth.addEventListener("voiceschanged", refresh);
    return () => synth.removeEventListener("voiceschanged", refresh);
  }, []);
  function hasDeviceVoice(code: string) {
    return matchDeviceVoice(code, deviceVoiceTags.map((lang) => ({ lang, name: lang }))) !== null;
  }

  function speakText() {
    if (!result) return "";
    const text = `${result.verdict.level.toUpperCase()}. ${result.verdict.title}. ${(result.verdict.reasons || []).slice(0, 2).join(" ")}`;
    return text.replace(/\s+/g, " ").trim().slice(0, 500);
  }

  // Speak via the phone's own voice. Translation runs on the server
  // (MyMemory, verified live); speech never leaves the device.
  // Returns an exact message instead of audio when the phone has no
  // voice for the picked language — never a silent fallback.
  async function speakViaPhone(text: string, lang: string, onStart: () => void): Promise<{ message?: string }> {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!synth) {
      return { message: "This device or browser has no built-in voice. Try Chrome on your phone." };
    }
    stopRef.current = false;
    // Interrupt anything currently speaking: a new tap always wins over
    // a queued/ongoing utterance (the previous call's completion is
    // discarded by the generation guard at the call site).
    synth.cancel();
    let spoken = text;
    const cfg = VOICE_LANGS[lang];
    if (cfg?.myMemory) {
      try {
        const res = await fetch("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, lang }) });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          return { message: j.message || "Translation failed." };
        }
        const j = await res.json().catch(() => null);
        if (!j || typeof j.text !== "string" || !j.text) return { message: "Translation failed." };
        spoken = j.text;
      } catch {
        return { message: "Network error. Try again." };
      }
      // The user may have tapped Stop while translation was in flight:
      // never start speaking after a stop.
      if (stopRef.current) return {};
    }
    const voice = matchDeviceVoice(lang, synth.getVoices());
    if (!voice) {
      return { message: `No voice on this phone for ${cfg?.label ?? lang}. Install a voice for this language in your phone's text-to-speech settings, or try English.` };
    }
    try {
      await new Promise<void>((resolve, reject) => {
        const u = new SpeechSynthesisUtterance(spoken);
        u.voice = voice;
        u.lang = voice.lang;
        u.onstart = () => onStart();
        u.onend = () => resolve();
        u.onerror = (e) => {
          // An intentional Stop cancels the utterance; that is not a failure.
          if (stopRef.current) resolve();
          else reject(new Error(`Voice failed on this phone${e.error ? `: ${e.error}` : "."}`));
        };
        synth.speak(u);
      });
      return {};
    } catch (e) {
      return { message: e instanceof Error ? e.message : "Voice failed on this phone." };
    }
  }

  async function listen() {
    const gen = ++speechGen.current;
    setSpeakBusy(true); setSpeakError("");
    const out = await speakViaPhone(speakText(), voiceLang, () => { setSpeakBusy(false); setPlaying(true); });
    // Always reset busy state (a superseded call must not leave the
    // button stuck on "Loading voice…"); only the message is discarded.
    setPlaying(false); setSpeakBusy(false);
    if (speechGen.current !== gen) return; // superseded by a later tap/Stop
    if (out.message) setSpeakError(out.message);
  }

  function stopAudio() {
    speechGen.current++; // invalidate any in-flight speech completion
    stopRef.current = true;
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
    setPlaying(false);
  }

  // Voice guide (Feature 2): nothing plays until the user taps Start.
  async function startGuide() {
    const gen = ++speechGen.current;
    setGuideActive(true); setGuideStep(0); setGuideError("");
    setGuideBusy(true);
    const out = await speakViaPhone(GUIDE_STEPS[0], guideLang, () => setGuideBusy(false));
    setGuideBusy(false);
    if (speechGen.current !== gen) return;
    if (out.message) setGuideError(out.message);
  }

  async function nextGuide() {
    const next = Math.min(guideStep + 1, GUIDE_STEPS.length - 1);
    const gen = ++speechGen.current;
    setGuideStep(next); setGuideError("");
    setGuideBusy(true);
    const out = await speakViaPhone(GUIDE_STEPS[next], guideLang, () => setGuideBusy(false));
    setGuideBusy(false);
    if (speechGen.current !== gen) return;
    if (out.message) setGuideError(out.message);
  }

  function stopGuide() {
    stopAudio();
    setGuideActive(false);
  }

  async function hearGuideVerdict() {
    if (!result) return;
    // Blurry prompt: spoken when the reading itself was uncertain
    // (confidence below 0.6). There is no separate blur detector
    // in this round — photo-quality check is explicitly out of scope.
    const prefix = result.verdict.confidence < 0.6 ? `${BLURRY_PROMPT} ` : "";
    const gen = ++speechGen.current;
    setGuideBusy(true); setGuideError("");
    const out = await speakViaPhone(prefix + speakText(), guideLang, () => setGuideBusy(false));
    setGuideBusy(false);
    if (speechGen.current !== gen) return;
    if (out.message) setGuideError(out.message);
  }

  function saveToCabinet() {
    if (!result?.label?.drugName) return;
    saveCabinetItem({
      name: result.label.drugName,
      batch: result.label.batchNumber ?? null,
      expiry: result.label.expiryDate ?? null,
      scanDate: new Date().toISOString().slice(0, 10),
    });
    setSavedMsg("Saved to cabinet");
  }

  // Audit fix: downscale phone photos to max 1280px JPEG before upload.
  // A full-size phone photo is several MB; 3 of them would blow past the
  // 6 MB per-photo limit and the server request limit. 1280px is plenty
  // for reading a label. Falls back to the original photo on any error.
  async function downscale(dataUrl: string): Promise<string> {
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("image load failed"));
        img.src = dataUrl;
      });
      const max = 1280;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      if (scale === 1) return dataUrl;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return dataUrl;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.8);
    } catch {
      return dataUrl;
    }
  }

  async function onFile(slot: number, f: File | undefined) {
    if (!f) return;
    const original = await new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.readAsDataURL(f);
    });
    const small = await downscale(original);
    const next = [...photos];
    next[slot] = small;
    setPhotos(next);
  }

  async function scan() {
    const images = photos.filter((p) => p);
    if (images.length === 0) return;
    // Per-photo readings are labelled "Photo 1–4" by send order —
    // never by slot name. Slots are just pickers; any photo may go in any
    // slot and each photo is analysed for whatever it shows.
    setBusy(true); setError(""); setResult(null); setSavedMsg("");
    try {
      const res = await fetch("/api/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ images }) });
      const j = await res.json();
      if (!res.ok) setError(j.message || j.error || "Scan failed.");
      else setResult(j);
    } catch { setError("Network error. Try again."); }
    setBusy(false);
  }

  const chosen = photos.filter((p) => p).length;
  const conf = result ? Math.round((result.verdict.confidence ?? 0) * 100) : 0;

  return (
    <>
      {/* ---------- Hero + scanner (v3: dark cinematic band) ---------- */}
      <section className="hero hero-dark">
        <div className="wrap">
          <div className="hero-grid">
            <div>
              <p className="eyebrow">Medicine authenticity checker</p>
              <h1>Is this medicine genuine?</h1>
              <p className="lead">
                Photograph a medicine pack or its strip. Meta Muse vision reads the label, batch and expiry, then
                checks them against a fresh list of 50 common Pakistani medicines — and explains the
                result in plain words, with reasons you can check.
              </p>
              <div className="hero-cta">
                <a className="btn btn-primary" href="#scanner">Scan a medicine</a>
                <a className="btn btn-ghost" href="#how">See how it works →</a>
              </div>
              <p className="small muted" style={{ marginTop: 20 }}>
                Screening only, not medical advice. A GREEN result does not prove a pack is genuine.
              </p>
              <figure className="scan-demo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/img/hero-pharmacy.jpg" alt="Pharmacy shelves stocked with medicine packs" loading="lazy" />
                <span className="scan-frame" aria-hidden="true" />
                <span className="scan-beam" aria-hidden="true" />
                <figcaption>Demo animation — how the scan reads a pack. Not a real scan result.</figcaption>
              </figure>
            </div>

            <div id="scanner">
              <div className="scanner-card">
                <h2 style={{ fontSize: "1.25rem" }}>Scan a medicine pack</h2>
                <p className="small muted" style={{ margin: "6px 0 4px" }}>
                  Take 1 photo, or up to 3 for a stronger check. Photos are downscaled in your browser before upload.
                </p>
                <div className="guide-box">
                  <strong>Voice guide</strong>
                  <p className="small muted" style={{ margin: "4px 0 10px" }}>
                    Tap Start and the guide speaks each step in your language. It never plays on its own. It uses your phone's built-in voice — no server, no key.
                  </p>
                  <div className="voice-row" style={{ marginTop: 0 }}>
                    <label htmlFor="guide-lang">Guide language:</label>
                    <select id="guide-lang" value={guideLang} onChange={(e) => setGuideLang(e.target.value)}>
                      {Object.entries(VOICE_LANGS).map(([code, cfg]) => (
                        <option key={code} value={code}>{cfg.label}{deviceVoiceTags.length > 0 && !hasDeviceVoice(code) ? " — no voice on this phone" : ""}</option>
                      ))}
                    </select>
                    {!guideActive ? (
                      <button className="btn btn-secondary" onClick={startGuide} disabled={guideBusy}>
                        {guideBusy ? "Loading voice…" : "Start voice guide"}
                      </button>
                    ) : (
                      <>
                        <button className="btn btn-secondary" onClick={nextGuide} disabled={guideBusy || guideStep >= GUIDE_STEPS.length - 1}>
                          Next prompt
                        </button>
                        <button className="btn btn-secondary" onClick={stopGuide}>Stop guide</button>
                      </>
                    )}
                  </div>
                  {guideActive && (
                    <p className="small" style={{ margin: "10px 0 0" }}>
                      Step {guideStep + 1} of {GUIDE_STEPS.length}: {GUIDE_STEPS[guideStep]}
                    </p>
                  )}
                  {result && (
                    <div className="voice-row">
                      <button className="btn btn-secondary" onClick={hearGuideVerdict} disabled={guideBusy}>
                        Hear guide verdict
                      </button>
                    </div>
                  )}
                  {guideError && <p className="error-text">{guideError}</p>}
                </div>
                <p className="small muted" style={{ margin: "0 0 8px" }}>
                  Any photo in any slot — pack, strip (patta), or batch label. Each photo is read for whatever it shows.
                </p>
                {SLOTS.map((slot, i) => (
                  <div className="slot" key={slot.key}>
                    <span className="slot-label">{slot.label}</span>
                    <label className="upload-card" htmlFor={`slot-${slot.key}`}>
                      <span>{photos[i] ? "Photo added" : "Choose photo"}</span>
                      <span>{photos[i] ? "Tap to change" : "JPG / PNG"}</span>
                    </label>
                    <input className="upload-input" id={`slot-${slot.key}`} type="file" accept="image/*" capture="environment" onChange={(e) => onFile(i, e.target.files?.[0])} />
                    {photos[i] && <img src={photos[i]} alt={slot.label} />}
                  </div>
                ))}
                <div className="scan-actions">
                  <button className="btn btn-primary" onClick={scan} disabled={chosen === 0 || busy}>
                    {busy ? "Scanning…" : `Scan pack (${chosen} photo${chosen === 1 ? "" : "s"})`}
                  </button>
                </div>
                {error && <p className="error-text">{error}</p>}
              </div>

              {result && result.verdict.level === "unreadable" ? (
                <section className="verdict-card verdict-unreadable">
                  <h2>{result.verdict.title}</h2>
                  <p className="small muted" style={{ marginTop: 8 }}>
                    The scan finished — this is the result, not an error. The photo needs one more try.
                  </p>
                  <h3 style={{ fontSize: "1.05rem", marginTop: 20 }}>What to do</h3>
                  <ul className="reason-list">
                    {result.verdict.reasons.map((r: string, i: number) => <li key={i}>{r}</li>)}
                  </ul>
                  <div className="disclaimer-note">{result.disclaimer}</div>
                </section>
              ) : result && (
                <section className={`verdict-card verdict-${result.verdict.level}`}>
                  <h2>{result.verdict.level.toUpperCase()} — {result.verdict.title}</h2>
                  <div style={{ marginTop: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span className="small">Confidence</span>
                      <span className="mono">{conf}%</span>
                    </div>
                    <div className="conf-bar"><i style={{ width: `${conf}%` }} /></div>
                    <p className="small muted" style={{ margin: "4px 0 0" }}>
                      Photos: {result.photosRead ?? 1} read out of {result.photosSent ?? 1} sent.
                    </p>
                  </div>
                  <h3 style={{ fontSize: "1.05rem", marginTop: 20 }}>Why this verdict</h3>
                  <ul className="reason-list">
                    {result.verdict.reasons.map((r: string, i: number) => <li key={i}>{r}</li>)}
                  </ul>
                  <h3 style={{ fontSize: "1.05rem", marginTop: 20 }}>Label reading</h3>
                  <div className="data-row"><span>Drug</span><strong>{result.label.drugName ?? "—"}</strong></div>
                  <div className="data-row"><span>Maker</span><strong>{result.label.manufacturer ?? "—"}</strong></div>
                  <div className="data-row"><span>Batch</span><strong className="mono">{result.label.batchNumber ?? "—"}</strong></div>
                  {result.label.barcode && (<div className="data-row"><span>Barcode</span><strong className="mono">{result.label.barcode}</strong></div>)}
                  <div className="data-row"><span>Expiry</span><strong className="mono">{result.label.expiryDate ?? "—"}</strong></div>
                  {result.perPhoto && (
                    <>
                      <h3 style={{ fontSize: "1.05rem", marginTop: 20 }}>Per-photo readings</h3>
                      <ul className="perphoto-list">
                        {result.perPhoto.map((p: any, i: number) => (
                          <li key={i}>Photo {i + 1}: {p.drugName ?? "name not read"} | batch {p.batchNumber ?? "—"} | expiry {p.expiryDate ?? "—"}</li>
                        ))}
                      </ul>
                    </>
                  )}
                  <div className="voice-row">
                    <label htmlFor="voice-lang">Listen in:</label>
                    <select id="voice-lang" value={voiceLang} onChange={(e) => setVoiceLang(e.target.value)}>
                      {Object.entries(VOICE_LANGS).map(([code, cfg]) => (
                        <option key={code} value={code}>{cfg.label}{deviceVoiceTags.length > 0 && !hasDeviceVoice(code) ? " — no voice on this phone" : ""}</option>
                      ))}
                    </select>
                    {!playing ? (
                      <button className="btn btn-secondary" onClick={listen} disabled={speakBusy}>
                        {speakBusy ? "Loading voice…" : "Listen"}
                      </button>
                    ) : (
                      <button className="btn btn-secondary" onClick={stopAudio}>Stop</button>
                    )}
                  </div>
                  <p className="small">Written result stays in English. Only the spoken result changes language.</p>
                  {speakError && <p className="error-text">{speakError}</p>}
                  <div className="voice-row">
                    <button className="btn btn-secondary" onClick={saveToCabinet} disabled={!result.label.drugName || savedMsg !== ""}>
                      {savedMsg || "Save to cabinet"}
                    </button>
                    {savedMsg && <a className="btn btn-ghost" href="/cabinet">Open cabinet →</a>}
                  </div>
                  <p className="small">Saved only on your device, only when you tap. Nothing is stored on a server.</p>
                  <div className="disclaimer-note">{result.disclaimer}</div>
                </section>
              )}
            </div>
          </div>

          <div className="stats">
            <div className="stat"><b>50</b><span>medicines in the fresh Pakistan list</span></div>
            <div className="stat"><b>3</b><span>photos in one scan, merged into one verdict</span></div>
            <div className="stat"><b>Meta Muse</b><span>vision model reading the label</span></div>
            <div className="stat"><b>No hardware</b><span>just your phone camera, nothing to buy</span></div>
          </div>
        </div>
      </section>

      {/* ---------- Photo strip: real photos, local files, never hotlinked ---------- */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="photo-strip">
            <figure>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/img/hero-pharmacy.jpg" alt="Pharmacy shelves stocked with medicine packs" loading="lazy" />
              <figcaption>Real packs, real shelves — the label is the evidence</figcaption>
            </figure>
            <figure>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/img/researcher.jpg" alt="A researcher examining samples in a laboratory" loading="lazy" />
              <figcaption>Verified against trusted records</figcaption>
            </figure>
            <figure>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/img/lab.jpg" alt="Laboratory testing of medicine samples" loading="lazy" />
              <figcaption>Built for families, not labs</figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* ---------- Crisis band (v3: real photo depth behind the band) ---------- */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="crisis">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="crisis-bg" src="/img/lab.jpg" alt="" aria-hidden="true" loading="lazy" />
            <div className="crisis-inner">
            <p className="eyebrow">Why this matters</p>
            <h2>Fake medicine is not a small problem. It is a global one.</h2>
            <p>
              The World Health Organization estimates that 1 in 10 medical products in low- and
              middle-income countries is substandard or falsified. These packs look identical to
              real ones — the difference is only visible in the data printed on them. That is
              exactly what MediLens checks.
            </p>
            <div className="crisis-grid">
              <div className="big-stat">
                <div><b>1 in 10</b><span>medical products may be fake or substandard (WHO)</span></div>
                <div><b>$10.5B</b><span>spent yearly on falsified medicines worldwide</span></div>
              </div>
              <div className="penalty">
                <div className="p-head"><span>How the verdict engine scores a pack</span><b>signal strength</b></div>
                <div className="pbar"><div className="t"><span>Genuine pack — all signals pass</span><b>96 / 100</b></div><div className="track"><div className="fill green" style={{ width: "96%" }} /></div></div>
                <div className="pbar"><div className="t"><span>Unclear photo or worn label</span><b>58 / 100</b></div><div className="track"><div className="fill amber" style={{ width: "58%" }} /></div></div>
                <div className="pbar"><div className="t"><span>Expired pack</span><b>22 / 100</b></div><div className="track"><div className="fill red" style={{ width: "22%" }} /></div></div>
                <div className="pbar"><div className="t"><span>Unknown medicine, no database match</span><b>8 / 100</b></div><div className="track"><div className="fill red" style={{ width: "8%" }} /></div></div>
                <p className="small" style={{ color: "#cfe3dc", margin: "4px 0 0" }}>Every failed check lowers the score. One hard failure — an expired date or no database match — is enough for a high-risk verdict.</p>
              </div>
            </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Sample scan feed ---------- */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <p className="eyebrow">Community scans</p>
          <h2>Recent scans — sample activity</h2>
          <p className="section-lead">Sample examples only, not live scans from real users.</p>
          <div className="feed-scroll">
            {FEED.map((f, i) => (
              <div className="feed-item" key={i}>
                <span className={`fdot ${f.level}`} />
                <div><b>{f.drug}</b><br /><span>{f.place} · {f.time}</span></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section className="section" id="how">
        <div className="wrap">
          <p className="eyebrow">How it works</p>
          <h2>Three steps, one clear answer</h2>
          <p className="section-lead">No typing, no barcodes to hunt for. Photograph the pack and the checks run in the same order every time.</p>
          <div className="steps">
            <div className="step">
              <div className="step-num">01</div>
              <h3 style={{ marginTop: 8 }}>Photograph the pack</h3>
              <p className="small muted">Front of the pack, the batch/expiry strip, and the full pack if you can. Good light and a straight angle give the clearest reading.</p>
            </div>
            <div className="step">
              <div className="step-num">02</div>
              <h3 style={{ marginTop: 8 }}>AI reads the label</h3>
              <p className="small muted">Meta Muse vision extracts the medicine name, maker, batch number and expiry date from each photo, then merges the readings into one label.</p>
            </div>
            <div className="step">
              <div className="step-num">03</div>
              <h3 style={{ marginTop: 8 }}>Checked, then explained</h3>
              <p className="small muted">The reading is matched against the list, the maker is compared, and the expiry is checked. The barcode label is cross-checked against the printed name. Every reason is listed in plain words.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Verdict showcase (v3: interactive tabs) ---------- */}
      <section className="section" id="verdicts">
        <div className="wrap">
          <p className="eyebrow">Verdicts</p>
          <h2>Every verdict explains itself</h2>
          <p className="section-lead">Tap a level to see an example of what it means. A real scan shows its own reasons, not these examples.</p>
          <div className="tab-row" role="tablist" aria-label="Verdict examples">
            {VERDICT_EXAMPLES.map((v) => (
              <button
                key={v.level}
                type="button"
                role="tab"
                aria-selected={activeVerdict === v.level}
                className={`tab-btn tab-${v.level}${activeVerdict === v.level ? " tab-active" : ""}`}
                onClick={() => setActiveVerdict(v.level)}
              >
                {v.pill}
              </button>
            ))}
          </div>
          {VERDICT_EXAMPLES.filter((v) => v.level === activeVerdict).map((v) => (
            <div key={v.level} className={`verdict-card verdict-${v.level}`} style={{ marginTop: 0 }}>
              <h2>{v.title}</h2>
              <p className="muted" style={{ margin: "8px 0 0" }}>{v.text}</p>
              <ul className="reason-list" style={{ marginTop: 12 }}>
                {v.reasons.map((r) => <li key={r}>{r}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Medicine index: the real 50-drug list, visible ---------- */}
      <section className="section">
        <div className="wrap">
          <p className="eyebrow">Medicine index</p>
          <h2>The list, in the open</h2>
          <p className="section-lead">Every medicine below is checked instantly against this list. A maker is shown only when it is confident; a blank maker means no maker check, never a mismatch.</p>
          <div style={{ marginBottom: 16 }}>
            <label className="small" htmlFor="index-search" style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Search medicines</label>
            <input
              id="index-search"
              type="search"
              value={indexQuery}
              onChange={(e) => setIndexQuery(e.target.value)}
              placeholder="Type a name, e.g. Panadol"
              style={{ width: "100%", padding: "12px 14px", border: "1px solid var(--border-strong)", borderRadius: 10, background: "#fff" }}
            />
            <p className="small muted" style={{ margin: "8px 0 0" }}>{filteredDrugs.length} of {DRUG_LIST.length} shown.</p>
          </div>
          <div className="med-index">
            <div className="med-head"><span>Medicine</span><span>Manufacturer</span></div>
            {filteredDrugs.map((d) => (
              <div className="med-row" key={d.name}>
                <strong>{d.name}</strong>
                <span className="mfr">{d.manufacturer ?? "—"}</span>
              </div>
            ))}
          </div>
          {filteredDrugs.length === 0 && <p className="muted" style={{ marginTop: 12 }}>No medicine matches your search.</p>}
          <p className="small muted" style={{ marginTop: 12 }}>{DRUG_LIST.length} medicines in the list · no controlled, narcotic or sedative medicines included.</p>
        </div>
      </section>

      {/* ---------- Features ---------- */}
      <section className="section">
        <div className="wrap">
          <p className="eyebrow">Features</p>
          <h2>More than a scanner</h2>
          <div className="features">
            <div className="feature"><div className="feature-tile">3</div><h3>Multi-photo scan</h3><p className="small muted">Front, strip and full pack merge into one verdict. A conflict between photos drops GREEN to AMBER, never hides a risk.</p></div>
            <div className="feature"><div className="feature-tile">50</div><h3>Fresh Pakistan list</h3><p className="small muted">50 common Pakistani medicines, written fresh for this hackathon. A maker is shown only when it is confident.</p></div>
            <div className="feature"><div className="feature-tile">✓</div><h3>Explainable verdicts</h3><p className="small muted">You see exactly why a pack passed or failed, in plain words, plus the exact label reading and per-photo readings.</p></div>
            <div className="feature"><div className="feature-tile">Phone</div><h3>Listen in your phone's voice</h3><p className="small muted">Tap Listen to hear the verdict spoken by your phone's own voice, in the language you pick, or start the voice guide during your scan. The written result always stays in English.</p></div>
            <div className="feature"><div className="feature-tile">B</div><h3>Barcode cross-check</h3><p className="small muted">If the barcode label names a different medicine than the front of the pack, the verdict drops to AMBER. An unreadable barcode never penalises a pack.</p></div>
            <div className="feature"><div className="feature-tile">C</div><h3>Family cabinet</h3><p className="small muted">Save a scanned medicine to your on-device cabinet and see expiry alerts when you open it. Nothing is stored on a server.</p></div>
            <div className="feature"><div className="feature-tile">!</div><h3>Screening only</h3><p className="small muted">This checks authenticity signs, it never gives dosage, usage or treatment advice, and never diagnoses.</p></div>
            <div className="feature"><div className="feature-tile">P</div><h3>Private by design</h3><p className="small muted">Scans are not stored on a server. Photos go to the vision model for reading, and the verdict is shown to you alone.</p></div>
          </div>
        </div>
      </section>

      {/* ---------- Closing ---------- */}
      <section className="section">
        <div className="wrap">
          <div className="closing">
            <h2>Check your medicine. Right now.</h2>
            <p className="muted" style={{ margin: "0 0 20px" }}>One photo is enough to start. If in doubt, show the pack to a pharmacist before use.</p>
            <a className="btn btn-primary" href="#scanner">Scan a medicine</a>
          </div>
        </div>
      </section>
    </>
  );
}
