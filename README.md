# games-common-core

Code shared by every IDEMS puzzle game, such as
[rectangles](https://github.com/IDEMSInternational/rectangles) and
[slant](https://github.com/IDEMSInternational/slant). Each game includes
this repository as a **git submodule** instead of keeping its own copy.

The games are educational phone apps (Angular + Capacitor) built from
[Simon Tatham's Portable Puzzle Collection](https://www.chiark.greenend.org.uk/~sgtatham/puzzles/).

## Contents

- `src/engine/`: framework-free TypeScript, no Angular:
  - `random/`: the seeded random generator (an exact port of the original
    collection's SHA-1 generator, so a seed gives the same puzzle as the
    original), `shuffle`, and new-seed creation
  - `algorithms/dsf.ts`: disjoint set forest (union-find), as in `dsf.c`
  - `puzzle-game.ts`: the interface every game implements
  - `game-session.ts`: new game, undo/redo, restart, solve, game IDs
  - `daily.ts`: daily puzzles at three levels: dates, the days that can be played, and the rule turning a date and level
    into the day's puzzle (the same for everyone)
  - `tutorial.ts`: the interactive tutorial engine
- `src/container/`: the Angular frame every game sits in:
  - `puzzle-screens.ts`: which screen shows (home, a daily puzzle, free
    play, Challenges, Beat the clock, timed play, the tutorial), as
    browser history so Back works
  - `puzzle-home/`: the home page: today's daily puzzles and the last 7
    days' with a streak, free play, Challenges, and the ☰ menu; and the
    Challenges page: Beat the clock (Easy, Medium, Hard or a custom size,
    with records for each), timed play with a best
    time
  - `puzzle-shell/`: the frame around a puzzle: title, day and clock
    (daily puzzle), count and time left (Beat the clock), or size and
    difficulty menus and custom size (free play, with Solve; timed play,
    with its clock and best time); undo/redo bar
  - `puzzle-menu/`: the ☰ menu of studio pages; their text is in `menu-pages.ts`
  - `puzzle-tutorial/`: the tutorial frame (captions, progress dots, Skip)
  - `daily-store.ts`, `clock-store.ts`, `timed-store.ts`,
    `tutorial-store.ts`: connect the engine to Angular (a daily puzzle
    with its clock, a Beat the clock run with its records, timed play with
    its best times, the tutorial); `session-store.ts` is free play: a
    puzzle session with its size menu, also used by timed play;
    `shell-controls.ts` is what the shell needs from them
  - `puzzle-stage/`: the app is laid out for a 393 × 852 screen (an
    iPhone 16) and scaled to the real one, so it looks the same on every
    phone; spare height or width is used (cards spread out, the board
    grows, tablets get wider cards). Each game's app.html wraps everything
    in it. Nothing scrolls except the ☰ menu's pages and the notice's text
  - `daily-records.ts`: daily results, streak and the last 7 days' games, kept
    on the device; `share.ts`: the device's share panel
  - `theme-store.ts`: light or dark theme (follows the phone until the
    player chooses with the switch in the ☰ menu)
  - `theme.scss`: design tokens, base styles and shared `.board-*` SVG
    styles, light and dark (each game defines its own piece colours for both)
  - `puzzle-fireworks/`: the orange fireworks when a puzzle is solved
    (small, normal or big, chosen by each mode)
  - `puzzle-splash/`: the IDEMS Games opening screen (logo in `assets/`)
  - `puzzle-notice/`: the welcome notice with the terms and privacy policy
  - `puzzle-switch/`: an on/off switch for game modes and settings
    under the board (e.g. Slant's Thinking, Rectangles' Lock)
  - `board-label.ts`, `first-run.ts`, `stored-setting.ts`: label
    placement, "tutorial seen" memory, settings remembered on the device
- `assets/app/`: source images for the app icon and Android's launch
  screen (the IDEMS knot), made by `tools/make-app-images.ps1`; each game
  turns them into Android resources with `npm run app-images`

## How a game uses it

The game adds this repository as a submodule in a `games-common-core`
folder at its root:

```sh
git submodule add https://github.com/IDEMSInternational/games-common-core.git games-common-core
```

and imports it through two path aliases in its `tsconfig.json`:

```jsonc
"paths": {
  "@studio/engine/*": ["./games-common-core/src/engine/*"],
  "@studio/container/*": ["./games-common-core/src/container/*"]
}
```

```ts
import { RandomState } from '@studio/engine/random/random-state';
import { PuzzleShell } from '@studio/container/puzzle-shell/puzzle-shell';
```

Its global styles start with `@use '../games-common-core/src/container/theme';`,
and its `angular.json` serves the shared images by adding to the build's
`assets`:

```json
{ "glob": "**/*", "input": "games-common-core/assets", "output": "studio" }
```

The game also installs the Capacitor plugins the shared code uses (peer
dependencies): `npm install @capacitor/app @capacitor/preferences @capacitor/share`.

**Important: one copy of Angular.** This repository deliberately has no
Angular in its dependencies (only as a peer dependency). Inside a game, the
shared files then find the game's own Angular in the game's
`node_modules`. If a second copy were installed, the apps would fail with
error NG0203. So **never run `npm install` in the submodule folder inside
a game**; run it in the game.

## Working on it

Changes are best made in a standalone clone of this repository:

```sh
npm install
npm test           # engine tests
npm run typecheck  # type-check the engine
```

The Angular container is type-checked and tested through the games that
include it. After pushing a change here, update each game to use it:

```sh
cd <game>
git submodule update --remote games-common-core
npm test -- --watch=false
git commit -am "Update games-common-core"
```

Each game keeps the version it was last updated to, so a change here never
breaks a game until that game is updated.

## Licence

MIT. Parts are ports of Simon Tatham's Portable Puzzle Collection; see
[LICENSE](LICENSE).
