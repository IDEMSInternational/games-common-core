# games-common-core

Code shared by every IDEMS puzzle game, such as
[rectangles](https://github.com/IDEMSInternational/rectangles) and
[slanted](https://github.com/IDEMSInternational/slanted). Each game includes
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
    play, Challenges, Beat the clock, timed play, the ladder, the records
    page, the tutorial), as browser history so Back works
  - `puzzle-home/`: the home page: today's daily puzzles and the last 7
    days' with a streak, free play, Challenges, and the ☰ menu; and the
    Challenges page: Beat the clock (Easy, Medium, Hard or a custom size,
    with records for each), timed play with a best time, and the ladder
    (every size in turn, with a best time per difficulty)
  - `puzzle-records/`: the records page, opened with 🏆 beside the ?:
    best daily streaks, Beat the clock records, timed play's and the
    ladder's best times, each to share or delete (after asking)
  - `puzzle-shell/`: the frame around a puzzle: title, day and clock
    (daily puzzle), count and time left (Beat the clock), rungs and clock
    (ladder), or size and difficulty menus and custom size (free play,
    with Solve; timed play, with its clock and best time); undo/redo bar
  - `puzzle-menu/`: the ☰ menu: Game options (dark theme, Show mistakes,
    which daily levels to play, resetting the records), then the studio
    pages, whose text is in `menu-pages.ts`
  - `puzzle-tutorial/`: the tutorial frame (captions, progress dots, Skip)
  - `daily-store.ts`, `clock-store.ts`, `timed-store.ts`, `ladder-store.ts`,
    `tutorial-store.ts`: connect the engine to Angular (a daily puzzle
    with its clock, a Beat the clock run with its records, timed play with
    its best times, a ladder with its best times, the tutorial); `session-store.ts` is free play: a
    puzzle session with its size menu, also used by timed play;
    `shell-controls.ts` is what the shell needs from them
  - `puzzle-stage/`: the app is laid out for a 393 × 852 screen (an
    iPhone 16) and scaled to the real one, so it looks the same on every
    phone; spare height or width is used (cards spread out, the board
    grows, tablets get wider cards). Each game's app.html wraps everything
    in it. Nothing scrolls except the ☰ menu's pages and the notice's text
  - `daily-records.ts`: daily results, streak and the last 7 days' games, kept
    on the device; `share.ts`: the device's share panel
  - `announcements-store.ts`: IDEMS's news for the ☰ menu's Announcements
    page, downloaded at most once a day from the
    [games-data](https://github.com/IDEMSInternational/games-data)
    repository (data kept apart from code), with an orange dot for
    anything new
  - `theme-store.ts`: light or dark theme (follows the phone until the
    player chooses in Game options, in the ☰ menu)
  - `theme.scss`: design tokens, base styles and shared `.board-*` SVG
    styles, light and dark (each game defines its own piece colours for both)
  - `puzzle-fireworks/`: the orange fireworks when a puzzle is solved
    (small, normal or big, chosen by each mode)
  - `puzzle-splash/`: the IDEMS Games opening screen (logo in `assets/`)
  - `puzzle-notice/`: the welcome notice with the terms and privacy policy
  - `puzzle-switch/`: an on/off switch for game modes and settings
    under the board (e.g. Slanted's Thinking, Rectangles' Lock)
  - `board-label.ts`, `first-run.ts`, `stored-setting.ts`: label
    placement, "tutorial seen" memory, settings remembered on the device
- `assets/app/`: source images for the app icon and Android's launch
  screen (the IDEMS knot), made by `tools/make-app-images.ps1`; each game
  turns them into Android resources with `npm run app-images`
- `ios-release/` and `.github/workflows/ios-release.yml`: the iOS release
  every game uses, which builds the game, signs it and uploads it to
  TestFlight; see [ios-release/README.md](ios-release/README.md)
- `android-release/` and `.github/workflows/android-release.yml`: the Android
  release every game uses, which builds the game's bundle, signs it and
  uploads it to Google Play; see
  [android-release/README.md](android-release/README.md)

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

For the releases, see [ios-release/README.md](ios-release/README.md) and
[android-release/README.md](android-release/README.md).

## A game's App ID

The App ID is the name that the app stores and phones know a game by (Apple
calls it the bundle ID, Google Play the application ID). The games use
`international.idems.games.<game>`, for example
`international.idems.games.rectangles`, following the open-app-builder apps'
`international.idems.<app>`.

**Choose it before the first release.** Once a game is on TestFlight, the App
Store or Google Play, its App ID can't change: a new App ID is a new app. Its
players wouldn't get it as an update, and what the game keeps on their phones
(records, streaks, settings) would stay with the old app.

**Setting it, for a new game.** Set `appId` in the game's `capacitor.config.ts`
before adding the Android and iOS projects:

```sh
npx cap add android
npx cap add ios
```

Each of these copies `appId` into its project, once, when it creates it. They
end up in these files, which must all agree:

| File                                              | Setting                                                                  |
| ------------------------------------------------- | ------------------------------------------------------------------------ |
| `capacitor.config.ts`                             | `appId`                                                                  |
| `android/app/build.gradle`                        | `namespace` and `applicationId`                                          |
| `android/app/src/main/res/values/strings.xml`     | `package_name` and `custom_url_scheme`                                   |
| `android/app/src/main/java/.../MainActivity.java` | its `package` line and its folders (`international/idems/games/<game>/`) |
| `ios/App/App.xcodeproj/project.pbxproj`           | `PRODUCT_BUNDLE_IDENTIFIER`, twice (Debug and Release)                   |

The iOS release reads the App ID from the Xcode project, and the Android release
from `build.gradle`, so no workflow sets it.

**Changing it.** `npx cap sync` doesn't copy `appId` again, so change it by
hand in every file in the table, moving `MainActivity.java` to the folders for
the new App ID. Then build both apps to check. Rectangles'
[pull request #2](https://github.com/IDEMSInternational/rectangles/pull/2)
is an example. For iOS, also register the new App ID and create its app in App
Store Connect, then run the next release with **allow_provisioning_changes**
ticked, so that match creates a provisioning profile for it (see
[ios-release/README.md](ios-release/README.md#adding-ios-release-to-a-game),
steps 3 and 6).

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
breaks a game until that game is updated. The exceptions are the iOS and
Android releases: games use them from `main`, so a change to them reaches every
game's next release. Try such changes from a branch first, as
[ios-release/README.md](ios-release/README.md#changing-the-release) and
[android-release/README.md](android-release/README.md#changing-the-release)
explain.

## Licence

MIT. Parts are ports of Simon Tatham's Portable Puzzle Collection; see
[LICENSE](LICENSE).
