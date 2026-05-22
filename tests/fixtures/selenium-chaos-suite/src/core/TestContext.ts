import { WebDriver } from "selenium-webdriver";
import { DriverFactory } from "./DriverFactory";

export const TestContext: {
  driver: WebDriver | null;
  currentUser: any;
  currentOrderId: string;
  selectedProductName: string;
  lastError: any;
  runId: string;
  sessionBag: Record<string, any>;
} = {
  driver: null,
  currentUser: null,
  currentOrderId: "",
  selectedProductName: "",
  lastError: null,
  runId: `run-${Date.now()}`,
  sessionBag: {}
};

export async function getContextDriver() {
  if (!TestContext.driver) {
    TestContext.driver = await DriverFactory.getDriver();
  }
  return TestContext.driver;
}

export function setCurrentUser(user: any) {
  TestContext.currentUser = user;
}

export function clearContext() {
  TestContext.currentUser = null;
  TestContext.currentOrderId = "";
  TestContext.selectedProductName = "";
  TestContext.lastError = null;
  TestContext.sessionBag = {};
}
