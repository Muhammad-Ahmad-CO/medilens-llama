import { createHash, randomUUID } from "node:crypto";
import { WebSocket } from "ws";

// Microsoft Edge neural voices, v2 route (free, no key, unofficial).
// The old v1 host (speech.platform.bing.com) with the old client started
// returning 403, so this uses the newer host that Edge itself now uses:
//   wss://api.msedgeservices.com/tts/cognitiveservices/websocket/v1
// with the same time-based SHA-256 Sec-MS-GEC token (adapted from the
// public Edge client protocol; token = SHA256(windowsTicks + clientToken)).
// If the new host also rejects the handshake, the caller retries the old
// host once with the same token and a current version string — the two
// attempts cover both the host-migration and the version-rotation causes
// of the 403 without any key or card.
const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const SEC_MS_GEC_VERSION = "1-155.0.4283.45";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36 Edg/155.0.0.0";
const ORIGIN = "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold";

function secMsGec(): string {
  const ticks = Math.floor(Date.now() / 1000) + 11644473600;
  const rounded = ticks - (ticks % 300);
  const windowsTicks = rounded * 10_000_000;
  return createHash("sha256")
    .update(`${windowsTicks}${TRUSTED_CLIENT_TOKEN}`, "ascii")
    .digest("hex")
    .toUpperCase();
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function headerPath(head: string): string {
  return /Path:([^\r\n]*)/i.exec(head)?.[1]?.trim() ?? "";
}

function parseBinaryFrame(data: Buffer): { path: string; body: Buffer } {
  if (data.length < 2) return { path: "", body: Buffer.alloc(0) };
  const headerLength = (data[0] << 8) | data[1];
  const head = data.subarray(2, 2 + headerLength).toString("utf8");
  return { path: headerPath(head), body: data.subarray(2 + headerLength) };
}

function parseTextFrame(text: string): { path: string; body: string } {
  const split = text.indexOf("\r\n\r\n");
  if (split === -1) return { path: headerPath(text), body: "" };
  return { path: headerPath(text.slice(0, split)), body: text.slice(split + 4) };
}

function synthOnce(text: string, voice: string, url: string, timeoutMs: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const requestId = randomUUID().replaceAll("-", "");
    const locale = voice.split("-").slice(0, 2).join("-") || "en-US";
    const timestamp = new Date().toUTCString();
    const chunks: Buffer[] = [];
    let done = false;
    const timer = setTimeout(() => {
      if (!done) { done = true; try { ws.close(); } catch { /* noop */ } reject(new Error("Voice service timed out.")); }
    }, timeoutMs);
    const finish = (err?: Error, buf?: Buffer) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { ws.close(); } catch { /* noop */ }
      if (err) reject(err);
      else resolve(buf ?? Buffer.concat(chunks));
    };
    const ws = new WebSocket(url, {
      protocol: "synthesize",
      headers: {
        "User-Agent": UA,
        Origin: ORIGIN,
        Pragma: "no-cache",
        "Cache-Control": "no-cache",
      },
    });
    ws.on("open", () => {
      ws.send(
        `X-Timestamp:${timestamp}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
          `{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":false,"wordBoundaryEnabled":false},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`,
      );
      const ssml =
        `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${locale}">` +
        `<voice name="${voice}"><prosody pitch="+0Hz" rate="+0%" volume="+0%">${escapeXml(text)}</prosody></voice></speak>`;
      ws.send(
        `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${timestamp}\r\nPath:ssml\r\n\r\n${ssml}`,
      );
    });
    ws.on("message", (data: Buffer | string) => {
      if (typeof data === "string") {
        const f = parseTextFrame(data);
        if (f.path === "turn.end") finish();
        return;
      }
      const f = parseBinaryFrame(Buffer.from(data));
      if (f.path === "audio") chunks.push(f.body);
      else if (f.path === "turn.end") finish();
    });
    ws.on("error", (e: Error) => finish(e));
    ws.on("close", () => {
      if (!done) finish(new Error("Voice connection closed before audio arrived."));
    });
  });
}

// New host first, old host once on handshake rejection. Throws the last
// error with both attempts named, so the route can report it exactly.
export async function synthesizeEdge(text: string, voice: string): Promise<Buffer> {
  const connectionId = randomUUID().replaceAll("-", "");
  const token = secMsGec();
  const urls = [
    `wss://api.msedgeservices.com/tts/cognitiveservices/websocket/v1?Ocp-Apim-Subscription-Key=${TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${token}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}&ConnectionId=${connectionId}`,
    `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${token}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}&ConnectionId=${connectionId}`,
  ];
  let lastErr: unknown = null;
  for (let i = 0; i < urls.length; i++) {
    try {
      return await synthOnce(text, voice, urls[i], 30000);
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : "";
      const handshake = /Unexpected server response: (401|403)/.test(msg);
      if (!handshake || i === urls.length - 1) throw e;
      // Otherwise fall through to the next host.
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Voice failed.");
}
