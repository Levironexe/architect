export default {
  testDir: './tests/e2e',
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined
};
