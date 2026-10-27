// Family Medicine Cabinet (Feature 3) — ON-DEVICE ONLY.
// Saved medicines live in the browser's localStorage under this key.
// Nothing is sent to a server, and nothing uses Supabase in this repo.
// Scans themselves are never stored server-side; saving to the cabinet
// happens only when the user taps "Save to cabinet" after a scan.

export interface CabinetItem {
  id: string;
  name: string;
  batch: string | null;
  expiry: string | null; // raw text as printed, e.g. "08/27"
  scanDate: string; // YYYY-MM-DD
}

const KEY = "medilens-cabinet";

export function loadCabinet(): CabinetItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is CabinetItem =>
        x && typeof x.name === "string" && typeof x.id === "string"
    );
  } catch {
    return [];
  }
}

// Same name + batch replaces the old entry (re-scan updates the date
// instead of creating a duplicate). Returns the updated list.
export function saveCabinetItem(item: Omit<CabinetItem, "id">): CabinetItem[] {
  const list = loadCabinet();
  const id = `${item.name.toLowerCase()}|${(item.batch || "").toLowerCase()}`;
  const next = [
    ...list.filter((x) => x.id !== id),
    { ...item, id },
  ];
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked: keep the in-memory list only, never crash.
  }
  return next;
}

export function removeCabinetItem(id: string): CabinetItem[] {
  const next = loadCabinet().filter((x) => x.id !== id);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Ignore storage errors on remove.
  }
  return next;
}
