# Future builds

## Standing rule (Karynn, 15 October 2026)

Every piece of data in this project is mock until a developer has
reviewed it for HIPAA. No real client, family or employee information
goes in, and nothing connected — database, texts, payments — touches a
real person. So: build and connect freely against mock data, and do not
pad replies with HIPAA reminders. The code's own guard rails (no SSN or
drawn signature in browser storage, MR numbers never derived from digits)
stay as they are; they are design, not reminders.

Things Karynn has asked for and said "commit that to memory". Each entry
says what, why, and what it depends on. Nothing here is started until she
says so; the list exists so a question asked in October is not lost by
December. Newest at the bottom.

## Caregiver location and directions (asked 15 October 2026)

What Karynn means by "EVV": the caregiver's clock-in and clock-out carry
the phone's coordinates, and tapping the client's address opens a map
with directions.

**Already built.** The visit screen in the caregiver portal asks the
phone for its location on clock in and clock out, records distance from
the client's home and the reading's accuracy, and flags a clock outside
the geofence set in Settings → Agency. The office sees it on the visit
and The Brain raises an out-of-range clock. No API is involved; the
browser's own geolocation does it.

**Step 1 — directions link. No keys needed.** On the visit screen and the
client card, the address becomes a link that opens the phone's maps app
(Google Maps or Apple Maps) with the address filled in. The mock clients
already carry mock addresses, so it can be tried in the demo. Build when
Karynn says so.

**Step 2 — geocoding. Needs Supabase.** No client record has coordinates
today, so the distance check always answers "no client location" and the
clock is recorded without a verdict. When an address is entered or
changed, a server-side call to Google Maps or Mapbox geocoding turns it
into coordinates stored on the record, with the key in Supabase Edge
Function secrets. Cheap: both free tiers cover an agency this size. This
turns the distance check on for real.

**Not needed.** No EVV vendor or state aggregator. Texas requires EVV
through an aggregator for Medicaid-funded care only; Joy is private pay.
Revisit only if Joy takes a Medicaid or managed-care contract (that would
be an HHAeXchange integration).

## Payment chime (asked 15 October 2026)

A cash-register chime when an invoice is paid. Not Shopify's own
recording (theirs); a synthesised chime in the browser, or a sound
Karynn supplies. Plays when a payment is recorded in Billing today, and
when a Stripe payment lands once connected. A per-device preference in
Settings → Appearance with a "Try it" button. Browsers stay silent until
the person has clicked once on the page.

## Mobile app for caregivers and families (asked 15 October 2026)

The two portals are already phone-first with text-code sign-in: clock in
and out with location, schedule, notes, mileage, documents, signing,
billing. Depends on Supabase so phones and the office share one record.

**Step 1 — installable web app.** Manifest, icons, service worker: home
screen install, full-screen, survives a dropped connection, push
notifications on iPhone and Android. A few days.

**Step 2 — store app from the same code.** Capacitor wrap for App Store
and Google Play: same screens, better push and background location. A few
weeks with store review; Apple developer account $99/yr, Google $25 once.

**Not planned.** A separate native app. Doubles the code for no gain at
this size.

## Shift reminders by text (asked 15 October 2026)

Already designed: each visit carries a ladder (before start, at start,
before end, escalation to the office after the Settings delay), with the
exact text and time shown on the visit sheet. Settings → Agency →
Notifications holds the switches and lead times. Nothing is sent because
Spruce is not wired. Needs: the Spruce API connection, and a scheduled
job on Supabase that reads the day's visits every few minutes, sends the
due reminders, and records each send on the visit.

## Hourly clock for office staff (asked 15 October 2026)

Today the clock belongs to visits only; office staff have no way to clock
a workday and Payroll never sees their hours. Build: a "Workday" clock in
the workforce portal for office staff (in, out, breaks; no client, no
geofence); an "Office hours" section in Payroll and the Payroll cost
report with the same per-workweek overtime rule; corrections through the
existing clock-correction path; salaried staff left out. A day or two
once the backend is in.
