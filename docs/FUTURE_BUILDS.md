# Future builds

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
