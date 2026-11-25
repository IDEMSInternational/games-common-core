/**
 * Each game's recorded puzzles: generated, and solved, by the original C
 * code (the game's tools/c-reference), which the port must reproduce
 * exactly. Every game checks them the same way, one test per puzzle (see
 * the game's generator/generate.spec.ts).
 *
 * `npm test` checks a sample: the first few puzzles of each setting.
 * `npm run test:puzzles` checks them all; run it whenever a generator or
 * solver changes.
 */

/** A puzzle recorded from the original: its settings, seed, puzzle text and solution. */
export interface ReferencePuzzle {
  readonly params: string;
  readonly seed: string;
  readonly description: string;
  readonly solution: string;
}

/** How many recorded puzzles of each setting `npm test` checks. */
export const SAMPLE_PER_SETTING = 3;

/** The recorded puzzles to check: all of them under `npm run test:puzzles`, else the sample. */
export function referencePuzzlesToCheck<T extends ReferencePuzzle>(
  all: readonly T[],
): readonly T[] {
  if (checkingAll()) return all;
  const seen = new Map<string, number>();
  return all.filter((puzzle) => {
    const count = seen.get(puzzle.params) ?? 0;
    seen.set(puzzle.params, count + 1);
    return count < SAMPLE_PER_SETTING;
  });
}

/** True under `npm run test:puzzles` (tools/test-all-puzzles.mjs sets ALL_PUZZLES). */
function checkingAll(): boolean {
  const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process
    ?.env;
  return env?.['ALL_PUZZLES'] === '1';
}
