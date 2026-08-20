import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The integration guide must name every port.
 *
 * A handover document that silently goes stale is worse than none: the
 * developer trusts it, wires the seven ports it lists, and discovers the eighth
 * when something fails in front of a caregiver.
 *
 * So this reads `docs/INTEGRATIONS.md` and the port files and asserts they
 * agree. Adding a port without documenting it fails here, which is the only
 * mechanism that reliably keeps prose in step with code.
 */

const DOC = readFileSync("docs/INTEGRATIONS.md", "utf8");

/** Interfaces that are ports — a service to be implemented, not a payload. */
function portsIn(path: string): string[] {
  const source = readFileSync(path, "utf8");
  return [...source.matchAll(/^export interface (\w+) \{/gm)]
    .map((m) => m[1])
    // Request and result shapes are data, not seams. The naming convention is
    // the filter, which is why the convention is worth keeping.
    .filter((name) => /Service|Sender|Router|Directory|Store$/.test(name));
}

/** The ports a developer must deal with before anything works. */
const HEADLINE = [
  "OtpService",
  "SmsSender",
  "DocumentStorageService",
  "AuditPacketService",
  "HrOnboardingService",
  "ChartDraftingService",
];

describe("docs/INTEGRATIONS.md", () => {
  const ports = [
    ...portsIn("src/domain/portal/ports.ts"),
    ...portsIn("src/domain/documents/ports.ts"),
  ];

  it("finds the ports it is meant to be checking", () => {
    // Guards against the filter above quietly matching nothing, which would
    // make every assertion below vacuously true.
    expect(ports.length).toBeGreaterThan(10);
    expect(ports).toContain("OtpService");
    expect(ports).toContain("DocumentStorageService");
  });

  it("names every port", () => {
    const missing = ports.filter((name) => !DOC.includes(name));
    expect(missing, `undocumented ports: ${missing.join(", ")}`).toEqual([]);
  });

  it("gives every headline port its own section", () => {
    for (const port of HEADLINE) {
      expect(DOC, `no heading for ${port}`).toMatch(new RegExp(`### \`${port}\``));
    }
  });

  it("says what each headline port does without an implementation", () => {
    // The question a developer actually has is not "what is this" but "what
    // breaks until I wire it".
    //
    // Anchored on the section heading rather than the first mention of the
    // name — several ports are referred to in the preamble, and slicing from
    // there measured the wrong prose.
    for (const port of HEADLINE) {
      const start = DOC.indexOf(`### \`${port}\``);
      const rest = DOC.slice(start + 1);
      const end = rest.indexOf("\n### ");
      const section = end === -1 ? rest : rest.slice(0, end);

      expect(section, `${port} does not say what happens until it is wired`).toMatch(
        /Until connected|Must run server side/,
      );
    }
  });

  it("still carries the go-live blockers", () => {
    // These are the things that stop a launch rather than slow one down, and
    // they live in a chat log otherwise.
    for (const blocker of [
      "business associate agreement",
      "A2P 10DLC",
      "never applied to the Supabase project",
      "workweek",
    ]) {
      expect(DOC).toContain(blocker);
    }
  });
});
