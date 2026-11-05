import { Share } from '@capacitor/share';

/**
 * A game's page in the games-data repository, which sends phones on to the
 * game in their own store (or says it's coming soon). Shared messages link
 * to it rather than to a store, as the friend may have another kind of
 * phone, and so that the link works before the game is in the stores.
 */
export const gamePage = (gameId: string) => `https://idemsinternational.github.io/games-data/${gameId}/`;

/**
 * Opens the device's share panel with `text` and a link to the game's page
 * (see gamePage), for the player to send wherever they choose (nothing goes
 * through IDEMS). Where there is no share panel (some desktop browsers),
 * copies the text instead. Returns a message to show the player, or null if
 * the share panel did its job.
 */
export async function shareText(gameId: string, title: string, message: string): Promise<string | null> {
  const text = `${message}\n${gamePage(gameId)}`;
  let canShare = false;
  try {
    canShare = (await Share.canShare()).value;
  } catch {
    // No share panel.
  }
  if (canShare) {
    try {
      await Share.share({ title, text, dialogTitle: title });
    } catch {
      // The player closed the panel without sharing.
    }
    return null;
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'Copied, ready to paste';
  } catch {
    return "Sharing isn't available here";
  }
}
