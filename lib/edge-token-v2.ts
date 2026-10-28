import { createHash } from "node:crypto";

// CS64 + custom-SHA256 Sec-MS-GEC v2 token, ported from the public
// edge-tts Python client (drm.py). The v2 token format is
// "<16 hex>-<64 hex>": the 64-hex part is NOT standard SHA-256 — the
// client uses a custom SHA-256 variant (custom initial state and one
// adjusted round constant) — so node:crypto alone cannot produce it.
// The CS64 part mixes the digest with fixed magic constants.
// This port is verified against the Python reference for fixed
// timestamps (see /tmp test in the build log); if it ever drifts,
// the token will simply 403 and the route reports it exactly.
const MASK = 0xffffffff;
const WIN_EPOCH = 11644473600;
const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";

const ROUND_CONSTANTS = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];
const ADJUSTMENT = 0xc9dc06a7;
const BLOCK_CONSTANTS = [...ROUND_CONSTANTS.slice(0, 14), ADJUSTMENT, ...ROUND_CONSTANTS.slice(15)];
const SHA256_INITIAL = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
const SHA256_STATE = [0xfd9fbea2, 0x91243ce7, 0xbe499094, 0xcd2e1e0a, 0x6c006f49, 0x04bd35ab, 0xfeb0a7e4, 0x03effbd2];
const SHA256_SCHEDULE = [
  0xeb24bf9e, 0x1558691f, 0xa0c09ee2, 0x0cfa32ba, 0xa622ee8c, 0xd1dd9491, 0xc0dd25a0,
  0xf9e70ab6, 0xf0c31573, 0x7058ce4e, 0x7188e606, 0x00e5ab33, 0xd258b060, 0x72766564,
];
const SIGMA0_ADJ = 0x059c0b80;
const SIGMA1_ADJ = 0x000b92c0;
const CS64_COEFFICIENTS: [number, number][] = [
  [0xe82e91b1, 0xb32700d0], [0x44de24c6, 0x88dff51d], [0x3beb65bc, 0x29514038], [0xc89c5933, 0xb328cbdf],
  [0x8d1ec211, 0xd405b4d5], [0x314ef5d5, 0x26e55f3c], [0xe92491b1, 0x607801c6], [0xf0a5b9d5, 0x82b2c1fb],
  [0x06064cf3, 0xfa51a3da], [0xda79fa60, 0x207cc464], [0xbed20560, 0x3c3c74f3], [0x89f9c9f8, 0xd2d14b61],
  [0x35fa38c6, 0xbb04a2c1], [0xcb49e3c6, 0xc5626167],
];
const CS64_FACTOR = 0x82893933;
const CS64_ADJ0 = 0xf2f90b1a;
const CS64_ADJ1 = 0x0b1a0000;

const u32 = (n: number) => n >>> 0;
const rotr = (x: number, r: number) => ((x >>> r) | (x << (32 - r))) >>> 0;
const rol16 = (v: number) => (((v & MASK) << 16) | ((v & MASK) >>> 16)) >>> 0;

function sigma0(v: number): number {
  return ((v >>> 7) ^ (v << 25) ^ (v >>> 18) ^ (v << 14) ^ (v >>> 3)) >>> 0;
}
function sigma1(v: number): number {
  return ((v >>> 17) ^ (v << 15) ^ (v >>> 19) ^ (v << 13) ^ (v >>> 10)) >>> 0;
}

function rounds(state: number[], words: number[], firstRound: number): number[] {
  let [a, b, c, d, e, f, g, h] = state;
  const K = firstRound === 14 ? BLOCK_CONSTANTS : ROUND_CONSTANTS;
  for (let i = firstRound; i < 64; i++) {
    const s1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
    const ch = (g ^ (e & (f ^ g))) >>> 0;
    const t1 = (h + s1 + ch + K[i] + words[i]) >>> 0;
    const s0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
    const maj = ((a & b) | (c & (a | b))) >>> 0;
    const t2 = (s0 + maj) >>> 0;
    h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
  }
  return [a, b, c, d, e, f, g, h];
}

function expandSchedule(words: number[], firstWord: number): void {
  for (let i = firstWord; i < 64; i++) {
    const x = words[i - 2];
    const y = words[i - 15];
    const s1 = (rotr(x, 17) ^ rotr(x, 19) ^ (x >>> 10)) >>> 0;
    const s0 = (rotr(y, 7) ^ rotr(y, 18) ^ (y >>> 3)) >>> 0;
    words.push((s1 + words[i - 7] + s0 + words[i - 16]) >>> 0);
  }
}

function sha256Init(data: Buffer): number[] {
  const words: number[] = new Array(14).fill(0);
  words.push(((data[0] << 16) | (data[1] << 8) | data[2]) >>> 0);
  words.push(((data[3] << 24) | (data[4] << 16) | (data[5] << 8) | data[6]) >>> 0);
  for (let index = 16; index < 30; index++) {
    let value = SHA256_SCHEDULE[index - 16];
    if (index - 2 >= 14) {
      value += index === 16 ? (sigma1(words[index - 2]) ^ SIGMA1_ADJ) >>> 0 : sigma1(words[index - 2]);
    }
    if (index - 7 >= 14) value += words[index - 7];
    if (index - 15 >= 14) {
      value += index === 29 ? (sigma0(words[index - 15]) ^ SIGMA0_ADJ) >>> 0 : sigma0(words[index - 15]);
    }
    words.push(value >>> 0);
  }
  words.push(
    (sigma1(words[28]) + words[23] + sigma0(words[15]) + words[14] + ADJUSTMENT - ROUND_CONSTANTS[14]) >>> 0,
  );
  expandSchedule(words, 31);
  const working = rounds(SHA256_STATE, words, 14);
  return SHA256_INITIAL.map((v, i) => (v + working[i]) >>> 0);
}

function sha256Digest(data: Buffer): Buffer {
  if (data.length < 7) throw new Error("Token salt must contain at least seven bytes");
  const length = 57 + data.length;
  const zeros = (((55 - length) % 64) + 64) % 64;
  const padded = Buffer.concat([
    data.subarray(7),
    Buffer.from([0x80]),
    Buffer.alloc(zeros),
    Buffer.alloc(8),
  ]);
  padded.writeBigUInt64BE(BigInt(length * 8), padded.length - 8);
  let state = sha256Init(data.subarray(0, 7));
  for (let offset = 0; offset < padded.length; offset += 64) {
    const words: number[] = [];
    for (let i = 0; i < 16; i++) words.push(padded.readUInt32BE(offset + i * 4));
    expandSchedule(words, 16);
    const working = rounds(state, words, 0);
    state = state.map((v, i) => (v + working[i]) >>> 0);
  }
  const out = Buffer.alloc(32);
  state.forEach((v, i) => out.writeUInt32BE(v >>> 0, i * 4));
  return out;
}

function wordsLe4Even(data: Buffer): number[] {
  const pad = (-data.length % 4 + 4) % 4;
  const padded = Buffer.concat([data, Buffer.alloc(pad)]);
  const words: number[] = [];
  for (let i = 0; i < padded.length; i += 4) words.push(padded.readUInt32LE(i));
  if (words.length % 2) words.push(0);
  return words;
}

function cs64Digest(data: Buffer, digest: Buffer): [number, number] {
  let keyA = digest.readUInt32LE(0) | 1;
  let keyB = digest.readUInt32LE(4) | 1;
  keyA >>>= 0; keyB >>>= 0;
  const factors = [Math.imul(keyA, CS64_FACTOR) >>> 0, Math.imul(keyB, CS64_FACTOR) >>> 0];
  const terms: number[] = CS64_COEFFICIENTS.map(([c], i) => Math.imul(c, factors[i % 2]) >>> 0);
  const offsets: number[] = CS64_COEFFICIENTS.map(([, o]) => o >>> 0);
  const dataWords = wordsLe4Even(Buffer.concat([Buffer.from([0]), data]));
  for (let index = 0; index < dataWords.length; index++) {
    const word = dataWords[index];
    const key = index % 2 === 0 ? keyA : keyB;
    let term = Math.imul(word, key) >>> 0;
    let offset = Math.imul(rol16(word), index % 2 === 0 ? 0xef0569fb : 0xc31713db) >>> 0;
    if (index === 0) {
      term = (term + Math.imul(CS64_ADJ0, factors[0])) >>> 0;
      offset = (offset + CS64_ADJ1) >>> 0;
    }
    terms.push(term);
    offsets.push(offset);
  }
  let swapAcc = 0;
  let swapLast = 0;
  let state = 0;
  let acc = 0;
  for (let index = 0; index < terms.length; index += 2) {
    const x = terms[index];
    const y = terms[index + 1];
    let t = rol16((offsets[index] + x) >>> 0);
    let q = Math.imul(t, 0x76f50f34) >>> 0;
    swapAcc = (swapAcc + ((Math.imul(rol16(q), 0xc3efea97) + q) >>> 0)) >>> 0;
    t = rol16((offsets[index + 1] + y) >>> 0);
    q = Math.imul(t, 0x1881ce3c) >>> 0;
    swapLast = ((Math.imul(rol16(q), 0x35bd1ec9) + q) >>> 0) >>> 0;
    swapAcc = (swapAcc + swapLast) >>> 0;
    state = (Math.imul(state, keyA) + x) >>> 0;
    state = Math.imul(rol16(state), 0xcf98b111) >>> 0;
    state = Math.imul(rol16(state), 0x87085b9f) >>> 0;
    state = Math.imul(rol16(state), 0x12ceb96d) >>> 0;
    state = Math.imul(rol16(state), 0x257e1d83) >>> 0;
    acc = (acc + state) >>> 0;
    t = (Math.imul(state, keyB) + y) >>> 0;
    t = Math.imul(rol16(t), 0xa27416f5) >>> 0;
    t = Math.imul(rol16(t), 0xd38396ff) >>> 0;
    state = Math.imul(rol16((Math.imul(rol16(t), 0x7c932b89) >>> 0)), 0xbfa49f69) >>> 0;
    acc = (acc + state) >>> 0;
  }
  return [(swapLast ^ state) >>> 0, (swapAcc ^ acc) >>> 0];
}

function tokenHash(data: Buffer): [string, string] {
  const digest = sha256Digest(data);
  const [w0, w1] = cs64Digest(data, digest);
  const cs = Buffer.alloc(8);
  cs.writeUInt32LE(w0, 0);
  cs.writeUInt32LE(w1, 4);
  return [cs.toString("hex").toUpperCase(), digest.toString("hex").toUpperCase()];
}

// Double-precision arithmetic, mirroring the Python float path exactly
// (NOT BigInt: the float rounding of ticks * 1e7 is part of the token).
export function secMsGecV2(unixSeconds?: number): string {
  let ticks = (unixSeconds ?? Math.floor(Date.now() / 1000)) + WIN_EPOCH;
  ticks -= ticks % 300;
  ticks *= 1e9 / 100;
  const str = `${ticks.toFixed(0)}${TRUSTED_CLIENT_TOKEN}`;
  const [cs64, sha] = tokenHash(Buffer.from(str, "ascii"));
  return `${cs64}-${sha}`;
}

// Sanity: standard SHA-256 of the same string (kept only to prove the v2
// digest differs from it — the v2 token must NOT use this).
export function secMsGecV1(unixSeconds?: number): string {
  let ticks = (unixSeconds ?? Math.floor(Date.now() / 1000)) + WIN_EPOCH;
  ticks -= ticks % 300;
  ticks *= 1e7;
  return createHash("sha256").update(`${ticks.toFixed(0)}${TRUSTED_CLIENT_TOKEN}`, "ascii").digest("hex").toUpperCase();
}
