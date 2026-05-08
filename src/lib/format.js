import { DateTime } from "luxon";
import { DUBAI_TIMEZONE } from "./date";

export function formatCurrency(value) {
  return new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function formatDateTime(value) {
  if (!value) return "-";
  const dateTime = DateTime.fromISO(String(value), { zone: "utc" }).setZone(DUBAI_TIMEZONE);
  if (!dateTime.isValid) return "-";
  return dateTime.toFormat("dd LLL yyyy, hh:mm a");
}
