// Checks every puzzle a game recorded from the original C code, not only
// the sample that `npm test` checks (see src/engine/reference-puzzles.ts).
// Run it whenever a game's generator or solver changes.
//
// Usage, from the game's folder: npm run test:puzzles
// (the game's package.json: "test:puzzles": "node games-common-core/tools/test-all-puzzles.mjs")
import { execSync } from 'node:child_process';

process.env.ALL_PUZZLES = '1';
execSync('npx ng test --watch=false --include "src/games/*/generator/generate.spec.ts"', {
  stdio: 'inherit',
});
