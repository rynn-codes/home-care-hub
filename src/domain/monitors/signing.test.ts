import { describe, expect, it } from "vitest";
import { signingWatch } from "./signing";
import type { MonitorInputs } from "./types";
import { addField, newTemplate } from "@/domain/signing/templates";
import { createEnvelope, sendEnvelope, signEnvelope, type Envelope } from "@/domain/signing/envelopes";

const AT = "2026-09-20T15:00:00.000Z";

function envelope(withAgency: boolean): Envelope {
  let t = newTemplate({ id: "t", name: "Agreement", documentId: "d", documentName: "Client Agreement.pdf", pages: 1, by: "K", at: AT });
  t = addField(t, { id: "sig", kind: "signature", page: 1, x: 0.1, y: 0.8 });
  if (withAgency) t = addField(t, { id: "agency", kind: "agency_signature", page: 1, x: 0.1, y: 0.9 });
  return createEnvelope({ id: "e1", template: t, clientPersonId: "c-pamela", clientName: "Pamela P", signerRole: "responsible_party", signerName: "Gregory P", prefill: { name: "Pamela P" }, by: "K", at: AT });
}

const run = (envelopes: Envelope[], today = "2026-09-25") => signingWatch.run({ envelopes, today } as unknown as MonitorInputs);

describe("Signing Watch", () => {
  it("says nothing about drafts or completed requests", () => {
    const draft = envelope(false);
    const done = signEnvelope(sendEnvelope(draft, "K", AT), { typedName: "Gregory P", markDrawn: true, values: {} }, AT);
    expect(run([draft, done])).toEqual([]);
  });

  it("asks the office to countersign once the client has signed", () => {
    const signed = signEnvelope(sendEnvelope(envelope(true), "K", AT), { typedName: "Gregory P", markDrawn: true, values: {} }, AT);
    const [f] = run([signed]);
    expect(f.severity).toBe("due_soon");
    expect(f.headline).toContain("Gregory P signed Client Agreement");
    expect(f.next.to).toBe("/documents/signing/e1");
  });

  it("notes a request nobody has signed after three days, not before", () => {
    const sent = sendEnvelope(envelope(false), "K", AT);
    expect(run([sent], "2026-09-22")).toEqual([]);
    const [f] = run([sent], "2026-09-25");
    expect(f.severity).toBe("note");
    expect(f.headline).toContain("sent 5 days ago");
  });
});
