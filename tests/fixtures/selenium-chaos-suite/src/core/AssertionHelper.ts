import { expect } from "chai";

export class AssertionHelper {
  static shouldContain(actual: string, expected: string, note = "") {
    expect(actual, note).to.contain(expected);
  }

  static shouldEqual(actual: any, expected: any, note = "") {
    expect(actual, note).to.equal(expected);
  }

  static shouldBeGreaterThan(actual: number, expected: number, note = "") {
    expect(actual, note).to.be.greaterThan(expected);
  }

  static shouldBeTruthy(actual: any, note = "") {
    expect(actual, note).to.equal(true);
  }
}
