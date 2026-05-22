import dotenv from "dotenv";

dotenv.config();

export const ENV = {
  baseUrl: process.env.BASE_URL || "https://www.saucedemo.com",
  browserName: process.env.BROWSER || "chrome",
  headless: process.env.HEADLESS === "true",
  adminEmail: process.env.ADMIN_EMAIL || "admin@petcarehub.local",
  adminPassword: process.env.ADMIN_PASSWORD || "admin123",
  defaultPassword: process.env.DEFAULT_PASSWORD || "Password123!",
  slowModeMs: Number(process.env.SLOW_MODE_MS || 500),
  retries: Number(process.env.RETRIES || 0),
  screenshotOnFailure: process.env.SCREENSHOT_ON_FAILURE !== "false"
};
