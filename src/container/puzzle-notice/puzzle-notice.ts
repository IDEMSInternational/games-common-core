import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, input, signal, viewChild } from '@angular/core';
import { LEGAL_VERSION, PRIVACY, TERMS } from '../legal';
import { readStored, writeStored } from '../stored-setting';

/**
 * The welcome notice on a game's first launch: what the app is, that it
 * collects nothing, and that playing means agreeing to the Terms and
 * Conditions and Privacy Policy (readable here or later in the ☰ menu).
 * Shown once per version of the documents (LEGAL_VERSION), so an
 * important change shows it again. Place it once in a game's app
 * template, after the splash screen, which covers it until it fades.
 */
@Component({
  selector: 'puzzle-notice',
  templateUrl: './puzzle-notice.html',
  styleUrl: './puzzle-notice.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PuzzleNotice {
  /** The game's id (for remembering the notice was seen) and display name. */
  readonly game = input.required<{ readonly id: string; readonly name: string }>();

  protected readonly documents = [TERMS, PRIVACY];
  protected readonly open = signal(false);

  private readonly dialog = viewChild<ElementRef<HTMLElement>>('dialog');

  constructor() {
    afterNextRender(() => {
      this.open.set(readStored(this.key()) !== LEGAL_VERSION);
      setTimeout(() => this.dialog()?.nativeElement.focus());
    });
  }

  protected accept(): void {
    writeStored(this.key(), LEGAL_VERSION);
    this.open.set(false);
  }

  private key(): string {
    return `${this.game().id}.noticeSeen`;
  }
}
