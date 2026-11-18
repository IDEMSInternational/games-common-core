import { defineConfig } from 'vitest/config';

// Tests for the framework-free engine. The Angular container's tests
// (src/container/**/*.spec.ts) need Angular, so every game runs them with
// its own tests (README: How a game uses it).
export default defineConfig({
  test: {
    include: ['src/engine/**/*.spec.ts'],
    globals: true,
  },
});
