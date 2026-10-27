import { ChangeDetectionStrategy, Component, OnDestroy, signal } from '@angular/core';

/** How long the logo shows before fading, and how long the fade takes (ms). */
const SHOW_MS = 2000;
const FADE_MS = 600;

/**
 * The IDEMS Games opening screen: the logo, centred, over its own
 * background colour, shown briefly when a game opens before fading into
 * the game. A tap skips it. Place it once at the top of a game's app
 * template; it removes itself when done.
 *
 * The logo is games-common-core/assets/idems-games-logo.jpg, which each
 * game's angular.json serves at studio/idems-games-logo.jpg.
 */
@Component({
  selector: 'puzzle-splash',
  templateUrl: './puzzle-splash.html',
  styleUrl: './puzzle-splash.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PuzzleSplash implements OnDestroy {
  protected readonly phase = signal<'showing' | 'leaving' | 'gone'>('showing');
  private timer = setTimeout(() => this.leave(), SHOW_MS);

  /** Starts fading out (also when the player taps the screen). */
  protected leave(): void {
    if (this.phase() !== 'showing') return;
    clearTimeout(this.timer);
    this.phase.set('leaving');
    this.timer = setTimeout(() => this.phase.set('gone'), FADE_MS);
  }

  ngOnDestroy(): void {
    clearTimeout(this.timer);
  }
}
