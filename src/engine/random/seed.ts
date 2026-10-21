/**
 * Makes a new random 15-digit seed string, in the same format as the
 * original puzzle collection (no leading zero). Uses the platform's
 * secure random source; only the resulting seed needs to be reproducible.
 */
export function newSeed(): string {
  const digits = new Uint32Array(15);
  crypto.getRandomValues(digits);
  let seed = String(1 + (digits[0] % 9));
  for (let i = 1; i < 15; i++) seed += String(digits[i] % 10);
  return seed;
}
