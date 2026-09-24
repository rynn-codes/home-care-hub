/**
 * The plan-of-care service mix — what share of a client's hours is each
 * service — and how a visit's hours are split across it.
 *
 * Joy's default is 70% personal care, 20% companionship, 10% light
 * housekeeping. A client's own mix, once confirmed, is what the invoice and
 * the EVV record carry per service line.
 */

export const SERVICES = [
  "Personal Care",
  "Companionship",
  "Light Housekeeping",
  "Respite",
  "Meal Preparation",
  "Medication Reminders",
  "Transportation",
] as const;

export type ServiceName = (typeof SERVICES)[number];

export interface ServiceShare {
  service: string;
  percent: number;
}

export interface ServiceLine {
  service: string;
  hours: number;
}

export const DEFAULT_MIX: ServiceShare[] = [
  { service: "Personal Care", percent: 70 },
  { service: "Companionship", percent: 20 },
  { service: "Light Housekeeping", percent: 10 },
];

export function validateServiceLines(lines: readonly ServiceLine[], shiftHours: number): string | null {
  if (lines.length === 0) return "Add at least one service.";
  if (lines.some((l) => !l.service)) return "Every line needs a service.";
  if (lines.some((l) => !(l.hours > 0))) return "Every service needs hours against it.";
  const names = lines.map((l) => l.service);
  if (new Set(names).size !== names.length) return "The same service is on two lines.";
  const total = Math.round(lines.reduce((sum, l) => sum + l.hours, 0) * 100) / 100;
  const shift = Math.round(shiftHours * 100) / 100;
  return Math.abs(total - shift) > 0.01 ? `The services add up to ${total} hrs and the shift is ${shift} hrs.` : null;
}

export function validateMix(mix: readonly ServiceShare[]): string | null {
  if (mix.length === 0) return "A care plan needs at least one service.";
  if (mix.some((m) => !m.service)) return "Every line needs a service.";
  const names = mix.map((m) => m.service);
  if (new Set(names).size !== names.length) return "The same service is on two lines.";
  if (mix.some((m) => !Number.isFinite(m.percent) || m.percent < 0)) return "A percentage cannot be below zero.";
  if (mix.some((m) => m.percent === 0)) return "Take out any service at 0%, or give it a share.";
  const total = mix.reduce((sum, m) => sum + m.percent, 0);
  return total !== 100 ? `The percentages add up to ${total}%, not 100%.` : null;
}

export function hoursLabel(hours: number): string {
  return `${hours} ${hours === 1 ? "hr" : "hrs"}`;
}

export function describeMix(mix: readonly ServiceShare[]): string {
  return mix.map((m) => `${m.percent}% ${m.service}`).join(" · ");
}

/** Split a shift's hours across the mix, to the quarter hour, the last line absorbing the rounding. */
export function splitHours(mix: readonly ServiceShare[], shiftHours: number): ServiceLine[] {
  if (mix.length === 0 || !(shiftHours > 0)) return [];
  const quarter = (n: number) => Math.round(n * 4) / 4;
  const out: ServiceLine[] = [];
  let used = 0;
  mix.forEach((m, i) => {
    const hours = i === mix.length - 1 ? Math.round((shiftHours - used) * 100) / 100 : quarter((shiftHours * m.percent) / 100);
    used = Math.round((used + hours) * 100) / 100;
    out.push({ service: m.service, hours });
  });
  return out;
}

export function matchesMix(lines: readonly ServiceLine[], mix: readonly ServiceShare[], shiftHours: number): boolean {
  const expected = splitHours(mix, shiftHours);
  if (expected.length !== lines.length) return false;
  return expected.every((e, i) => lines[i].service === e.service && Math.abs(lines[i].hours - e.hours) < 0.01);
}

/** Set one line's percent and rebalance the others in proportion so the total stays 100. */
export function rebalance(mix: readonly ServiceShare[], index: number, percent: number): ServiceShare[] {
  const target = Math.max(0, Math.min(100, Math.round(percent)));
  const others = mix.filter((_, i) => i !== index);
  if (others.length === 0) return [{ ...mix[index], percent: 100 }];
  const remaining = 100 - target;
  const othersTotal = others.reduce((sum, m) => sum + m.percent, 0);
  const scaled = (othersTotal > 0 ? others.map((m) => (m.percent / othersTotal) * remaining) : others.map(() => remaining / others.length)).map((n) => Math.round(n));
  const drift = remaining - scaled.reduce((sum, n) => sum + n, 0);
  if (drift !== 0 && scaled.length > 0) {
    let biggest = 0;
    scaled.forEach((n, i) => {
      if (n > scaled[biggest]) biggest = i;
    });
    scaled[biggest] += drift;
  }
  const out: ServiceShare[] = [];
  let j = 0;
  mix.forEach((m, i) => {
    if (i === index) out.push({ ...m, percent: target });
    else {
      out.push({ ...m, percent: scaled[j] });
      j += 1;
    }
  });
  return out;
}
