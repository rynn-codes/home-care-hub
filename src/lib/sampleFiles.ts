import { TEST_SIGNATURE_DOCUMENT } from "@/lib/documentsSeed";

/**
 * Readable text for seeded documents that have no file behind them.
 *
 * The seed library is records only. The one exception is the test document
 * for trying signatures: a signer should be able to read what they are
 * putting their name to, so it carries sample wording. The wording is marked
 * as a test throughout — it is not Joy Health's agreement and must not be
 * mistaken for one. Nothing here is a file; Download still says there is no
 * copy.
 */
export interface SampleText {
  title: string;
  /** One paragraph per entry. */
  paragraphs: string[];
}

const SAMPLES: Record<string, SampleText> = {
  [TEST_SIGNATURE_DOCUMENT.id]: {
    title: "TEST - Mock Service Agreement",
    paragraphs: [
      "THIS IS A TEST DOCUMENT. It exists so the office can try asking for a signature and see what the family sees. It is not an agreement and creates no obligation for anyone.",
      "1. Parties. This sample names a home care agency (\"the agency\") and a client or the person who signs for them (\"the client\").",
      "2. Services. The agency would provide non-medical personal care on the days and hours agreed in the plan of care, delivered by trained caregivers.",
      "3. Rates and billing. Sample rates would be stated here, with billing weekly in arrears and payment due on receipt of the invoice.",
      "4. Changes and cancellation. Either side could change or end the arrangement with reasonable notice, as the plan of care and agency policy describe.",
      "5. Signing. Signing below would confirm the client has read this document and agrees to it. In this test nothing is stamped onto a file and nobody is notified — Joy records only the typed name and the time.",
    ],
  },
};

export function sampleText(documentId: string): SampleText | null {
  return SAMPLES[documentId] ?? null;
}
