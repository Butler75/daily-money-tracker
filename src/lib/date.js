import { DateTime } from "luxon";

export const DUBAI_TIMEZONE = "Asia/Dubai";

export function getDubaiNow() {
  return DateTime.now().setZone(DUBAI_TIMEZONE);
}

export function toDubaiDateTime(dateValue) {
  if (!dateValue) return null;
  const parsed = DateTime.fromISO(String(dateValue), { zone: "utc" });
  if (!parsed.isValid) return null;
  return parsed.setZone(DUBAI_TIMEZONE);
}

export function toDubaiDateInputValue(dateTime = getDubaiNow()) {
  return dateTime.toFormat("yyyy-LL-dd");
}

export function toDubaiDateTimeInputValue(dateTime = getDubaiNow()) {
  return dateTime.toFormat("yyyy-LL-dd'T'HH:mm");
}

export function dubaiDateTimeInputToUtcIso(dateTimeInput) {
  const parsed = DateTime.fromFormat(dateTimeInput, "yyyy-LL-dd'T'HH:mm", {
    zone: DUBAI_TIMEZONE,
  });
  return parsed.isValid ? parsed.toUTC().toISO() : DateTime.utc().toISO();
}

export function getPeriodBounds(period) {
  const now = getDubaiNow();
  const start = now.startOf("day");

  if (period === "today") {
    return { start, end: now };
  }

  if (period === "week") {
    return { start: now.minus({ days: 6 }).startOf("day"), end: now };
  }

  if (period === "month") {
    return { start: now.startOf("month"), end: now };
  }

  return { start: null, end: null };
}

export function getDubaiCustomRangeBounds(startDate, endDate) {
  const start = DateTime.fromISO(`${startDate}T00:00:00`, { zone: DUBAI_TIMEZONE });
  const end = DateTime.fromISO(`${endDate}T23:59:59`, { zone: DUBAI_TIMEZONE });
  return { start, end };
}

export function isDateInPeriod(dateValue, period) {
  if (period === "all") return true;

  const { start, end } = getPeriodBounds(period);
  const target = toDubaiDateTime(dateValue);
  if (!target || !start || !end) return false;
  return target >= start && target <= end;
}
