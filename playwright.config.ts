import { defineConfig, devices } from '@playwright/test';

// End-to-end tests drive the real app in a browser, on the in-browser mock server.
// Every test gets a fresh browser context, so localStorage (the mock database) starts from the seed.
const PORT = 5180;

// Runs in Node; declared here so the app's tsconfig doesn't need Node's types.
declare const process: { env: Record<string, string | undefined> };

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  // Half the cores, with a roomier wait: on a busy laptop, all-out parallel runs made page loads miss 5s.
  workers: '50%',
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      // Allow anti-aliasing noise, not real changes: up to 0.2% of pixels may differ slightly.
      maxDiffPixelRatio: 0.002,
      animations: 'disabled',
      caret: 'hide',
      // Phone screenshots at CSS pixels, not 2.75×, to keep the files small.
      scale: 'css',
      stylePath: 'e2e/visual/hide-dynamic.css',
    },
  },
  // Baselines differ between operating systems (font rendering), so each OS keeps its own set.
  snapshotPathTemplate: '{testDir}/visual/__screenshots__/{platform}/{projectName}/{arg}{ext}',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, grepInvert: /@mobile|@perf|@visual/ },
    { name: 'mobile', use: { ...devices['Pixel 5'] }, grep: /@mobile/ },
    // `npm run perf`: page-weight budgets on a phone-sized screen, one page at a time.
    { name: 'perf', use: { ...devices['Desktop Chrome'], viewport: { width: 412, height: 860 } }, grep: /@perf/ },
    // `npm run visual`: screenshot comparisons, at a laptop size and a phone size.
    { name: 'visual-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } }, grep: /@visual/ },
    { name: 'visual-phone', use: { ...devices['Pixel 5'] }, grep: /@visual/ },
  ],
  webServer: {
    // A production build: it's what users get, and pages load at once instead of compiling on first visit.
    // Built into its own folder so it never replaces the real `dist`.
    command: `npx vite build --outDir dist-e2e --emptyOutDir && npx vite preview --outDir dist-e2e --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    // No artificial network delay by default: tests wait on the page, not on timers.
    // E2E_LATENCY=1500 slows every API call, to look at loading states.
    env: { VITE_MOCK_LATENCY: process.env.E2E_LATENCY ?? '0', VITE_MOCK_FAIL_RATE: '0' },
    timeout: 180_000,
  },
});
