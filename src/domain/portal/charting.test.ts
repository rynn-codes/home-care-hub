import { describe, expect, it } from "vitest";
import {
  chartLines,
  confirmChart,
  draftFromRecord,
  editLine,
  markValidated,
  validateDraft,
  withNarrative,
  withVerbatimObservation,
  type ChartDraft,
} from "@/domain/portal/charting";
import { VerbatimChartDraftingService } from "@/domain/portal/memoryAdapters";
import { newVisitRecord, type CareTask, type VisitRecord } from "@/domain/portal/visit";

const TASKS: CareTask[] = [
  { id: "bathing", label: "Bathing", required: true },
  { id: "meal", label: "Meal", required: true },
  { id: "medication", label: "Medication reminder", required: true },
];

const NARRATIVE =
  "She showered with standby assistance. She ate all of breakfast. I reminded her about her " +
  "morning medication. She was tired but otherwise okay. No falls.";

function record(over: Partial<VisitRecord> = {}): VisitRecord {
  return {
    ...newVisitRecord("v1"),
    tasks: { bathing: "done", meal: "done", medication: "done" },
    note: NARRATIVE,
    incidentAnswered: true,
    incidentOccurred: false,
    incidentDetail: "",
    ...over,
  };
}

function draft(): ChartDraft {
  return markValidated(withVerbatimObservation(draftFromRecord(record(), TASKS, "v1")));
}

describe("what needs no model at all", () => {
  it("builds task lines from what the caregiver tapped", () => {
    // These cannot be wrong, because no language understanding produced them.
    const d = draftFromRecord(record(), TASKS, "v1");
    const bathing = d.lines.find((l) => l.heading === "Bathing");
    expect(bathing?.body).toBe("Completed");
    expect(bathing?.source.kind).toBe("recorded");
  });

  it("records a decline as a decline, not as an omission", () => {
    const d = draftFromRecord(record({ tasks: { bathing: "declined" } }), TASKS, "v1");
    expect(d.lines.find((l) => l.heading === "Bathing")?.body).toBe("Declined by client");
  });

  it("keeps chart wording separate from button wording", () => {
    // 'Client declined' is right on a button; 'Declined by client' is right in
    // a clinical record. Collapsing them puts button text in a document.
    const d = draftFromRecord(record({ tasks: { bathing: "declined" } }), TASKS, "v1");
    expect(d.lines.find((l) => l.heading === "Bathing")?.body).not.toBe("Client declined");
  });

  it("writes the incident line from the explicit answer", () => {
    expect(draftFromRecord(record(), TASKS, "v1").lines.at(-1)).toMatchObject({
      heading: "Incident",
      body: "None reported",
    });
  });

  it("says nothing about an incident that was never asked about", () => {
    const d = draftFromRecord(record({ incidentAnswered: false }), TASKS, "v1");
    expect(d.lines.some((l) => l.heading === "Incident")).toBe(false);
  });

  it("omits a task the caregiver did not answer rather than guessing", () => {
    const d = draftFromRecord(record({ tasks: { bathing: "done" } }), TASKS, "v1");
    expect(d.lines.map((l) => l.heading)).not.toContain("Meal");
  });
});

describe("§12 — AI must not invent missing clinical facts", () => {
  it("rejects a drafted line that cites nothing", () => {
    const bad: ChartDraft = {
      ...draft(),
      lines: [
        {
          heading: "Observation",
          body: "Client's appetite has improved since last week.",
          source: { kind: "drafted", reference: "" },
        },
      ],
    };
    const result = validateDraft(bad);
    expect(result.ok).toBe(false);
    expect(result.problems[0].problem).toBe("uncited_claim");
  });

  it("rejects a drafted line citing text the caregiver never wrote", () => {
    // The realistic failure: a plausible clinical detail nobody reported.
    const bad: ChartDraft = {
      ...draft(),
      lines: [
        {
          heading: "Observation",
          body: "Client reported pain in her left hip.",
          source: { kind: "drafted", reference: "she said her hip was hurting" },
        },
      ],
    };
    expect(validateDraft(bad).ok).toBe(false);
  });

  it("accepts a drafted line that paraphrases something she did write", () => {
    const ok: ChartDraft = {
      ...draft(),
      lines: [
        {
          heading: "Observation",
          body: "Client appeared more tired than usual.",
          source: { kind: "drafted", reference: "She was tired but otherwise okay" },
        },
      ],
    };
    expect(validateDraft(ok).ok).toBe(true);
  });

  it("catches a quote that is not actually a quote", () => {
    const bad: ChartDraft = {
      ...draft(),
      lines: [
        {
          heading: "Observation",
          body: "She was exhausted.",
          source: { kind: "quoted", reference: "She was tired but otherwise okay" },
        },
      ],
    };
    expect(validateDraft(bad).problems[0].problem).toBe("misquote");
  });

  it("does not police lines that came from structured answers", () => {
    // A recorded line has nothing to cite and needs none.
    expect(validateDraft(draftFromRecord(record(), TASKS, "v1")).ok).toBe(true);
  });

  it("rejects an empty line whatever its source", () => {
    const bad: ChartDraft = {
      ...draft(),
      lines: [{ heading: "Observation", body: "   ", source: { kind: "recorded", reference: "x" } }],
    };
    expect(validateDraft(bad).problems[0].problem).toBe("empty");
  });
});

describe("§12 — the caregiver confirms", () => {
  it("refuses a chart attributed to nobody", () => {
    expect(() => confirmChart({ draft: draft(), personId: null, at: "t", edited: false })).toThrow(
      /needs the caregiver confirming it/,
    );
  });

  it("refuses to finalise a draft that has not passed validation", () => {
    const bad = {
      ...draft(),
      validated: false,
      lines: [
        {
          heading: "Observation",
          body: "Invented.",
          source: { kind: "drafted" as const, reference: "nothing she said" },
        },
      ],
    };
    expect(() => confirmChart({ draft: bad, personId: "p1", at: "t", edited: false })).toThrow(
      /must not be confirmed/,
    );
  });

  it("records who confirmed and when", () => {
    const chart = confirmChart({
      draft: draft(),
      personId: "p-jamisha",
      at: "2026-08-20T13:05:00Z",
      edited: false,
    });
    expect(chart.confirmedByPersonId).toBe("p-jamisha");
    expect(chart.confirmedAt).toBe("2026-08-20T13:05:00Z");
  });

  it("notes when the caregiver changed what was drafted", () => {
    const chart = confirmChart({ draft: draft(), personId: "p1", at: "t", edited: true });
    expect(chart.edited).toBe(true);
  });
});

describe("editing", () => {
  it("makes an edited line the caregiver's own", () => {
    const d = withNarrative(draft(), `${NARRATIVE} She asked about her daughter.`);
    const edited = editLine(d, "Observation", "She asked about her daughter.");
    const line = edited.lines.find((l) => l.heading === "Observation");
    expect(line?.source.kind).toBe("quoted");
    expect(edited.validated).toBe(true);
  });

  it("does not let an edit smuggle in something she never wrote", () => {
    // The original line had to cite the narrative. So must the replacement.
    const edited = editLine(draft(), "Observation", "Client has a new pressure sore.");
    expect(edited.validated).toBe(false);
  });
});

describe("VerbatimChartDraftingService", () => {
  it("produces a complete, confirmable chart with no model connected", async () => {
    // Joy's charting works today. A model would make the observation tidier;
    // it would not make the chart possible.
    const d = await new VerbatimChartDraftingService().draft({
      record: record(),
      tasks: TASKS,
      visitId: "v1",
    });
    expect(d?.validated).toBe(true);
    expect(() => confirmChart({ draft: d!, personId: "p1", at: "t", edited: false })).not.toThrow();
  });

  it("marks nothing as drafted, because nothing was", async () => {
    const d = await new VerbatimChartDraftingService().draft({
      record: record(),
      tasks: TASKS,
      visitId: "v1",
    });
    expect(chartLines(d!).every((l) => !l.drafted)).toBe(true);
  });

  it("adds no observation when the caregiver wrote nothing", async () => {
    const d = await new VerbatimChartDraftingService().draft({
      record: record({ note: "" }),
      tasks: TASKS,
      visitId: "v1",
    });
    expect(d!.lines.some((l) => l.heading === "Observation")).toBe(false);
  });
});
