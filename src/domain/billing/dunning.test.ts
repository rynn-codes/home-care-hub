import { describe, expect, it } from "vitest";
import { DUNNING, PAYMENT_GATE, dunningStepsRemaining, unpaidAtTheGate } from "@/domain/billing/dunning";

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

describe("the Sunday gate and the deposit backstop", () => {
  it("payment is due Sunday, before the shifts", () => {
    expect(PAYMENT_GATE.dueByWeekday).toBe(0);
  });

  it("tells the office, and never acts", () => {
    // "If they don't pay by Sunday, the day before the shift, then services
    // stop" — Karynn's rule. §18.12's rule too: never as an automated
    // consequence. The function returns words for a person, not a cancellation.
    const covered = unpaidAtTheGate({
      clientName: "Evelyn Carter",
      balance: 360,
      depositRemaining: 360,
    });
    expect(covered.depositCovers).toBe(true);
    expect(covered.detail).toContain("your call");

    const exposed = unpaidAtTheGate({
      clientName: "Evelyn Carter",
      balance: 500,
      depositRemaining: 360,
    });
    expect(exposed.depositCovers).toBe(false);
    expect(exposed.detail).toContain("does not cover");
  });
});
