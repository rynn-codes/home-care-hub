import { describe, expect, it } from "vitest";
import {
  changeStandsDespite,
  planEffects,
  recordDelivery,
  undeliveredSummary,
  type OfficeChange,
  type Recipient,
} from "@/domain/portal/notifications";
import { SMS_ROUTING } from "@/domain/portal/messaging";

const CAREGIVER: Recipient = {
  personId: "p-jamisha",
  phone: "+17135550100",
  audience: "workforce",
  firstName: "Jamisha",
};

const FAMILY: Recipient = {
  personId: "p-susan",
  phone: "+17135550110",
  audience: "family",
  firstName: "Susan",
};

function change(over: Partial<OfficeChange> = {}): OfficeChange {
  return {
    kind: "visit_scheduled",
    visitId: "v1",
    clientPersonId: "p-marcus",
    clientFirstName: "Marcus",
    recipients: [CAREGIVER, FAMILY],
    byUserId: "u-karynn",
    at: "2026-08-20T14:00:00Z",
    ...over,
  };
}

describe("§25 — the order of effects", () => {
  it("refreshes both portals from one change", () => {
    const plan = planEffects(change());
    expect(plan.refreshes).toEqual([
      { audience: "workforce", personId: "p-jamisha" },
      { audience: "family", personId: "p-susan" },
    ]);
  });

  it("writes the audit record whether or not anyone is textable", () => {
    // Step 4 is part of the change, not part of the notification.
    const plan = planEffects(change({ recipients: [] }));
    expect(plan.event.kind).toBe("visit_scheduled");
    expect(plan.event.byUserId).toBe("u-karynn");
    expect(plan.notifications).toEqual([]);
  });

  it("returns the notification as a plan rather than performing it", () => {
    // Returning a plan is what lets the caller run steps 1-4 as one unit and
    // step 5 outside it.
    const plan = planEffects(change());
    expect(plan.notifications).toHaveLength(2);
    expect(plan.notifications[0]).toMatchObject({ personId: "p-jamisha", to: "+17135550100" });
  });

  it("sends a caregiver a shift message and a family a care message", () => {
    const plan = planEffects(change());
    expect(plan.notifications.map((n) => n.purpose)).toEqual([
      "shift_notification",
      "care_notification",
    ]);
  });

  it("leaves the carrier decision to the routing table", () => {
    // This module decides the purpose. SMS_ROUTING decides the number, which
    // is where Karynn's Spruce-versus-GHL call already lives.
    const plan = planEffects(change());
    for (const n of plan.notifications) {
      expect(SMS_ROUTING[n.purpose]).toBe("spruce");
    }
  });

  it("records who Joy intended to tell", () => {
    expect(planEffects(change()).event.notifiedPersonIds).toEqual(["p-jamisha", "p-susan"]);
  });
});

describe("§25 — the portal is the source of truth", () => {
  it("keeps the change standing when a text fails", () => {
    // The visit really did move and the portals really do say so. Rolling the
    // change back because a carrier was down would leave Joy wrong about a
    // visit, which is worse in every direction than a family finding out late.
    const plan = planEffects(change());
    const records = plan.notifications.map((n) =>
      recordDelivery({ notification: n, delivered: false, at: "t" }),
    );
    expect(changeStandsDespite(records)).toBe(true);
  });

  it("treats a failed send as a recorded outcome, not an exception", () => {
    const [n] = planEffects(change()).notifications;
    const record = recordDelivery({ notification: n, delivered: false, at: "t" });
    expect(record.outcome).toBe("failed");
    expect(record.detail).toBeTruthy();
  });

  it("carries no failure detail when it went", () => {
    const [n] = planEffects(change()).notifications;
    expect(recordDelivery({ notification: n, delivered: true, at: "t" }).detail).toBeNull();
  });

  it("tells the office what did not send, and that the change is live", () => {
    // "We texted you" is what the office will assume when a family says nobody
    // told them.
    const plan = planEffects(change());
    const records = [
      recordDelivery({ notification: plan.notifications[0], delivered: true, at: "t" }),
      recordDelivery({ notification: plan.notifications[1], delivered: false, at: "t" }),
    ];
    expect(undeliveredSummary(records)).toContain("live in the portal");
    expect(undeliveredSummary(records)).toContain("One notification");
  });

  it("says nothing when everything went", () => {
    const plan = planEffects(change());
    const records = plan.notifications.map((n) =>
      recordDelivery({ notification: n, delivered: true, at: "t" }),
    );
    expect(undeliveredSummary(records)).toBeNull();
  });
});

describe("who hears about what", () => {
  it("tells only the people the office named", () => {
    const plan = planEffects(change({ recipients: [FAMILY] }));
    expect(plan.notifications.map((n) => n.personId)).toEqual(["p-susan"]);
    expect(plan.refreshes.map((r) => r.audience)).toEqual(["family"]);
  });

  it("carries the client's first name and nothing more about them", () => {
    // The message templates take a first name. Anything richer would put
    // detail in a text, which §25 rules out.
    const [n] = planEffects(change({ recipients: [FAMILY] })).notifications;
    expect(n.clientFirstName).toBe("Marcus");
    expect(Object.keys(n).sort()).toEqual([
      "clientFirstName",
      "firstName",
      "personId",
      "purpose",
      "to",
    ]);
  });
});
