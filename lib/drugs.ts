/**
 * MVP drug list for the hackathon build only.
 * Small and honest on purpose: the MVP proves the pipeline (photo -> read -> verdict).
 * A name match is a screening signal, never proof of authenticity.
 * Maker is null where we did not record it confidently, so no false maker mismatch.
 */
import type { DrugMatch } from "./verdict";

const LIST: DrugMatch[] = [
  { name: "Panadol", manufacturer: "GSK" },
  { name: "Paracetamol", manufacturer: null },
  { name: "Augmentin", manufacturer: "GSK" },
  { name: "Brufen", manufacturer: "Abbott" },
  { name: "Flagyl", manufacturer: "Sanofi" },
  { name: "Arinac", manufacturer: "Abbott" },
  { name: "Disprin", manufacturer: null },
  { name: "Strepsils", manufacturer: null },
  { name: "Cataflam", manufacturer: "Novartis" },
  { name: "CaC-1000 Plus", manufacturer: "Sandoz" },
  { name: "Risek", manufacturer: "Getz Pharma" },
  { name: "Montika", manufacturer: "Getz Pharma" },
];

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function findDrug(name: string | null): DrugMatch | null {
  if (!name) return null;
  const n = norm(name);
  return LIST.find((d) => norm(d.name) === n || n.includes(norm(d.name)) || norm(d.name).includes(n)) ?? null;
}
