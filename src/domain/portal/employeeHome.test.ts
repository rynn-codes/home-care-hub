import { describe, expect, it } from "vitest";
import {
  MISSED_AFTER_MINUTES,
  STARTS_SOON_MINUTES,
  employeeHome,
  mySchedule,
  timeRange,
  visitState,
} from "@/domain/portal/employeeHome";
import type { Visit } from "@/domain/scheduling/conflicts";
import type { ComplianceAlert } from "@/domain/credentials/alerts";

/** Clients are fictional throughout. Caregiver names here are fictional too. */
function visit(over: Partial<Visit> = {}): Visit {
  return {
    id: "v1",
    clientName: "Evelyn Carter",
    service: "Personal Care",
    caregiverName: "Jamisha",
    startsAt: "2026-08-20T09:00:00",
    endsAt: "2026-08-20T13:00:00",
    ...over,
  };
}

const NINE_AM = new Date("2026-08-20T09:00:00");
const EIGHT_AM = new Date("2026-08-20T08:00:00");

describe("§9 — one schedule, not two", () => {
  it("shows only this caregiver's visits", () => {
    const s = mySchedule({
      visits: [visit({ id: "a" }), visit({ id: "b", caregiverName: "Someone else" })],
      caregiverName: "Jamisha",
      asOf: EIGHT_AM,
    });
    expect(s.week.map((v) => v.visit.id)).toEqual(["a"]);
  });

  it("does not show an open shift nobody has been given", () => {
    // An unassigned visit is the office's problem until somebody is put on it.
    // Showing it invites a caregiver to turn up to a visit she was not given.
    const s = mySchedule({
      visits: [visit({ id: "open", caregiverName: null })],
      caregiverName: "Jamisha",
      asOf: EIGHT_AM,
    });
    expect(s.week).toEqual([]);
  });

  it("counts the week with the same function the office uses for overtime", () => {
    // A caregiver seeing 32 hours while the office sees 34 is a bug, not a
    // rounding difference. The only guarantee is one implementation.
    const s = mySchedule({
      visits: [
        visit({ id: "a", startsAt: "2026-08-20T09:00:00", endsAt: "2026-08-20T13:00:00" }),
        visit({ id: "b", startsAt: "2026-08-21T09:00:00", endsAt: "2026-08-21T17:00:00" }),
      ],
      caregiverName: "Jamisha",
      asOf: EIGHT_AM,
    });
    expect(s.weekHours).toBe(12);
  });

  it("puts the day in order regardless of how the office entered them", () => {
    const s = mySchedule({
      visits: [
        visit({ id: "late", startsAt: "2026-08-20T14:00:00", endsAt: "2026-08-20T18:00:00" }),
        visit({ id: "early", startsAt: "2026-08-20T09:00:00", endsAt: "2026-08-20T13:00:00" }),
      ],
      caregiverName: "Jamisha",
      asOf: EIGHT_AM,
    });
    expect(s.today.map((v) => v.visit.id)).toEqual(["early", "late"]);
  });
});

describe("visitState", () => {
  it("does not decide from the phone's clock that a visit has started", () => {
    // §10 keeps the server authoritative for official timestamps. A browser
    // inferring 'in progress' puts a phone clock into a payroll record.
    expect(visitState(visit(), NINE_AM)).not.toBe("in_progress");
    expect(
      visitState(visit(), NINE_AM, { clockedInAt: "2026-08-20T09:01:00", clockedOutAt: null }),
    ).toBe("in_progress");
  });

  it("nudges shortly before the start", () => {
    const soon = new Date(NINE_AM.getTime() - (STARTS_SOON_MINUTES - 1) * 60_000);
    expect(visitState(visit(), soon)).toBe("starts_soon");
  });

  it("stays quiet well before the start", () => {
    const early = new Date(NINE_AM.getTime() - (STARTS_SOON_MINUTES + 30) * 60_000);
    expect(visitState(visit(), early)).toBe("scheduled");
  });

  it("calls it missed once nobody has clocked in", () => {
    const late = new Date(NINE_AM.getTime() + (MISSED_AFTER_MINUTES + 1) * 60_000);
    expect(visitState(visit(), late)).toBe("missed");
  });

  it("is completed once clocked out, whatever the time says", () => {
    const late = new Date(NINE_AM.getTime() + 600 * 60_000);
    expect(
      visitState(visit(), late, {
        clockedInAt: "2026-08-20T09:01:00",
        clockedOutAt: "2026-08-20T13:03:00",
      }),
    ).toBe("completed");
  });
});

describe("employeeHome", () => {
  function alert(over: Partial<ComplianceAlert> = {}): ComplianceAlert {
    return {
      employeeId: "e1",
      employeeName: "Jamisha",
      credentialType: "tb_test",
      label: "Jamisha's TB test",
      severity: "warning",
      dueOn: "2026-09-17",
      daysRemaining: 28,
      ...over,
    };
  }

  function build(over: Partial<Parameters<typeof employeeHome>[0]> = {}) {
    return employeeHome({
      schedule: mySchedule({ visits: [visit()], caregiverName: "Jamisha", asOf: EIGHT_AM }),
      greetingName: "Jamisha",
      employeeId: "e1",
      alerts: [],
      asOf: EIGHT_AM,
      ...over,
    });
  }

  it("greets by the time of day", () => {
    expect(build().greeting).toBe("Good morning, Jamisha");
    expect(build({ asOf: new Date("2026-08-20T15:00:00") }).greeting).toBe("Good afternoon, Jamisha");
  });

  it("never shows a colleague's lapsed credential", () => {
    // A quiet leak: nothing would look wrong, there would simply be somebody
    // else's name on somebody's phone.
    const view = build({ alerts: [alert({ employeeId: "e2", employeeName: "Someone else" })] });
    expect(view.documents).toEqual([]);
  });

  it("rephrases the alert around the credential, not the person", () => {
    // "Jamisha's TB test" is right for the office list and wrong when the
    // person reading it is Jamisha.
    const view = build({ alerts: [alert()] });
    expect(view.documents[0].label).toBe("TB test");
    expect(view.documents[0].detail).toBe("Expires in 28 days");
  });

  it("puts a blocking credential ahead of the day's visit", () => {
    // Somebody who cannot legally work should not be told to start a visit.
    const view = build({ alerts: [alert({ severity: "blocking", daysRemaining: -3 })] });
    expect(view.headline).toContain("TB test");
    expect(view.action?.to).toBe("/portal/work/documents");
  });

  it("otherwise leads with the visit in front of them", () => {
    const view = build();
    expect(view.headline).toContain("Evelyn Carter");
    expect(view.action?.label).toBe("Start visit");
  });

  it("switches the action once the visit is under way", () => {
    const view = build({
      schedule: mySchedule({
        visits: [visit()],
        caregiverName: "Jamisha",
        asOf: NINE_AM,
        clocks: [{ visitId: "v1", clockedInAt: "2026-08-20T09:01:00", clockedOutAt: null }],
      }),
      asOf: NINE_AM,
    });
    expect(view.headline).toBe("You're with Evelyn Carter");
    expect(view.action?.label).toBe("Chart visit");
  });

  it("does not hide a visit somebody is late for", () => {
    // The bug this replaces: `missed` was not in the selection order, so a
    // caregiver twenty minutes late got "Nothing scheduled today" while a
    // client sat waiting. That is how a missed visit becomes one nobody
    // noticed.
    const late = new Date("2026-08-20T09:30:00");
    const view = build({
      schedule: mySchedule({ visits: [visit()], caregiverName: "Jamisha", asOf: late }),
      asOf: late,
    });
    expect(view.now?.state).toBe("missed");
    expect(view.headline).toContain("was expecting you at 9:00 AM");
    expect(view.action?.label).toBe("Start visit");
  });

  it("does not open by accusing somebody who may be stuck in traffic", () => {
    const late = new Date("2026-08-20T09:30:00");
    const view = build({
      schedule: mySchedule({ visits: [visit()], caregiverName: "Jamisha", asOf: late }),
      asOf: late,
    });
    expect(view.headline).not.toMatch(/late|missed|overdue/i);
  });

  it("says so plainly when there is nothing on", () => {
    const view = build({
      schedule: mySchedule({ visits: [], caregiverName: "Jamisha", asOf: EIGHT_AM }),
    });
    expect(view.headline).toBe("Nothing scheduled today");
    expect(view.action).toBeNull();
  });

  it("points at the next day when today is empty but the week is not", () => {
    const view = build({
      schedule: mySchedule({
        visits: [visit({ startsAt: "2026-08-22T09:00:00", endsAt: "2026-08-22T13:00:00" })],
        caregiverName: "Jamisha",
        asOf: EIGHT_AM,
      }),
    });
    expect(view.headline).toContain("next is Evelyn Carter");
  });
});

describe("timeRange", () => {
  it("reads the way somebody would say it", () => {
    expect(timeRange(visit())).toBe("9:00 AM – 1:00 PM");
    expect(
      timeRange(visit({ startsAt: "2026-08-20T14:30:00", endsAt: "2026-08-20T18:00:00" })),
    ).toBe("2:30 PM – 6:00 PM");
  });
});
