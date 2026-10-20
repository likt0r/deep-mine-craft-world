// Feste Ports für die Seitentests. Per E2E_PORT verschiebbar, damit mehrere Worktrees parallel testen können.
export const E2E_APP_PORT = Number(process.env.E2E_PORT ?? 3900);
export const E2E_FAKE_PORT = E2E_APP_PORT + 1;
