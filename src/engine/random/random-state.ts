import { sha1 } from './sha1';

/**
 * Deterministic random number generator, ported exactly from random.c in
 * Simon Tatham's Portable Puzzle Collection. The same seed string always
 * produces the same sequence, on every platform, which means the same seed
 * always generates the same puzzle. Puzzles can therefore be shared as
 * short "game IDs", and our output can be checked against the original.
 */
export class RandomState {
  private readonly seedBuffer = new Uint8Array(40);
  private dataBuffer: Uint8Array;
  private position = 0;

  constructor(seed: string) {
    this.seedBuffer.set(sha1(new TextEncoder().encode(seed)), 0);
    this.seedBuffer.set(sha1(this.seedBuffer.subarray(0, 20)), 20);
    this.dataBuffer = sha1(this.seedBuffer);
  }

  /** Returns a random integer of the given number of bits (1 to 32). */
  bits(bits: number): number {
    let result = 0;
    for (let n = 0; n < bits; n += 8) {
      if (this.position >= 20) this.refill();
      result = result * 256 + this.dataBuffer[this.position++];
    }
    return result % 2 ** bits;
  }

  /** Returns a random integer from 0 to limit - 1, without bias. */
  upto(limit: number): number {
    if (limit < 1) throw new RangeError(`random limit must be positive: ${limit}`);
    let bits = 0;
    while (Math.floor(limit / 2 ** bits) !== 0) bits++;
    bits += 3;
    if (bits >= 32) throw new RangeError(`random limit too large: ${limit}`);

    const divisor = Math.floor(2 ** bits / limit);
    const max = limit * divisor;
    let data: number;
    do {
      data = this.bits(bits);
    } while (data >= max);
    return Math.floor(data / divisor);
  }

  private refill(): void {
    // Increment the first 20 bytes of the seed buffer as a little-endian
    // counter, then hash the whole buffer for 20 fresh bytes.
    for (let i = 0; i < 20; i++) {
      if (this.seedBuffer[i] !== 0xff) {
        this.seedBuffer[i]++;
        break;
      }
      this.seedBuffer[i] = 0;
    }
    this.dataBuffer = sha1(this.seedBuffer);
    this.position = 0;
  }
}
