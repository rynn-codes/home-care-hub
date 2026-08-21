import type { ReportResult } from "@/domain/reports/reports";

/**
 * CSV for the Export button.
 *
 * THE ESCAPING IS THE POINT, not a nicety. Report rows carry client names,
 * caregiver names and sentences of advice — "Ask for more now, 12 days before
 * the period ends" contains a comma, and a name like "Vandermeer, Augustin"
 * contains one too. An unescaped export silently shifts every column after it,
 * and the person who opens it in Excel gets a file that looks fine and is wrong.
 * That is worse than an export that fails.
 *
 * A field is quoted when it contains a comma, a quote or a newline, and quotes
 * inside are doubled. RFC 4180.
 *
 * The leading-character guard is the other half. A cell beginning `=`, `+`, `-`
 * or `@` is executed as a formula by Excel and Sheets when the file is opened —
 * the CSV injection problem. Joy's cells come from names and free text somebody
 * typed, so this is a real path, and a leading apostrophe is the standard fix.
 */

const RISKY_FIRST = ["=", "+", "-", "@", "\t", "\r"];

export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let text = String(value);

  if (RISKY_FIRST.includes(text[0] ?? "")) {
    text = `'${text}`;
  }

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function reportToCsv(report: ReportResult): string {
  if (report.state !== "computed") {
    // An export of a report Joy cannot compute carries the reason rather than an
    // empty file. A zero-byte download reads as a bug and gets reported as one.
    return [
      csvCell(report.title),
      "",
      csvCell("This report cannot be produced yet."),
      ...(report.missing ?? []).map(csvCell),
    ].join("\n");
  }

  const header = report.columns.map((c) => csvCell(c.label)).join(",");
  const rows = report.rows.map((row) =>
    report.columns.map((c) => csvCell(row[c.key])).join(","),
  );

  const lines = [header, ...rows];
  if (report.note) lines.push("", csvCell(report.note));
  return lines.join("\n");
}

/** `joy-hours-by-service-2026-08-21.csv` — sorts by name in a downloads folder. */
export function csvFilename(report: ReportResult, today: string): string {
  return `joy-${report.key.replace(/_/g, "-")}-${today.slice(0, 10)}.csv`;
}
