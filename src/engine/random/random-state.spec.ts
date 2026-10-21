import { RandomState } from './random-state';
import { sha1 } from './sha1';

const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
const ascii = (text: string) => new TextEncoder().encode(text);

describe('sha1', () => {
  it('matches the standard test vectors', () => {
    expect(hex(sha1(ascii('')))).toBe('da39a3ee5e6b4b0d3255bfef95601890afd80709');
    expect(hex(sha1(ascii('abc')))).toBe('a9993e364706816aba3e25717850c26c9cd0d89d');
    expect(hex(sha1(ascii('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')))).toBe(
      '84983e441c3bd26ebaae4aa1f95129e5e54670f1',
    );
  });
});

describe('RandomState', () => {
  it('gives the same sequence for the same seed', () => {
    const a = new RandomState('123456789012345');
    const b = new RandomState('123456789012345');
    for (let i = 0; i < 100; i++) expect(a.upto(1000)).toBe(b.upto(1000));
  });

  it('stays within range', () => {
    const random = new RandomState('range');
    for (let i = 0; i < 1000; i++) {
      const n = random.upto(7);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(7);
    }
  });
});
