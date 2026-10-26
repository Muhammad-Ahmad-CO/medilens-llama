/**
 * Fresh Pakistan common medicines list for the hackathon build (Item 2).
 * Written fresh in the hackathon window, Oct 2026. NOT copied from the
 * old MediLens list. 50 entries: the original 12 MVP entries, unchanged,
 * plus 38 new common entries.
 * A name match is a screening signal, never proof of authenticity.
 * Maker is recorded ONLY when confident, otherwise null — and null
 * means no maker check, never a mismatch. No strength is recorded in
 * this item, so no strength check is made. No controlled, narcotic,
 * or sedative medicines are included.
 */
import type { DrugMatch } from "./verdict";

const LIST: DrugMatch[] = [
  // Original MVP 12, unchanged.
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
  // Item 2: 38 new entries. Maker only where unmistakable, else null.
  { name: "Ventolin", manufacturer: "GSK" },
  { name: "Zithromax", manufacturer: "Pfizer" },
  { name: "Voltaren", manufacturer: "Novartis" },
  { name: "Avil", manufacturer: "Sanofi" },
  { name: "Betnovate", manufacturer: "GSK" },
  { name: "Calpol", manufacturer: "GSK" },
  { name: "Duphalac", manufacturer: "Abbott" },
  { name: "Amoxil", manufacturer: "GSK" },
  { name: "Diflucan", manufacturer: "Pfizer" },
  { name: "Ponstan", manufacturer: "Pfizer" },
  { name: "Nuberol Forte", manufacturer: null },
  { name: "Hydryllin", manufacturer: null },
  { name: "Septran", manufacturer: null },
  { name: "Fefol", manufacturer: null },
  { name: "Surbex-Z", manufacturer: null },
  { name: "Evion", manufacturer: null },
  { name: "Ascard", manufacturer: null },
  { name: "Otrivin", manufacturer: null },
  { name: "Benadryl", manufacturer: null },
  { name: "Betadine", manufacturer: null },
  { name: "Ibuprofen", manufacturer: null },
  { name: "Diclofenac", manufacturer: null },
  { name: "Azithromycin", manufacturer: null },
  { name: "Amoxicillin", manufacturer: null },
  { name: "Metronidazole", manufacturer: null },
  { name: "Omeprazole", manufacturer: null },
  { name: "Montelukast", manufacturer: null },
  { name: "Cetirizine", manufacturer: null },
  { name: "Loratadine", manufacturer: null },
  { name: "Folic Acid", manufacturer: null },
  { name: "Albendazole", manufacturer: null },
  { name: "Mebendazole", manufacturer: null },
  { name: "Ciprofloxacin", manufacturer: null },
  { name: "Doxycycline", manufacturer: null },
  { name: "Erythromycin", manufacturer: null },
  { name: "Clarithromycin", manufacturer: null },
  { name: "Levofloxacin", manufacturer: null },
  { name: "Cefixime", manufacturer: null },
];

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function findDrug(name: string | null): DrugMatch | null {
  if (!name) return null;
  const n = norm(name);
  return LIST.find((d) => norm(d.name) === n || n.includes(norm(d.name)) || norm(d.name).includes(n)) ?? null;
}

// Exported only so the homepage medicine index can show the real list
// (same entries, same makers). No verdict logic changes.
export const DRUG_LIST: readonly DrugMatch[] = LIST;
