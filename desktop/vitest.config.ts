import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['desktop/web/src/**/*.test.ts']
  }
});
