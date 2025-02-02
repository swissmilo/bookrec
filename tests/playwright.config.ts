import { PlaywrightTestConfig, devices } from '@playwright/test';

const config: PlaywrightTestConfig = {
  testDir: './tests/generated',
  testMatch: '**/*.spec.ts',
  timeout: 30000,
  retries: 1,
  workers: 1,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'Desktop Chrome',
      use: {
        browserName: 'chromium',
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'Mobile Chrome', 
      use: {
        browserName: 'chromium',
        ...devices['iPhone 12'],
      },
    },
  ],
  reporter: [['html', { outputFolder: 'tests/reports' }]],
  outputDir: 'tests/results',
  snapshotDir: './tests/snapshots',
  expect: {
    toHaveScreenshot: {
      threshold: 0.03,
      animations: 'disabled',
    }
  }
};

export default config; 