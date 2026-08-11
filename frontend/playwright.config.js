const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './playwright',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Run tests one at a time so only 1 Chrome window is open and to respect API rate limits
  reporter: 'html',
  timeout: 90 * 1000, // 90s per test to prevent timeouts in slow-mo
  expect: {
    timeout: 30 * 1000, // 30s assertion timeout
  },
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    headless: true, // Run in headless mode
  },
  projects: [
    {
      name: 'chrome',
      use: { 
        ...devices['Desktop Chrome'],
        channel: 'chrome', // Use actual installed Google Chrome browser
        launchOptions: {
          slowMo: 800, // Wait 800ms between actions to show typing clearly and prevent timeouts
        }
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
