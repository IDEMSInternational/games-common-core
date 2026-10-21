import { RandomState } from './random-state';

/**
 * Shuffles `items` in place (Fisher–Yates), drawing random numbers in
 * exactly the same order as shuffle() in the original collection's misc.c,
 * so seeds produce the same puzzles.
 */
export function shuffle<T>(items: T[], random: RandomState): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = random.upto(i + 1);
    if (j !== i) [items[i], items[j]] = [items[j], items[i]];
  }
}
