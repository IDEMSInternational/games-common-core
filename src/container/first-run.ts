import { readStored, writeStored } from './stored-setting';

/**
 * Remembers on this device whether the player has seen a game's tutorial.
 * If storage is unavailable, the tutorial simply shows again, which is
 * harmless.
 */
const key = (gameId: string) => `${gameId}.tutorialSeen`;

export function hasSeenTutorial(gameId: string): boolean {
  return readStored(key(gameId)) === '1';
}

export function markTutorialSeen(gameId: string): void {
  writeStored(key(gameId), '1');
}
