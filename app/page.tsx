"use client";
import { useState } from "react";

const COLORS: Record<string, string> = { green: "#1a7f37", amber: "#9a6700", red: "#c1121f" };

export default function Home() {
  const [photo, setPhoto] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

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
          <p style={{ fontSize: 13 }}>{result.disclaimer}</p>
        </section>
      )}
    </main>
  );
}
