import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { GamesStore } from '../games-store';

/**
 * The other IDEMS Games, for the ☰ menu's Other IDEMS Games page: each
 * game's icon, name and one line about the puzzle, "Coming soon" while it
 * isn't in this phone's store. A tap opens the game in the store, or its
 * page until it's there.
 */
@Component({
  selector: 'puzzle-games',
  templateUrl: './puzzle-games.html',
  styleUrl: './puzzle-games.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PuzzleGames {
  protected readonly games = inject(GamesStore);
  /** Games whose icon couldn't be loaded (e.g. offline): they show a plain square instead. */
  protected readonly noIcon = signal<ReadonlySet<string>>(new Set());

  protected iconFailed(id: string): void {
    this.noIcon.update((ids) => new Set([...ids, id]));
  }
}
