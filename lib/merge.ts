/**
 * Multi-photo merge for Item 1 (fresh hackathon code, Oct 2026).
 * Each photo is read separately by the vision model; this file only
 * combines those readings. It never guesses a missing field and never
 * decides the verdict — lib/verdict.ts still decides that.
 *
 * Merge rules:
 * - First non-null value wins, in the order the photos were sent
 *   (slot order: front, batch/expiry strip, full pack/seal).
 * - Confidence is the LOWEST confidence of the photos that were read,
 *   so a weak photo cannot hide behind a strong one.
 * - Different drug names across photos, or different batch numbers
 *   across photos, are conflicts, not a silent pick. The scan route
 *   turns a GREEN verdict into AMBER when a conflict exists; a RED
 *   verdict stays RED. No conflict ever turns a RED into GREEN.
 */
import type { Label } from "./verdict";

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
  const confidence =
    labels.length > 0 ? Math.min(...labels.map((l) => l.confidence)) : 0.5;
  return {
    label: {
      drugName: first(labels.map((l) => l.drugName)),
      manufacturer: first(labels.map((l) => l.manufacturer)),
      batchNumber: first(labels.map((l) => l.batchNumber)),
      expiryDate: first(labels.map((l) => l.expiryDate)),
      confidence,
    },
    perPhoto: labels,
    conflicts,
  };
}
