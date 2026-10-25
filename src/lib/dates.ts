import { APP_TIME_ZONE, EVENT_DATE_MAX_DAYS_AGO } from "@/lib/constants";

// Dates are "YYYY-MM-DD" strings, as Postgres `date` columns and
// <input type="date"> use them. "Today" is Pakistan time (DEVELOPMENT.md
// D-12), whatever the server's or browser's own time zone.

export function todayInKarachi(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

// The same range as the validate_item_report trigger: not after today, not
// more than EVENT_DATE_MAX_DAYS_AGO days ago.
export function eventDateRange(today: string = todayInKarachi()) {
  return { min: addDays(today, -EVENT_DATE_MAX_DAYS_AGO), max: today };
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDate(value: string): boolean {
  return DATE_PATTERN.test(value) && addDays(value, 0) === value;
}

// For display, for example "25 Oct 2026". A date has no time zone, so it is
// formatted as UTC to keep the same day.
export function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00Z`));
}
