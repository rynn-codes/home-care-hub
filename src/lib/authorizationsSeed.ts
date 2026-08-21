import type { Authorization } from "@/domain/authorizations/authorization";

/**
 * Payer authorisations for the demo.
 *
 * Clients are fictional, as everywhere in this repository.
 *
 * These exist because the client roster has always named payers — Medicaid
 * STAR+PLUS, LTC Insurance, VA Community Care, one record saying "authorization
 * through Dec 2026" — and nothing modelled the units behind them. The burn-rate
 * report cannot say anything at all without these.
 *
 * NOT EVERY CLIENT HAS ONE, and that is the point rather than an omission. A
 * private-pay client needs no authorisation; every other payer does. A screen
 * showing an authorisation for all six would be showing something Joy does not
 * have and does not need.
 *
 * PERIODS ARE RELATIVE TO THE DEMO WEEK, for the same reason `schedulingSeed`
 * builds its visits that way. The demo schedule is one week long. An
 * authorisation running from June to October would show every client at 2% used
 * against 50% elapsed — every row "on track", and the report demonstrating
 * nothing it was built for. The alternative, inflating the usage, would mean
 * seeding care that was never delivered so a chart looked better, which is the
 * failure this whole codebase is written against.
 *
 * So the window is the week the schedule actually covers, and the burn is real
 * arithmetic on real seed visits.
 *
 * Three states, because a report where everything is fine demonstrates nothing:
 * one tracking with its period, one being used far faster than the period
 * allows, and one with barely any units left.
 */

function mondayOfThisWeek(): string {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

function daysFromMonday(n: number): string {
  const d = new Date(`${mondayOfThisWeek()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const START = mondayOfThisWeek();

export const seedAuthorizations: Authorization[] = [
  {
    id: "auth-lian",
    clientPersonId: "c-lian",
    clientName: "Lian Huang",
    payer: "medicaid",
    authorizationNumber: "STAR-4471",
    // Lian is scheduled 8 hours in the demo week. 240 units is 60 hours over
    // four weeks — comfortably more than she uses even extrapolated, which is
    // what makes this the row that reads on track.
    unitsAuthorized: 240,
    minutesPerUnit: 15,
    startsOn: START,
    endsOn: daysFromMonday(27),
    service: "Personal attendant services",
  },
  {
    id: "auth-edward",
    clientPersonId: "c-edward",
    clientName: "Edward Pham",
    payer: "ltc_insurance",
    authorizationNumber: "LTC-88120",
    // Live-in care against an authorisation written for far less. Edward is
    // scheduled 16 hours in this week alone; 120 units is 30 hours for a
    // four-week period. This is the situation the report exists for: the care
    // is being delivered, the units are not there to cover it, and nobody finds
    // out until the denial arrives six weeks later.
    unitsAuthorized: 120,
    minutesPerUnit: 15,
    startsOn: START,
    endsOn: daysFromMonday(27),
    service: "Home care aide",
  },
  {
    id: "auth-susan",
    clientPersonId: "c-susan",
    clientName: "Susan Miller",
    payer: "va",
    authorizationNumber: "VA-CC-20268",
    // Written in whole hours rather than quarter-hours, which is why
    // `minutesPerUnit` exists at all: a payer's denomination is the payer's.
    // Susan has 3 hours scheduled against 4 authorised for the fortnight.
    unitsAuthorized: 4,
    minutesPerUnit: 60,
    startsOn: START,
    endsOn: daysFromMonday(13),
    service: "Homemaker / home health aide",
  },
];
