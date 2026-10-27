"use client";
import { useEffect, useState } from "react";
import { loadCabinet, removeCabinetItem, type CabinetItem } from "../../lib/cabinet";
import { parseExpiry } from "../../lib/verdict";

// Family Medicine Cabinet (Feature 3) — on-device only.
// Items come from localStorage; nothing here touches a server.
// Alerts are shown in-app when this page is opened (no push
// notifications — a web app cannot reliably push).
export default function CabinetPage() {
  const [items, setItems] = useState<CabinetItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setItems(loadCabinet());
    setLoaded(true);
  }, []);

  function flag(item: CabinetItem): { text: string; cls: string } | null {
    if (!item.expiry) return null;
    const date = parseExpiry(item.expiry);
    if (!date) return null;
    const days = Math.ceil((date.getTime() - Date.now()) / 86400000);
    if (days < 0) return { text: "Expired", cls: "flag-red" };
    if (days <= 30) return { text: `Expiring soon — ${days} day(s) left`, cls: "flag-amber" };
    return null;
  }

  // Soonest expiry first; items without a readable expiry go last.
  const sorted = [...items].sort((a, b) => {
    const da = a.expiry ? parseExpiry(a.expiry)?.getTime() ?? Infinity : Infinity;
    const db = b.expiry ? parseExpiry(b.expiry)?.getTime() ?? Infinity : Infinity;
    return da - db;
  });
  const expiredCount = items.filter((x) => flag(x)?.cls === "flag-red").length;
  const soonCount = items.filter((x) => flag(x)?.cls === "flag-amber").length;

  return (
    <section className="section">
      <div className="wrap">
        <p className="eyebrow">Family medicine cabinet</p>
        <h2 style={{ fontSize: "1.6rem" }}>Your saved medicines</h2>
        <p className="section-lead">
          Saved only on this device, only when you tapped &quot;Save to cabinet&quot; after a scan.
          Nothing is stored on a server. Open this page any time to check expiry alerts.
        </p>
        {loaded && items.length > 0 && (
          <p className="small" style={{ marginBottom: 20 }}>
            {expiredCount > 0 && <span className="flag flag-red" style={{ marginRight: 8 }}>{expiredCount} expired</span>}
            {soonCount > 0 && <span className="flag flag-amber">{soonCount} expiring soon</span>}
            {expiredCount === 0 && soonCount === 0 && <span className="muted">No expiry alerts right now.</span>}
          </p>
        )}
        {!loaded && <p className="muted">Loading your cabinet…</p>}
        {loaded && items.length === 0 && (
          <div className="closing">
            <h2 style={{ fontSize: "1.25rem" }}>Cabinet is empty</h2>
            <p className="muted" style={{ margin: "0 0 20px" }}>
              Scan a medicine pack first, then tap &quot;Save to cabinet&quot; on the result.
            </p>
            <a className="btn btn-primary" href="/#scanner">Scan a medicine</a>
          </div>
        )}
        {sorted.map((item) => {
          const f = flag(item);
          return (
            <div key={item.id} className="scanner-card" style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
                <div>
                  <strong style={{ fontSize: "1.1rem" }}>{item.name}</strong>
                  <p className="small muted" style={{ margin: "4px 0 0" }}>
                    Scanned {item.scanDate}
                  </p>
                </div>
                {f && <span className={`flag ${f.cls}`}>{f.text}</span>}
              </div>
              <div className="data-row"><span>Batch</span><strong className="mono">{item.batch ?? "—"}</strong></div>
              <div className="data-row"><span>Expiry</span><strong className="mono">{item.expiry ?? "—"}</strong></div>
              <div className="voice-row">
                <button className="btn btn-secondary" onClick={() => setItems(removeCabinetItem(item.id))}>
                  Remove
                </button>
              </div>
            </div>
          );
        })}
        {items.length > 0 && (
          <p className="small muted" style={{ marginTop: 20 }}>
            Screening only, not medical advice. If in doubt, show the pack to a pharmacist before use.
          </p>
        )}
      </div>
    </section>
  );
}
