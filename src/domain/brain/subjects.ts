/**
 * Who a line on The Brain is about, and where it opens.
 *
 * A row that names a person should open that person. The subject carries the
 * kind and the id; the label and the link are derived here so every screen
 * spells them the same way.
 */
export type SubjectKind = "employee" | "client" | "contact" | "admission";

export interface Subject {
  kind: SubjectKind;
  id: string;
  name?: string;
}

export function subjectLabel(subject: Subject): string {
  switch (subject.kind) {
    case "employee":
      return "Employee";
    case "client":
      return "Client";
    case "contact":
      return "Contact";
    case "admission":
      return "Admission";
  }
}

export function subjectHref(subject: Subject): string {
  switch (subject.kind) {
    case "employee":
      return `/employees?id=${subject.id}`;
    case "client":
      return `/clients?id=${subject.id}`;
    case "contact":
      return `/people?id=${subject.id}`;
    case "admission":
      return `/admissions?id=${subject.id}`;
  }
}

/** Who is carrying a piece of Joy's work: Joy itself, or a named person. */
export type Assignee = { kind: "joy" } | { kind: "employee"; id: string; name: string };

export const JOY: Assignee = { kind: "joy" };

export function employeeAssignee(id: string, name: string): Assignee {
  return { kind: "employee", id, name };
}

export function assigneeName(a: Assignee): string {
  return a.kind === "joy" ? "Joy AI" : a.name;
}
