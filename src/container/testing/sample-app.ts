import {
  ChangeDetectionStrategy,
  Component,
  InjectionToken,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { PuzzleGame } from '../../engine/puzzle-game';
import { PuzzleHome } from '../puzzle-home/puzzle-home';
import { PuzzleNotice } from '../puzzle-notice/puzzle-notice';
import { PuzzleScreens } from '../puzzle-screens';
import { PuzzleShell } from '../puzzle-shell/puzzle-shell';
import { PuzzleSplash } from '../puzzle-splash/puzzle-splash';
import { PuzzleStage } from '../puzzle-stage/puzzle-stage';
import { PuzzleTutorial } from '../puzzle-tutorial/puzzle-tutorial';
import { SampleMove, SampleParams, SampleState, sampleGame, sampleTutorial } from './sample-game';

/** The sample app's version, as a game's package.json gives it. */
export const SAMPLE_VERSION = '1.2.3';

/** The sample game the app plays; provide sampleGame(true) for the one with difficulties. */
export const SAMPLE_GAME = new InjectionToken<PuzzleGame<SampleParams, SampleState, SampleMove>>(
  'SAMPLE_GAME',
);

/** The sample game's board: a square per cell, tapped to fill it in or empty it. */
@Component({
  selector: 'sample-board',
  template: `
    @let s = state();
    <svg [attr.viewBox]="'0 0 ' + s.w + ' ' + s.h">
      @for (cell of cells(); track $index) {
        <rect
          class="cell"
          [class.on]="cell.on"
          [attr.x]="cell.x"
          [attr.y]="cell.y"
          width="1"
          height="1"
          (click)="move.emit({ kind: 'set', at: $index, on: !cell.on })"
        />
      }
    </svg>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SampleBoard {
  readonly state = input.required<SampleState>();
  readonly hint = input<number | null>(null);
  readonly showMistakes = input(false);
  readonly move = output<SampleMove>();

  protected readonly cells = computed(() => {
    const { w, cells } = this.state();
    return Array.from(cells, (c, i) => ({ x: i % w, y: Math.floor(i / w), on: c === '1' }));
  });
}

/** A game's app, wired as every game wires it (see a game's src/app), playing the sample game. */
@Component({
  selector: 'sample-app',
  imports: [
    PuzzleHome,
    PuzzleNotice,
    PuzzleShell,
    PuzzleStage,
    PuzzleSplash,
    PuzzleTutorial,
    SampleBoard,
  ],
  template: `
    <puzzle-stage>
      <puzzle-splash />
      <puzzle-notice [game]="game" />

      @let s = screens;
      @if (s.tutorial(); as t) {
        <puzzle-tutorial [controls]="t" (skip)="s.endTutorial()">
          <sample-board [state]="t.state()" [hint]="t.hint()" (move)="t.move($event)" />
        </puzzle-tutorial>
      } @else if (s.play(); as play) {
        <puzzle-shell [controls]="play" (back)="s.goHome()" (help)="s.startTutorial()">
          <sample-board
            [state]="play.state()"
            [showMistakes]="play.showMistakes()"
            (move)="play.move($event)"
          />
        </puzzle-shell>
      } @else {
        <puzzle-home [controls]="s" />
      }
    </puzzle-stage>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SampleApp {
  readonly game = inject(SAMPLE_GAME, { optional: true }) ?? sampleGame();
  readonly screens = new PuzzleScreens(this.game, sampleTutorial, SAMPLE_VERSION);
}
