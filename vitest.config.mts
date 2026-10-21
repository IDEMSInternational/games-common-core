import { defineConfig } from 'vitest/config';

// Tests for the framework-free engine. The Angular container is tested
// through each game's own tests.
export default defineConfig({
  test: {
    include: ['src/engine/**/*.spec.ts'],
    globals: true,
  },
});
