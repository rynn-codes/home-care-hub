import { describe, expect, it } from "vitest";
import { DUNNING, dunningStepsRemaining } from "@/domain/billing/dunning";

describe("the dunning rhythm — Karynn, 22 August", () => {
  it("retries once, the next day, the same method", () => {
    // §7.4 forbids quietly trying a different saved card; one retry of the
    // same one is what she chose.
    expect(DUNNING.maxAutomaticRetries).toBe(1);
    expect(DUNNING.retryAfterHours).toBe(24);
  });

  it("emails Wednesday and texts Thursday", () => {
    expect(DUNNING.reminderEmailWeekday).toBe(3);
    expect(DUNNING.reminderTextWeekday).toBe(4);
  });

  it("walks the steps in order and always ends at a person", () => {
    expect(
      dunningStepsRemaining({ chargeFailed: true, retriesUsed: 0, emailSent: false, textSent: false }),
    ).toEqual(["automatic_retry", "reminder_email", "reminder_text", "office_call"]);

    expect(
      dunningStepsRemaining({ chargeFailed: true, retriesUsed: 1, emailSent: true, textSent: true }),
    ).toEqual(["office_call"]);
  });

  it("does not invent a retry for an invoice nobody tried to charge", () => {
    // A send_invoice family who has not paid gets the reminders, not a card
    // retry they have no card for.
    expect(
      dunningStepsRemaining({ chargeFailed: false, retriesUsed: 0, emailSent: false, textSent: false }),
    ).toEqual(["reminder_email", "reminder_text", "office_call"]);
  });
});
