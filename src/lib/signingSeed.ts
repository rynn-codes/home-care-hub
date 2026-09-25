import type { SigningTemplate } from "@/domain/signing/templates";
import type { TemplateField } from "@/domain/signing/fields";
import { TEST_SIGNATURE_DOCUMENT } from "@/lib/documentsSeed";

/**
 * One template to try signing with, laid over the test agreement that
 * ships with the app. Positions match the blanks drawn on that page.
 */
const F = (id: string, kind: TemplateField["kind"], label: string, box: { x: number; y: number; w: number; h: number }, fill: TemplateField["fill"], required = false): TemplateField => ({
  id,
  kind,
  label,
  page: 1,
  ...box,
  fill,
  required,
});

export const TEST_SIGNING_TEMPLATE: SigningTemplate = {
  id: "tpl-test-agreement",
  name: "TEST - Mock Service Agreement",
  documentId: TEST_SIGNATURE_DOCUMENT.id,
  documentName: TEST_SIGNATURE_DOCUMENT.name,
  pages: 1,
  fields: [
    F("tf-name", "client_name", "Client name", { x: 0.1887, y: 0.1136, w: 0.3995, h: 0.0202 }, "joy"),
    F("tf-dob", "dob", "Date of birth", { x: 0.7263, y: 0.1136, w: 0.1757, h: 0.0202 }, "joy"),
    F("tf-address", "address", "Address", { x: 0.1593, y: 0.1465, w: 0.7426, h: 0.0202 }, "joy"),
    F("tf-phone", "phone", "Phone", { x: 0.1446, y: 0.1793, w: 0.2802, h: 0.0202 }, "joy"),
    F("tf-mr", "mr_number", "MR number", { x: 0.4967, y: 0.1793, w: 0.1569, h: 0.0202 }, "joy"),
    F("tf-soc", "soc_date", "Start of care", { x: 0.7917, y: 0.1793, w: 0.1103, h: 0.0202 }, "joy"),
    F("tf-svc-0", "checkbox", "Personal care", { x: 0.1144, y: 0.3472, w: 0.0196, h: 0.0152 }, "office"),
    F("tf-svc-1", "checkbox", "Companionship", { x: 0.3186, y: 0.3472, w: 0.0196, h: 0.0152 }, "office"),
    F("tf-svc-2", "checkbox", "Light housekeeping", { x: 0.5229, y: 0.3472, w: 0.0196, h: 0.0152 }, "office"),
    F("tf-svc-3", "checkbox", "Respite", { x: 0.7271, y: 0.3472, w: 0.0196, h: 0.0152 }, "office"),
    F("tf-sig", "signature", "Signature", { x: 0.3799, y: 0.5486, w: 0.2574, h: 0.0429 }, "signer", true),
    F("tf-date", "date_signed", "Date signed", { x: 0.7092, y: 0.5486, w: 0.1928, h: 0.0202 }, "signer"),
    F("tf-agency-sig", "agency_signature", "Agency signature", { x: 0.2108, y: 0.6042, w: 0.4265, h: 0.0429 }, "agency", true),
    F("tf-agency-date", "agency_date", "Agency date", { x: 0.7092, y: 0.6042, w: 0.1928, h: 0.0202 }, "agency"),
  ],
  createdAt: "2026-09-25T10:05:00.000Z",
  createdBy: "Karynn Verrett",
  updatedAt: "2026-09-25T10:05:00.000Z",
};

export const seedSigningTemplates: SigningTemplate[] = [TEST_SIGNING_TEMPLATE];
