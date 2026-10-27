/**
 * Multi-photo merge for Item 1 (fresh hackathon code, Oct 2026).
 * Each photo is read separately by the vision model; this file only
 * combines those readings. It never guesses a missing field and never
 * decides the verdict — lib/verdict.ts still decides that.
 *
 * Merge rules (audit-fixed, Oct 2026):
 * - First non-null value wins, in the order the photos were sent
 *   (slot order: front, batch/expiry strip, full pack/seal).
 * - Confidence is the LOWEST confidence among photos that actually
 *   contributed a field to the merged label. A photo that read nothing
 *   (for example a seal photo with no text) must not drag a clean
 *   reading down to AMBER on its own.
 * - Different drug names, batch numbers, or expiry dates across
 *   photos are conflicts, not a silent pick. The scan route turns a
 *   GREEN verdict into AMBER when a conflict exists; a RED verdict
 *   stays RED. No conflict ever turns a RED into GREEN. Expiry is
 *   included because picking one expiry silently could flip an
 *   expired/valid verdict.
 */
import type { Label } from "./verdict";
import { parseExpiry } from "./verdict";

export interface MergedLabel {
  label: Label;
  /** One reading per successfully read photo, in slot order. */
  perPhoto: Label[];
  /** Conflict reason strings, empty when there is no conflict. */
  conflicts: string[];
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function distinct(values: (string | null)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (!v) continue;
    const n = norm(v);
    if (n && !seen.has(n)) {
      seen.add(n);
      out.push(v);
    }
  }
  return out;
}

function first(values: (string | null)[]): string | null {
  for (const v of values) {
    if (v) return v;
  }
  return null;
}

export function mergeLabels(labels: Label[]): MergedLabel {
  const conflicts: string[] = [];
  const drugNames = distinct(labels.map((l) => l.drugName));
  if (drugNames.length > 1) {
    conflicts.push(
      `Different drugs seen in photos (${drugNames.join(" / ")}). Check by eye which pack these photos belong to.`
    );
  }
  const batches = distinct(labels.map((l) => l.batchNumber));
  if (batches.length > 1) {
    conflicts.push(
      `Batch numbers do not match across photos (${batches.join(" / ")}). Check by eye.`
    );
  }
  // Expiry conflict: compare by parsed date when possible, otherwise by
  // raw text, so "08/28" vs "AUG 2028" does not false-flag, while a real
  // date difference does flag.
  const expiryKeys = new Set<string>();
  const expiryShown: string[] = [];
  for (const l of labels) {
    if (!l.expiryDate) continue;
    const parsed = parseExpiry(l.expiryDate);
    const key = parsed ? `date:${parsed.getTime()}` : `raw:${norm(l.expiryDate)}`;
    if (!expiryKeys.has(key)) {
      expiryKeys.add(key);
      expiryShown.push(l.expiryDate);
    }
  }
  if (expiryShown.length > 1) {
    conflicts.push(
      `Expiry dates do not match across photos (${expiryShown.join(" / ")}). Check by eye.`
    );
  }

  const merged: Label = {
    drugName: first(labels.map((l) => l.drugName)),
    manufacturer: first(labels.map((l) => l.manufacturer)),
    batchNumber: first(labels.map((l) => l.batchNumber)),
    expiryDate: first(labels.map((l) => l.expiryDate)),
    barcode: first(labels.map((l) => l.barcode)),
    barcodeProduct: first(labels.map((l) => l.barcodeProduct)),
    confidence: 0.5,
  };
  // Only photos that contributed a field count toward confidence.
  const contributing = labels.filter(
    (l) =>
      (l.drugName && l.drugName === merged.drugName) ||
      (l.manufacturer && l.manufacturer === merged.manufacturer) ||
      (l.batchNumber && l.batchNumber === merged.batchNumber) ||
      (l.expiryDate && l.expiryDate === merged.expiryDate) ||
      (l.barcode && l.barcode === merged.barcode) ||
      (l.barcodeProduct && l.barcodeProduct === merged.barcodeProduct)
  );
  if (contributing.length > 0) {
    merged.confidence = Math.min(...contributing.map((l) => l.confidence));
  }
  return { label: merged, perPhoto: labels, conflicts };
}
