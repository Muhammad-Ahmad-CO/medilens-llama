/**
 * Hackathon MVP verdict engine (written fresh for this hackathon, Oct-Nov 2026).
 * Rule-based only: the AI only READS the label, it never decides the verdict.
 * The verdict is decided here, by transparent rules, so every result is explainable.
 * This is a screening check, not medical advice and not a guarantee of authenticity.
 */

export type VerdictLevel = "green" | "amber" | "red";

export interface Label {
  drugName: string | null;
  manufacturer: string | null;
  batchNumber: string | null;
  expiryDate: string | null; // raw text as printed, e.g. "08/27"
  confidence: number; // 0..1, how clearly the label was read
  // Feature 1 (barcode cross-check): digits printed under the barcode,
  // if readable, else null. Never guessed.
  barcode: string | null;
  // Feature 1: a product name printed on or next to the barcode label,
  // if one is visible, else null. Never guessed.
  barcodeProduct: string | null;
}

export interface DrugMatch {
  name: string;
  manufacturer: string | null; // null = maker not recorded, so no maker check
}

export interface Verdict {
  level: VerdictLevel;
  title: string;
  reasons: string[];
  confidence: number;
}

export const DISCLAIMER =
  "Screening only, not medical advice. A GREEN result does not prove a pack is genuine. " +
  "If in doubt, show the pack to a pharmacist before use.";

const TITLES: Record<VerdictLevel, string> = {
  green: "Likely genuine — looks OK",
  amber: "Be careful — check before use",
  red: "High risk — do not use",
};

/** Parse EXP formats: 08/27, 08-2027, 2027-08, AUG 2027. Returns end-of-month date or null. */
export function parseExpiry(raw: string | null): Date | null {
  if (!raw) return null;
  const t = raw.trim().toUpperCase();
  let m = t.match(/(?<!\d)(\d{4})[\/\-.](0?[1-9]|1[0-2])(?!\d)/);
  if (m) return new Date(+m[1], +m[2], 0);
  m = t.match(/(?<!\d)(0?[1-9]|1[0-2])[\/\-.](\d{2,4})(?!\d)/);
  if (m) {
    let y = +m[2];
    if (y < 100) y += 2000;
    return new Date(y, +m[1], 0);
  }
  const months: Record<string, number> = {
    JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
    JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
  };
  m = t.match(/(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\s*(\d{2,4})/);
  if (m) {
    let y = +m[2];
    if (y < 100) y += 2000;
    return new Date(y, months[m[1]], 0);
  }
  return null;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function evaluate(label: Label, drug: DrugMatch | null): Verdict {
  const reasons: string[] = [];
  let level: VerdictLevel = "green";
  let confidence = 0.92;
  const raise = (to: VerdictLevel, reason: string, penalty: number) => {
    const order: VerdictLevel[] = ["green", "amber", "red"];
    if (order.indexOf(to) > order.indexOf(level)) level = to;
    reasons.push(reason);
    confidence = Math.max(0.3, confidence - penalty);
  };

  if (!label.drugName) {
    return {
      level: "red",
      title: TITLES.red,
      reasons: ["Drug name could not be read from the photo. Retake in better light."],
      confidence: 0.5,
    };
  }

  if (!drug) {
    raise("red", `"${label.drugName}" was not found in the drug list. It may be misspelled, unregistered, or fake.`, 0.35);
  } else {
    reasons.push(`Matched "${drug.name}" in the drug list.`);
  }

  if (drug?.manufacturer && label.manufacturer) {
    const a = norm(label.manufacturer);
    const b = norm(drug.manufacturer);
    if (a && b && !(a.includes(b) || b.includes(a))) {
      raise("amber", `Maker on pack ("${label.manufacturer}") does not match the recorded maker ("${drug.manufacturer}").`, 0.2);
    } else {
      reasons.push(`Maker matches: ${drug.manufacturer}.`);
    }
  }

  const expiry = parseExpiry(label.expiryDate);
  if (!label.expiryDate) {
    raise("amber", "No expiry date detected. Real packs always carry one.", 0.1);
  } else if (!expiry) {
    raise("amber", "Expiry date could not be read clearly — check it by eye.", 0.15);
  } else {
    const days = Math.ceil((expiry.getTime() - Date.now()) / 86400000);
    if (days < 0) raise("red", "This medicine is EXPIRED. Do not use it.", 0.3);
    else if (days <= 90) raise("amber", `Expires soon — only ${days} day(s) left.`, 0.12);
    else reasons.push("Expiry date is valid.");
  }

  if (!label.batchNumber) {
    raise("amber", "No batch number detected. Real packs always carry one.", 0.1);
  } else {
    reasons.push("Batch number present.");
  }

  if (label.confidence < 0.6) {
    raise("amber", "Label reading was uncertain — retake in better light for a stronger result.", 0.12);
  }

  if (level === "green") reasons.push("All critical checks passed.");
  return { level, title: TITLES[level], reasons, confidence: Math.round(confidence * 100) / 100 };
}
