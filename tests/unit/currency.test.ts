import { describe, expect, it } from "vitest";
import { formatCurrency } from "../../src/shared/lib/currency";

describe("formatCurrency", () => {
  it("formats whole yuan amounts for the Chinese locale", () => {
    expect(formatCurrency(1286400)).toBe("¥1,286,400");
  });
});
