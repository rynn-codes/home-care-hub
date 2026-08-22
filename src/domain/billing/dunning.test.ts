import { describe, expect, it } from "vitest";
import {
  DUNNING,
  PAYMENT_GATE,
  dunningDatesFor,
  dunningStepsRemaining,
  todaysTouch,
  unpaidAtTheGate,
} from "@/domain/billing/dunning";

describe("Karynn's worked example, held as dates", () => {
  it("bills Aug 10 for the week of Aug 15–21, and walks her calendar", () => {
    // Her example verbatim: "Client is billed on Aug 10th for services that
    // will start on Aug 15-21st. If they do not pay by Sunday, services are
    // stopped."
    const dates = dunningDatesFor("2026-08-15");
    expect(dates.invoiceOutBy).toBe("2026-08-10"); // Monday
    expect(dates.emailsBeginOn).toBe("2026-08-12"); // Wednesday
    expect(dates.firstTextOn).toBe("2026-08-13"); // Thursday
    expect(dates.callAndTextIfUnpaidOn).toBe("2026-08-14"); // Friday
    expect(dates.servicesStopIfUnpaidBy).toBe("2026-08-16"); // Sunday
  });
});

describe("the daily rhythm", () => {
  it("retries a failed card once, the next day, the same method", () => {
    // §7.4 forbids quietly trying a different saved card; one retry of the
    // same one is what she chose.
    expect(DUNNING.maxAutomaticRetries).toBe(1);
    expect(DUNNING.retryAfterHours).toBe(24);
  });

  it("emails every day until paid — her rule, verbatim", () => {
    // "An email should be sent out every day until paid."
    expect(DUNNING.emailEveryDayUntilPaid).toBe(true);
    const saturday = todaysTouch({ weekday: 6, paid: false, emailsHaveBegun: true });
    expect(saturday.email).toBe(true);
  });

  it("Wednesday is email only; Thursday adds the text; Friday adds the call", () => {
    expect(todaysTouch({ weekday: 3, paid: false, emailsHaveBegun: false })).toEqual({
      email: true,
      text: false,
      call: false,
    });
    expect(todaysTouch({ weekday: 4, paid: false, emailsHaveBegun: true })).toEqual({
      email: true,
      text: true,
      call: false,
    });
    // "Friday will also get a call and text if not paid" — and its email.
    expect(todaysTouch({ weekday: 5, paid: false, emailsHaveBegun: true })).toEqual({
      email: true,
      text: true,
      call: true,
    });
  });

  it("stops the moment the money arrives", () => {
    expect(todaysTouch({ weekday: 5, paid: true, emailsHaveBegun: true })).toEqual({
      email: false,
      text: false,
      call: false,
    });
  });

  it("walks the escalation in order and always ends at a person", () => {
    expect(
      dunningStepsRemaining({ chargeFailed: true, retriesUsed: 0, emailSent: false, textSent: false }),
    ).toEqual(["automatic_retry", "reminder_email", "reminder_text", "office_call"]);
    expect(
      dunningStepsRemaining({ chargeFailed: false, retriesUsed: 0, emailSent: true, textSent: true }),
    ).toEqual(["office_call"]);
  });
});

describe("the Sunday gate and the deposit backstop", () => {
  it("payment is due Sunday, before Monday's shifts", () => {
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
