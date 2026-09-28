/** All calendar logic is in UTC. */
export function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

/** Monday 00:00 UTC of the week containing d. */
export function startOfUtcWeek(d: Date): Date {
  const day = startOfUtcDay(d);
  const dow = (day.getUTCDay() + 6) % 7;
  return addDays(day, -dow);
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function isSameUtcDay(iso: string, day: Date): boolean {
  return iso.slice(0, 10) === isoDate(day);
}
