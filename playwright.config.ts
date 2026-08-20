import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // Build in Vite's "test" mode so the app uses its browser-local storage data
    // path instead of calling the Azure Functions API, which isn't available
    // when running these smoke tests. Output goes to a separate directory so it
    // doesn't clobber the production `dist` build produced by `npm run build`.
    command: 'vite build --mode test --outDir dist-e2e && vite preview --outDir dist-e2e --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
})
