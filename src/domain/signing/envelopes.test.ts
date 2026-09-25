import { describe, expect, it } from "vitest";
import { addField, newTemplate, templateNeedsCountersign, updateField, whyNotSaveTemplate } from "./templates";
import {
  correctEnvelope, countersignEnvelope, createEnvelope, declineEnvelope, defaultDelivery, deliveryEmail, deliveryLine, deliveryMessage, editEnvelope, envelopesForFamily, formDate, markViewed,
  prefillValues, recordCopySent, sendEnvelope, signEnvelope, voidEnvelope, whyNotCountersign, whyNotEdit, whyNotSend, whyNotSign, whyNotVoid,
} from "./envelopes";

const AT = "2026-09-25T15:00:00.000Z";

function template() {
  let t = newTemplate({ id: "tpl-1", name: "Client Agreement for Care", documentId: "doc-1", documentName: "Client Agreement.pdf", pages: 1, by: "Karynn Verrett", at: AT });
  t = addField(t, { id: "f-name", kind: "client_name", page: 1, x: 0.2, y: 0.1 });
  t = addField(t, { id: "f-dob", kind: "dob", page: 1, x: 0.6, y: 0.1 });
  t = addField(t, { id: "f-mr", kind: "mr_number", page: 1, x: 0.6, y: 0.15 });
  t = addField(t, { id: "f-sig", kind: "signature", page: 1, x: 0.1, y: 0.8 });
  t = addField(t, { id: "f-date", kind: "date_signed", page: 1, x: 0.6, y: 0.8 });
  t = addField(t, { id: "f-agency", kind: "agency_signature", page: 1, x: 0.1, y: 0.9 });
  t = addField(t, { id: "f-check", kind: "checkbox", page: 1, x: 0.1, y: 0.5 });
  t = updateField(t, "f-check", { fill: "signer" });
  return t;
}

const pamela = { name: "Pamela P", dateOfBirth: "1943-09-28", address: "9901 Sample St, Houston, TX", phone: "(713) 555-0120", mrNumber: "PP1234", admissionDate: "2026-07-03" };

function envelope() {
  return createEnvelope({ id: "env-1", template: template(), clientPersonId: "c-pamela", clientName: "Pamela P", signerRole: "responsible_party", signerName: "Gregory P", prefill: pamela, by: "Karynn Verrett", at: AT });
}

describe("templates", () => {
  it("needs a name and a signature box for the signer", () => {
    const t = newTemplate({ id: "t", name: "", documentId: "d", documentName: "d.pdf", pages: 1, by: "K", at: AT });
    expect(whyNotSaveTemplate(t)).toMatch(/name/);
    expect(whyNotSaveTemplate({ ...t, name: "Agreement" })).toMatch(/signature box/);
    expect(whyNotSaveTemplate(template())).toBeNull();
  });

  it("keeps a box on the page", () => {
    const t = addField(template(), { id: "f-off", kind: "address", page: 1, x: 0.9, y: 1.2 });
    const f = t.fields.find((x) => x.id === "f-off")!;
    expect(f.x + f.w).toBeLessThanOrEqual(1);
    expect(f.y + f.h).toBeLessThanOrEqual(1);
  });

  it("knows when the agency signs too", () => {
    expect(templateNeedsCountersign(template())).toBe(true);
    expect(templateNeedsCountersign(newTemplate({ id: "t", name: "x", documentId: "d", documentName: "d", pages: 1, by: "K", at: AT }))).toBe(false);
  });
});

describe("prefill", () => {
  it("fills Joy's boxes from the record and leaves the rest blank", () => {
    const values = prefillValues(template().fields, pamela, "2026-09-25");
    expect(values["f-name"]).toBe("Pamela P");
    expect(values["f-dob"]).toBe("09/28/1943");
    expect(values["f-mr"]).toBe("PP1234");
    expect(values["f-sig"]).toBeUndefined();
    expect(values["f-check"]).toBe(false);
  });

  it("never guesses a blank", () => {
    const values = prefillValues(template().fields, { name: "Charles S" }, "2026-09-25");
    expect(values["f-dob"]).toBe("");
    expect(values["f-mr"]).toBe("");
  });

  it("writes dates the way a form expects", () => {
    expect(formDate("1943-09-28")).toBe("09/28/1943");
    expect(formDate(null)).toBe("");
  });
});

describe("the life of a request", () => {
  it("starts as a draft that can be edited and sent", () => {
    const e = envelope();
    expect(e.status).toBe("draft");
    expect(whyNotEdit(e)).toBeNull();
    const edited = editEnvelope(e, { message: "Please sign before Monday.", textTo: "(713) 555-0120", emailTo: "greg@example.com" }, "Karynn Verrett", AT);
    expect(whyNotSend(edited)).toBeNull();
    const sent = sendEnvelope(edited, "Karynn Verrett", AT);
    expect(sent.status).toBe("sent");
    expect(sent.history.map((h) => h.kind)).toEqual(["created", "edited", "sent"]);
  });

  it("will not send by text without a number, or by email to nonsense", () => {
    expect(whyNotSend(editEnvelope(envelope(), { textTo: "" }, "K", AT))).toMatch(/mobile number/);
    expect(whyNotSend(editEnvelope(envelope(), { emailTo: "not-an-email" }, "K", AT))).toMatch(/email/);
  });

  it("prefers text and adds email when both are on file", () => {
    expect(defaultDelivery({ phone: "(713) 555-0120", email: "greg@example.com" })).toEqual({ textTo: "(713) 555-0120", emailTo: "greg@example.com" });
    expect(defaultDelivery({ phone: null, email: "greg@example.com" })).toEqual({ textTo: null, emailTo: "greg@example.com" });
    expect(deliveryLine({ textTo: "(713) 555-0120", emailTo: "greg@example.com" })).toBe("By text to (713) 555-0120 and email to greg@example.com");
    expect(deliveryLine({ textTo: null, emailTo: null })).toBe("In the family portal only");
  });

  it("writes the email as well as the text", () => {
    const mail = deliveryEmail(envelope(), "Joy Health", "(713) 231-9662");
    expect(mail.subject).toContain("Client Agreement for Pamela P");
    expect(mail.body).toContain("Hi Gregory");
    expect(mail.body).toContain("(713) 231-9662");
  });

  it("can be sent to the portal only", () => {
    expect(whyNotSend(envelope())).toBeNull();
  });

  it("says what it would text, without sending it", () => {
    const msg = deliveryMessage(envelope(), "Joy Health");
    expect(msg).toContain("Hi Gregory");
    expect(msg).toContain("Client Agreement for Pamela P");
  });

  it("records being opened once", () => {
    const sent = sendEnvelope(envelope(), "K", AT);
    const viewed = markViewed(sent, "2026-09-25T16:00:00.000Z");
    expect(viewed.status).toBe("viewed");
    expect(markViewed(viewed, "2026-09-25T17:00:00.000Z").history.filter((h) => h.kind === "viewed")).toHaveLength(1);
  });

  it("needs a typed name and a drawn mark to sign", () => {
    const sent = sendEnvelope(envelope(), "K", AT);
    expect(whyNotSign(sent, { typedName: "", markDrawn: true, values: {} })).toMatch(/name/);
    expect(whyNotSign(sent, { typedName: "Gregory P", markDrawn: false, values: {} })).toMatch(/Sign/);
    expect(whyNotSign(sent, { typedName: "Gregory P", markDrawn: true, values: {} })).toBeNull();
  });

  it("puts the typed name in every signature box, dates it, and waits on the agency", () => {
    const sent = sendEnvelope(envelope(), "K", AT);
    const signed = signEnvelope(sent, { typedName: "Gregory P", markDrawn: true, values: { "f-check": true } }, "2026-09-26T10:00:00.000Z");
    expect(signed.status).toBe("signed");
    expect(signed.values["f-sig"]).toBe("Gregory P");
    expect(signed.values["f-date"]).toBe("09/26/2026");
    expect(signed.values["f-check"]).toBe(true);
    expect(signed.markDrawn).toBe(true);
    expect(JSON.stringify(signed)).not.toContain("data:image");
  });

  it("completes on its own when nobody countersigns", () => {
    const t = template();
    const noAgency = { ...t, fields: t.fields.filter((f) => f.kind !== "agency_signature") };
    const e = createEnvelope({ id: "e", template: noAgency, clientPersonId: "c", clientName: "Pamela P", signerRole: "client", signerName: "Pamela P", prefill: pamela, by: "K", at: AT });
    const signed = signEnvelope(sendEnvelope(e, "K", AT), { typedName: "Pamela P", markDrawn: true, values: {} }, AT);
    expect(signed.status).toBe("completed");
    expect(signed.needsCountersign).toBe(false);
  });

  it("locks once signed; the office voids or corrects instead", () => {
    const signed = signEnvelope(sendEnvelope(envelope(), "K", AT), { typedName: "Gregory P", markDrawn: true, values: {} }, AT);
    expect(whyNotEdit(signed)).toMatch(/cannot be edited/);
    expect(() => editEnvelope(signed, { message: "x" }, "K", AT)).toThrow();
  });

  it("countersigns after the client and then completes", () => {
    const signed = signEnvelope(sendEnvelope(envelope(), "K", AT), { typedName: "Gregory P", markDrawn: true, values: {} }, AT);
    expect(whyNotCountersign(signed, { typedName: "Karynn Verrett", markDrawn: true })).toBeNull();
    const done = countersignEnvelope(signed, { typedName: "Karynn Verrett", markDrawn: true }, "Karynn Verrett", "2026-09-27T09:00:00.000Z");
    expect(done.status).toBe("completed");
    expect(done.values["f-agency"]).toBe("Karynn Verrett");
    expect(done.countersignedBy).toBe("Karynn Verrett");
  });

  it("cannot countersign before the client signs", () => {
    expect(whyNotCountersign(sendEnvelope(envelope(), "K", AT), { typedName: "Karynn Verrett", markDrawn: true })).toMatch(/not signed yet/);
  });

  it("records a decline with its reason", () => {
    const declined = declineEnvelope(sendEnvelope(envelope(), "K", AT), "Wrong start date", AT);
    expect(declined.status).toBe("declined");
    expect(declined.declinedReason).toBe("Wrong start date");
  });

  it("voids with a reason, never silently", () => {
    const e = sendEnvelope(envelope(), "K", AT);
    expect(whyNotVoid(e, "")).toMatch(/why/);
    const voided = voidEnvelope(e, "Sent to the wrong person", "Karynn Verrett", AT);
    expect(voided.status).toBe("voided");
    expect(voided.voidReason).toBe("Sent to the wrong person");
    expect(whyNotVoid(voided, "again")).toMatch(/Already/);
  });

  it("corrects by voiding and opening a fresh draft that remembers where it came from", () => {
    const signed = signEnvelope(sendEnvelope(envelope(), "K", AT), { typedName: "Gregory P", markDrawn: true, values: { "f-check": true } }, AT);
    const { voided, draft } = correctEnvelope(signed, { newId: "env-2", reason: "DOB was wrong", by: "Karynn Verrett", at: AT });
    expect(voided.status).toBe("voided");
    expect(voided.correctedToId).toBe("env-2");
    expect(draft.status).toBe("draft");
    expect(draft.correctedFromId).toBe("env-1");
    expect(draft.values["f-name"]).toBe("Pamela P");
    expect(draft.values["f-check"]).toBe(true);
    expect(draft.values["f-sig"]).toBeUndefined();
    expect(draft.signedName).toBeNull();
  });

  it("sends a copy only once complete, and records where", () => {
    const signed = signEnvelope(sendEnvelope(envelope(), "K", AT), { typedName: "Gregory P", markDrawn: true, values: {} }, AT);
    expect(() => recordCopySent(signed, "greg@example.com", "K", AT)).toThrow(/complete/);
    const done = countersignEnvelope(signed, { typedName: "Karynn Verrett", markDrawn: true }, "Karynn Verrett", AT);
    expect(recordCopySent(done, "greg@example.com", "K", AT).copySentTo).toBe("greg@example.com");
  });

  it("reaches the family by id or by the client's first name, and hides drafts", () => {
    const draft = envelope();
    const sent = sendEnvelope({ ...draft, id: "env-3" }, "K", AT);
    const grant = { subjectPersonId: "p-other", subjectName: "Pamela" };
    expect(envelopesForFamily([draft, sent], grant).map((e) => e.id)).toEqual(["env-3"]);
    expect(envelopesForFamily([sent], { subjectPersonId: "c-pamela", subjectName: null })).toHaveLength(1);
    expect(envelopesForFamily([sent], { subjectPersonId: "x", subjectName: "Charles" })).toHaveLength(0);
  });
});
