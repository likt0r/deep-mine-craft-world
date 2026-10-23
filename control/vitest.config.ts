import { defineConfig } from "vitest/config";

// Die API-Tests laufen gegen die gebaute App (`npm test` baut vorher).
export default defineConfig({
  test: {
    include: ["test/api/**/*.test.ts"],
    testTimeout: 20_000,
    // Weltvorgänge (Countdown, Backup, Neustart) brauchen auch im Fake einen Moment.
    expect: { poll: { timeout: 5000 } },
    hookTimeout: 30_000
  }
});
