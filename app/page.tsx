"use client";
import { useRef, useState } from "react";

const COLORS: Record<string, string> = { green: "#1a7f37", amber: "#9a6700", red: "#c1121f" };

// Item 1: 3 labelled photo slots. Each slot is optional, at least one
// photo is required. Slot order is the merge order: front, strip, full pack.
const SLOTS = [
  { key: "front", label: "1. Front of pack — drug name and maker" },
  { key: "strip", label: "2. Batch / expiry strip — batch and expiry" },
  { key: "pack", label: "3. Full pack / seal — whole pack" },
] as const;

export default function Home() {
  const [photos, setPhotos] = useState<string[]>(["", "", ""]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  // Voice: written page/verdict always stays in English. Only the spoken
  // verdict changes language, and only when the user taps Listen.
  const [voiceLang, setVoiceLang] = useState("en");
  const [speakBusy, setSpeakBusy] = useState(false);
  const [speakError, setSpeakError] = useState("");
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string>("");

  function speakText() {
    if (!result) return "";
    const text = `${result.verdict.level.toUpperCase()}. ${result.verdict.title}. ${(result.verdict.reasons || []).slice(0, 2).join(" ")}`;
    return text.replace(/\s+/g, " ").trim().slice(0, 500);
  }

  async function listen() {
    stopAudio();
    setSpeakBusy(true); setSpeakError("");
    try {
      const res = await fetch("/api/speak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: speakText(), lang: voiceLang }) });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setSpeakError(j.message || j.error || "Voice failed.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setPlaying(false);
      setPlaying(true);
      await audio.play();
    } catch { setSpeakError("Network error. Try again."); }
    setSpeakBusy(false);
  }

  function stopAudio() {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setPlaying(false);
  }

  function onFile(slot: number, f: File | undefined) {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const next = [...photos];
      next[slot] = String(r.result);
      setPhotos(next);
    };
    r.readAsDataURL(f);
  }

  async function scan() {
    const images = photos.filter((p) => p);
    if (images.length === 0) return;
    setBusy(true); setError(""); setResult(null);
    try {
      const res = await fetch("/api/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ images }) });
      const j = await res.json();
      if (!res.ok) setError(j.message || j.error || "Scan failed.");
      else setResult(j);
    } catch { setError("Network error. Try again."); }
    setBusy(false);
  }

  const chosen = photos.filter((p) => p).length;

  return (
    <main>
      <h1>MediLens</h1>
      <p>Take photos of a medicine pack. The AI reads the label, batch and expiry, then gives a GREEN, AMBER or RED screening result. Take 1 photo, or up to 3 for a stronger check.</p>
      {SLOTS.map((slot, i) => (
        <div key={slot.key} style={{ marginTop: 12 }}>
          <label>{slot.label}</label>
          <div>
            <input type="file" accept="image/*" capture="environment" onChange={(e) => onFile(i, e.target.files?.[0])} />
          </div>
          {photos[i] && <img src={photos[i]} alt={slot.label} style={{ maxWidth: "100%", marginTop: 8 }} />}
        </div>
      ))}
      <div style={{ marginTop: 12 }}>
        <button onClick={scan} disabled={chosen === 0 || busy} style={{ padding: "10px 20px", fontSize: 16 }}>
          {busy ? "Scanning…" : `Scan pack (${chosen} photo${chosen === 1 ? "" : "s"})`}
        </button>
      </div>
      {error && <p style={{ color: "#c1121f" }}>{error}</p>}
      {result && (
        <section style={{ border: `3px solid ${COLORS[result.verdict.level]}`, padding: 16, marginTop: 16 }}>
          <h2 style={{ color: COLORS[result.verdict.level] }}>{result.verdict.level.toUpperCase()} — {result.verdict.title}</h2>
          <p>Drug read: {result.label.drugName ?? "—"} | Batch: {result.label.batchNumber ?? "—"} | Expiry: {result.label.expiryDate ?? "—"}</p>
          <p style={{ fontSize: 13 }}>Photos: {result.photosRead ?? 1} read out of {result.photosSent ?? 1} sent.</p>
          {result.perPhoto && (
            <ul>
              {result.perPhoto.map((p: any, i: number) => (
                <li key={i}>Photo {i + 1}: {p.drugName ?? "name not read"} | batch {p.batchNumber ?? "—"} | expiry {p.expiryDate ?? "—"}</li>
              ))}
            </ul>
          )}
          <ul>{result.verdict.reasons.map((r: string, i: number) => <li key={i}>{r}</li>)}</ul>
          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <label htmlFor="voice-lang">Listen in:</label>
            <select id="voice-lang" value={voiceLang} onChange={(e) => setVoiceLang(e.target.value)} style={{ padding: 8, fontSize: 15 }}>
              <option value="en">English</option>
              <option value="ur">Urdu</option>
              <option value="snd">Sindhi</option>
              <option value="pan">Punjabi</option>
            </select>
            {!playing ? (
              <button onClick={listen} disabled={speakBusy} style={{ padding: "8px 16px", fontSize: 15 }}>
                {speakBusy ? "Loading voice…" : "Listen"}
              </button>
            ) : (
              <button onClick={stopAudio} style={{ padding: "8px 16px", fontSize: 15 }}>Stop</button>
            )}
          </div>
          <p style={{ fontSize: 13 }}>Written result stays in English. Only the spoken result changes language.</p>
          {speakError && <p style={{ color: "#c1121f" }}>{speakError}</p>}
          <p style={{ fontSize: 13 }}>{result.disclaimer}</p>
        </section>
      )}
    </main>
  );
}
