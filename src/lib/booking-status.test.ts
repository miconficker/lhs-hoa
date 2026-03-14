import { describe, expect, it } from "vitest";

import { getNextStatuses, isValidTransition } from "./booking-status";

describe("booking-status transitions", () => {
  it("allows submitted -> payment_due", () => {
    expect(getNextStatuses("submitted", "resident")).toContain("payment_due");
    expect(
      isValidTransition("submitted", "payment_due", "resident"),
    ).toBe(true);
  });

  it("allows payment_review -> confirmed", () => {
    expect(isValidTransition("payment_review", "confirmed", "resident")).toBe(
      true,
    );
  });

  it("disallows payment_due -> rejected", () => {
    expect(isValidTransition("payment_due", "rejected", "resident")).toBe(false);
  });
});
