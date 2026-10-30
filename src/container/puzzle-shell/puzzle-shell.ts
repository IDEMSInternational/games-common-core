import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { PuzzleSwitch } from '../puzzle-switch/puzzle-switch';
import { DailyControls, FreePlayControls, ShellControls, formatTime } from '../shell-controls';

/** Value of the size menu's "Custom…" option. */
const CUSTOM = 'custom';

/**
 * The common frame every game sits in: title, game menu (free play) or
 * day and clock (daily puzzle), the board, and the undo/redo bar. The game's board is projected into the middle;
 * game-specific tools can be projected with the `puzzleTools` attribute.
 */
@Component({
  selector: 'puzzle-shell',
  imports: [PuzzleSwitch],
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
  /** The player asked for the home page. */
  readonly back = output<void>();

  protected readonly CUSTOM = CUSTOM;
  protected readonly customOpen = signal(false);
  protected readonly customError = signal<string | null>(null);
  protected readonly shareMessage = signal<string | null>(null);
  protected readonly time = formatTime;

  protected choosePreset(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (value === CUSTOM) {
      this.customError.set(null);
      this.customOpen.set(true);
    } else {
      this.customOpen.set(false);
      this.freePlay()?.newGame(Number(value));
    }
  }

  protected chooseDifficulty(event: Event): void {
    this.freePlay()?.setDifficulty(Number((event.target as HTMLSelectElement).value));
  }

  protected submitCustom(event: Event): void {
    event.preventDefault();
    const form = new FormData(event.target as HTMLFormElement);
    const values: Record<string, number> = {};
    const controls = this.freePlay();
    if (!controls) return;
    for (const field of controls.customFields()) values[field.key] = Number(form.get(field.key));

    const error = controls.newCustomGame(values);
    this.customError.set(error);
    if (!error) this.customOpen.set(false);
  }

  protected async share(controls: DailyControls): Promise<void> {
    this.shareMessage.set(await controls.share());
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
    } else if (!command && key === 'n' && controls.kind === 'free') {
      controls.newGame();
    } else {
      return;
    }
    event.preventDefault();
  }

  private freePlay(): FreePlayControls | null {
    const controls = this.controls();
    return controls.kind === 'free' ? controls : null;
  }
}
