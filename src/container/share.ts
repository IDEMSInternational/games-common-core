import { Share } from '@capacitor/share';

/**
 * Opens the device's share panel with `text`, for the player to send
 * wherever they choose (nothing goes through IDEMS). Where there is no
 * share panel (some desktop browsers), copies the text instead. Returns a
 * message to show the player, or null if the share panel did its job.
 */
export async function shareText(title: string, text: string): Promise<string | null> {
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
