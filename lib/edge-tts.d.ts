declare module "edge-tts/out/index.js" {
  export interface EdgeVoice {
    Name: string;
    ShortName: string;
    Gender: "Male" | "Female";
    Locale: string;
  }
  export function getVoices(): Promise<EdgeVoice[]>;
  export function tts(
    text: string,
    options?: { voice?: string; volume?: string; rate?: string; pitch?: string },
  ): Promise<Buffer>;
}
