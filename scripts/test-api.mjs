// API test script. No key is ever printed.
// Usage:
//   META_API_KEY=... node scripts/test-api.mjs            -> Plan A text test
//   AI_PROVIDER=baseten BASETEN_API_KEY=... node scripts/test-api.mjs
//   node scripts/test-api.mjs photo.jpg                   -> vision test with a real pack photo
import fs from "node:fs";

const provider = (process.env.AI_PROVIDER || "meta").toLowerCase();
const cfg = provider === "baseten"
  ? { base: "https://inference.baseten.co/v1", model: process.env.BASETEN_MODEL || "meta-models/muse-spark-open", key: process.env.BASETEN_API_KEY || "" }
  : { base: "https://api.meta.ai/v1", model: process.env.META_MODEL || "muse-spark-1.3", key: process.env.META_API_KEY || "" };

if (!cfg.key) {
  console.log(`BLOCKED: no key set for provider=${provider}. Set ${provider === "baseten" ? "BASETEN_API_KEY" : "META_API_KEY"} in .env / Vercel env, never in chat or git.`);
  process.exit(2);
}
const photoPath = process.argv[2];
const content = [{ type: "text", text: photoPath ? "Read this medicine pack. Return ONLY JSON: {\"drugName\":null,\"manufacturer\":null,\"batchNumber\":null,\"expiryDate\":null,\"confidence\":0,\"barcode\":null,\"barcodeProduct\":null}" : "Reply with exactly: API-OK" }];
if (photoPath) content.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${fs.readFileSync(photoPath).toString("base64")}` } });

const res = await fetch(`${cfg.base}/chat/completions`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.key}` },
  body: JSON.stringify({ model: cfg.model, messages: [{ role: "user", content }], max_tokens: 256 }),
});
console.log("HTTP:", res.status, "provider:", provider, "model:", cfg.model);
const text = await res.text();
console.log(text.slice(0, 1000));
process.exit(res.ok ? 0 : 1);
