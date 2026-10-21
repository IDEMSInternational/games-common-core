/**
 * Remembers on this device whether the player has seen a game's tutorial.
 * Storage can be unavailable (private browsing, blocked site data); then
 * the tutorial simply shows again, which is harmless.
 */
const key = (gameId: string) => `${gameId}.tutorialSeen`;

export function hasSeenTutorial(gameId: string): boolean {
  try {
    return localStorage.getItem(key(gameId)) === '1';
  } catch {
    return false;
  }
}

export function markTutorialSeen(gameId: string): void {
  try {
    localStorage.setItem(key(gameId), '1');
  } catch {
    // Not remembered; see above.
  }
}
