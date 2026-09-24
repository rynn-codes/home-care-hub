/** "2:00 PM" → minutes since midnight, or null when it is not a clock time. */
export function minutesOf(time: string): number | null {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(time.trim());
  if (!m) return null;
  const hour = Number(m[1]) % 12;
  const minute = Number(m[2]);
  if (minute > 59) return null;
  const pm = m[3].toUpperCase() === "PM";
  return (hour + (pm ? 12 : 0)) * 60 + minute;
}

/**
 * Where the Now marker sits in a list of timed rows: the index of the first
 * row still ahead of the clock. Equal to the list length once the day is done.
 */
export function nowIndex(times: readonly string[], now: Date): number {
  const current = now.getHours() * 60 + now.getMinutes();
  let index = 0;
  for (const t of times) {
    const minutes = minutesOf(t);
    if (minutes !== null && minutes > current) break;
    index += 1;
  }
  return index;
}
