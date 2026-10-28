import { randomUUID } from "node:crypto";
import { WebSocket } from "ws";
import { secMsGecV2 } from "./edge-token-v2";

// A/B test: the exact flow of the long-working `edge-tts` JS client
// (f53), which served the old host for years, with only the auth upgraded
// to the v2 token. It differs from lib/edge-v2.ts in: no subprotocol, no
// muid/accept headers, Chrome 103 UA, per-message compress flags, audio
// extracted by searching for "Path:audio\r\n", turn.end detected by
// substring on text frames. If this works where the mirrored-Python flow
// did not, one of those differences is the cause; if it also fails, Edge
// synthesis from this server is dead and the fallback is phone voice.
const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";

export function ttsF53(text: string, voice: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const uuid = () => randomUUID().replaceAll("-", "");
    const url =
      `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1` +
      `?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${secMsGecV2()}` +
      `&Sec-MS-GEC-Version=2-143.0.3650.75&ConnectionId=${uuid()}`;
    const ws = new WebSocket(url, {
      host: "speech.platform.bing.com",
      origin: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.5060.66 Safari/537.36 Edg/103.0.1264.44",
      },
    });
    const audioData: Buffer[] = [];
    let done = false;
    const timer = setTimeout(() => {
      if (!done) { done = true; try { ws.close(); } catch { /* noop */ } reject(new Error("Voice service timed out.")); }
    }, 45000);
    const finish = (err?: Error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { ws.close(); } catch { /* noop */ }
      if (err) reject(err);
      else resolve(Buffer.concat(audioData));
    };
    ws.on("message", (rawData: Buffer | string, isBinary: boolean) => {
      if (!isBinary) {
        const data2 = rawData.toString("utf8");
        if (data2.includes("turn.end")) finish();
        return;
      }
      const data = Buffer.from(rawData as Buffer);
      const separator = "Path:audio\r\n";
      const idx = data.indexOf(separator);
      if (idx !== -1) audioData.push(data.subarray(idx + separator.length));
    });
    ws.on("error", (e: Error) => finish(e));
    ws.on("close", () => {
      if (!done) {
        if (audioData.length > 0) finish();
        else finish(new Error("Voice connection closed before audio arrived."));
      }
    });
    const speechConfig = JSON.stringify({
      context: {
        synthesis: {
          audio: {
            metadataoptions: { sentenceBoundaryEnabled: false, wordBoundaryEnabled: false },
            outputFormat: "audio-24khz-48kbitrate-mono-mp3",
          },
        },
      },
    });
    const configMessage = `X-Timestamp:${Date()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n${speechConfig}`;
    ws.on("open", () =>
      ws.send(configMessage, { compress: true }, (configError) => {
        if (configError) { finish(configError); return; }
        const ssmlMessage =
          `X-RequestId:${uuid()}\r\nContent-Type:application/ssml+xml\r\n` +
          `X-Timestamp:${Date()}Z\r\nPath:ssml\r\n\r\n` +
          `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>` +
          `<voice name='${voice}'><prosody pitch='+0Hz' rate='+0%' volume='+0%'>${text}</prosody></voice></speak>`;
        ws.send(ssmlMessage, { compress: true }, (ssmlError) => {
          if (ssmlError) finish(ssmlError);
        });
      }),
    );
  });
}
