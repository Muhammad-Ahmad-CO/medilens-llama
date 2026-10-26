"use client";
import { useRef, useState } from "react";

const COLORS: Record<string, string> = { green: "#1a7f37", amber: "#9a6700", red: "#c1121f" };

export default function Home() {
  const [photo, setPhoto] = useState("");
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

  async function onFile(f: File | undefined) {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setPhoto(String(r.result));
    r.readAsDataURL(f);
  }

  async function scan() {
    if (!photo) return;
    setBusy(true); setError(""); setResult(null);
    try {
      const res = await fetch("/api/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: photo }) });
      const j = await res.json();
      if (!res.ok) setError(j.message || j.error || "Scan failed.");
      else setResult(j);
    } catch { setError("Network error. Try again."); }
    setBusy(false);
  }

  return (
    <main>
      <h1>MediLens</h1>
      <p>Take a photo of a medicine pack. The AI reads the label, batch and expiry, then gives a GREEN, AMBER or RED screening result.</p>
      <input type="file" accept="image/*" capture="environment" onChange={(e) => onFile(e.target.files?.[0])} />
      {photo && <div><img src={photo} alt="Medicine pack" style={{ maxWidth: "100%", marginTop: 12 }} /></div>}
      <div style={{ marginTop: 12 }}>
        <button onClick={scan} disabled={!photo || busy} style={{ padding: "10px 20px", fontSize: 16 }}>
          {busy ? "Scanning…" : "Scan pack"}
        </button>
      </div>
      {error && <p style={{ color: "#c1121f" }}>{error}</p>}
      {result && (
        <section style={{ border: `3px solid ${COLORS[result.verdict.level]}`, padding: 16, marginTop: 16 }}>
          <h2 style={{ color: COLORS[result.verdict.level] }}>{result.verdict.level.toUpperCase()} — {result.verdict.title}</h2>
          <p>Drug read: {result.label.drugName ?? "—"} | Batch: {result.label.batchNumber ?? "—"} | Expiry: {result.label.expiryDate ?? "—"}</p>
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
