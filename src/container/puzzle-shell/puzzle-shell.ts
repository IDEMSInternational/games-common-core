import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { ShellControls } from '../session-store';

/** Value of the size menu's "Custom…" option. */
const CUSTOM = 'custom';

/**
 * The common frame every game sits in: title, game menu, the board, and
 * the undo/redo bar. The game's board is projected into the middle;
 * game-specific tools can be projected with the `puzzleTools` attribute.
 */
@Component({
  selector: 'puzzle-shell',
  templateUrl: './puzzle-shell.html',
  styleUrl: './puzzle-shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown)': 'onKey($event)',
  },
})
export class PuzzleShell {
  readonly controls = input.required<ShellControls>();
  /** The player asked how to play. */
  readonly help = output<void>();

  protected readonly CUSTOM = CUSTOM;
  protected readonly customOpen = signal(false);
  protected readonly customError = signal<string | null>(null);

  protected choosePreset(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (value === CUSTOM) {
      this.customError.set(null);
      this.customOpen.set(true);
    } else {
      this.customOpen.set(false);
      this.controls().newGame(Number(value));
    }
  }

  protected chooseDifficulty(event: Event): void {
    this.controls().setDifficulty(Number((event.target as HTMLSelectElement).value));
  }

  protected submitCustom(event: Event): void {
    event.preventDefault();
    const form = new FormData(event.target as HTMLFormElement);
    const values: Record<string, number> = {};
    for (const field of this.controls().customFields()) values[field.key] = Number(form.get(field.key));

    const error = this.controls().newCustomGame(values);
    this.customError.set(error);
    if (!error) this.customOpen.set(false);
  }

  protected onKey(event: KeyboardEvent): void {
    if (event.target instanceof HTMLInputElement) return; // typing in the custom form
    const controls = this.controls();
    const key = event.key.toLowerCase();
    const command = event.ctrlKey || event.metaKey;
    if ((command && key === 'z' && !event.shiftKey) || (!command && key === 'u')) {
      controls.undo();
    } else if ((command && (key === 'y' || (key === 'z' && event.shiftKey))) || (!command && key === 'r')) {
      controls.redo();
    } else if (!command && key === 'n') {
      controls.newGame();
    } else {
      return;
    }
    event.preventDefault();
  }
}
