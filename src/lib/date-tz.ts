// Timezone-aware calendar-day helpers.
//
// The app renders on Fly.io, where the server's local time is UTC. Any date
// that is bucketed or gated by "calendar day" (which day a task was completed,
// what "today" is for promotion/pacing, streak dots) must be computed in the
// *player's* time zone, not the server's UTC — otherwise evening activity rolls
// into the next day. Use these helpers anywhere you'd otherwise reach for
// `new Date().toISOString().split('T')[0]` or `d.getDate()` on the server.

const DEFAULT_TIME_ZONE = 'America/Chicago'

// Resolve a valid IANA time zone, falling back to the app default when the
// stored value is missing or unrecognized (guards against a RangeError from
// toLocaleDateString crashing a render).
export function resolveTimeZone(timeZone: string | null | undefined): string {
  if (!timeZone) return DEFAULT_TIME_ZONE
  try {
    Intl.DateTimeFormat('en-CA', { timeZone })
    return timeZone
  } catch {
    return DEFAULT_TIME_ZONE
  }
}

// The YYYY-MM-DD calendar date of an instant, in the given time zone.
// en-CA formats as YYYY-MM-DD.
export function dateKeyInTimeZone(
  instant: Date | string,
  timeZone: string
): string {
  const d = typeof instant === 'string' ? new Date(instant) : instant
  return d.toLocaleDateString('en-CA', { timeZone: resolveTimeZone(timeZone) })
}

// Today's YYYY-MM-DD in the given time zone. `now` is injectable for tests.
export function todayInTimeZone(timeZone: string, now: Date = new Date()): string {
  return dateKeyInTimeZone(now, timeZone)
}

// Calendar arithmetic on a YYYY-MM-DD key, done in UTC so it never touches
// DST (a bare date has no time-of-day to shift). Returns a YYYY-MM-DD key.
export function addDaysToDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const t = Date.UTC(y, m - 1, d) + days * 86_400_000
  return new Date(t).toISOString().split('T')[0]
}

// Whole calendar days from `fromKey` to `toKey` (toKey - fromKey). UTC math,
// DST-safe for the same reason as above.
export function daysBetweenKeys(fromKey: string, toKey: string): number {
  const [fy, fm, fd] = fromKey.split('-').map(Number)
  const [ty, tm, td] = toKey.split('-').map(Number)
  return Math.round(
    (Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000
  )
}
