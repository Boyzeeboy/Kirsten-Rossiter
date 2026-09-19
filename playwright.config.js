// playwright.config.js
//
// Visual regression only. There is nothing else Playwright does here.
//
// One browser, because the question is "did the pixels move", not "does it
// work in Safari". Two widths, because the layout has one breakpoint that
// matters — the hamburger — and a phone and a laptop sit either side of it.
//
// Baselines carry the platform in their path. Chromium on macOS and Chromium
// on Linux rasterise the same fonts differently enough to fail every
// comparison, so the committed baselines are the Linux ones CI generates, and
// anything a local run writes lands under a directory .gitignore keeps out.
// See .github/workflows/visual-regression.yml for how baselines get made.

// @ts-check
import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: './tests',
  snapshotPathTemplate: 'tests/screenshots/{platform}/{projectName}/{arg}{ext}',

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // No retries anywhere. A screenshot that passes on the second go is flaky,
  // and a retry would hide exactly the thing this suite exists to surface.
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],

  expect: {
    toHaveScreenshot: {
      // Fast-forward finite CSS animations and transitions to their end state
      // before capturing. This is what makes the homepage hero visible: it is
      // opacity 0 until a delayed `fadeUp … forwards` completes, and simply
      // switching animations off would freeze it invisible.
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    },
  },

  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    // Triggers the pages' own reduced-motion rules: building-the-nations
    // makes its scroll-reveal blocks visible without waiting on an
    // IntersectionObserver, and contact.html drops its transitions.
    reducedMotion: 'reduce',
    colorScheme: 'light',
    locale: 'en-GB',
    timezoneId: 'Africa/Johannesburg',
  },

  projects: [
    {
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1,
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 1,
      },
    },
  ],

  webServer: {
    command: `node scripts/static-server.mjs ${PORT}`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 10_000,
  },
});
