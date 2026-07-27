import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './test/e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    // baseURL: 'http://127.0.0.1:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        launchOptions: {
          firefoxUserPrefs: {
            'ui.primaryPointerCapabilities': 6,
            'ui.allPointerCapabilities': 6,
          },
        },
      },
    },
    /* TODO: investigate why webkit appears to be broken */
    /*{
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },*/

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests. LP_PORT moves it off
     the default so a worktree doesn't reuse the server of another checkout —
     which would silently test that checkout's code instead of this one's. */
  webServer: {
    command: 'npm run start',
    url: `http://127.0.0.1:${process.env.LP_PORT || '3000'}`,
    reuseExistingServer: !process.env.CI,
    env: {
      NODE_CONFIG: JSON.stringify({
        port: Number(process.env.LP_PORT || 3000),
        deployUrl: `http://localhost:${process.env.LP_PORT || '3000'}`,
        // Lets the suite exercise the moderator-only endpoints. Names have to be
        // fixed rather than generated, since the list is read at startup. One
        // per worker, because a user row holds a single session token - sharing
        // an account across workers would sign each other out.
        moderators: Array.from({ length: 32 }, (_, i) => `lpe2emoderator${i}`),
      }),
    },
  },
});
