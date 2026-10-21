/**
 * SHA-1 digest. Used only as the core of the deterministic random number
 * generator (see random-state.ts), not for security.
 */

const H0 = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];

function rol(x: number, n: number): number {
  return ((x << n) | (x >>> (32 - n))) >>> 0;
}

function transform(digest: number[], block: Uint32Array): void {
  const w = new Uint32Array(80);
  w.set(block);
  for (let t = 16; t < 80; t++) {
    w[t] = rol(w[t - 3] ^ w[t - 8] ^ w[t - 14] ^ w[t - 16], 1);
  }

  let [a, b, c, d, e] = digest;
  for (let t = 0; t < 80; t++) {
    let f: number;
    let k: number;
    if (t < 20) {
      f = (b & c) | (~b & d);
      k = 0x5a827999;
    } else if (t < 40) {
      f = b ^ c ^ d;
      k = 0x6ed9eba1;
    } else if (t < 60) {
      f = (b & c) | (b & d) | (c & d);
      k = 0x8f1bbcdc;
    } else {
      f = b ^ c ^ d;
      k = 0xca62c1d6;
    }
    const tmp = (rol(a, 5) + (f >>> 0) + e + w[t] + k) >>> 0;
    e = d;
    d = c;
    c = rol(b, 30);
    b = a;
    a = tmp;
  }

  digest[0] = (digest[0] + a) >>> 0;
  digest[1] = (digest[1] + b) >>> 0;
  digest[2] = (digest[2] + c) >>> 0;
  digest[3] = (digest[3] + d) >>> 0;
  digest[4] = (digest[4] + e) >>> 0;
}

/** Returns the 20-byte SHA-1 digest of `data`. */
export function sha1(data: Uint8Array): Uint8Array {
  // Pad: 0x80, zeros, then the bit length as a 64-bit big-endian number.
  const paddedLength = Math.ceil((data.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(data);
  padded[data.length] = 0x80;
  const bitLength = data.length * 8;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000));
  view.setUint32(paddedLength - 4, bitLength >>> 0);

  const digest = [...H0];
  const block = new Uint32Array(16);
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let i = 0; i < 16; i++) block[i] = view.getUint32(offset + i * 4);
    transform(digest, block);
  }

  const out = new Uint8Array(20);
  const outView = new DataView(out.buffer);
  digest.forEach((word, i) => outView.setUint32(i * 4, word));
  return out;
}
