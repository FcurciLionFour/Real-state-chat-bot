import { defineConfig } from '@playwright/test';
import path from 'node:path';

const frontendRoot = __dirname;
const backendRoot = path.resolve(frontendRoot, '../backend');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: 'http://localhost:4200',
    browserName: 'chromium',
    channel: 'chrome',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  webServer: [
    {
      command: 'npm run start:dev',
      cwd: backendRoot,
      port: 3000,
      reuseExistingServer: true,
      timeout: 120_000,
      env: {
        ...process.env,
        OPENAI_MOCK_MODE: 'true',
      },
    },
    {
      command: 'npm start -- --host localhost --port 4200',
      cwd: frontendRoot,
      port: 4200,
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
