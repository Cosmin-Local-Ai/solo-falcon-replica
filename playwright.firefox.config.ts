import { defineConfig, devices } from '@playwright/test';
import baseConfig from './playwright.config';

/**
 * Supplementary Firefox config (Step 34, Worker 2) — kept deliverable.
 *
 * Identical to playwright.config.ts (same testDir, same webServer, same
 * `use` options) except the browser project is Firefox instead of
 * Chromium. Run the full e2e suite on Firefox with:
 *
 *   npx playwright test --config playwright.firefox.config.ts
 *
 * Do NOT modify playwright.config.ts for Firefox support; this file is
 * the dedicated supplementary config.
 */
export default defineConfig({
  ...baseConfig,
  projects: [{ name: 'firefox', use: { ...devices['Desktop Firefox'] } }],
});
