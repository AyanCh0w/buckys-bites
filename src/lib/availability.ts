import type { Catalog, Food, Service } from "./types";
import { stationAllowsService } from "./kitchen-hours";
import {
  CAMPUS_TZ,
  campusDate,
  dateLabel,
  shiftDate,
  timeLabel,
} from "./domain";
export function serviceIsOpen(service: Service, now = new Date()) {
  return (
    service.status === "published" &&
    service.service_date === campusDate(now) &&
    !!service.starts_at &&
    !!service.ends_at &&
    new Date(service.starts_at).getTime() <= now.getTime() &&
    now.getTime() < new Date(service.ends_at).getTime()
  );
}
export function foodIsOpen(
  catalog: Catalog,
  food: Food,
  now = new Date(),
  serviceIds?: Set<string>,
) {
  return catalog.offerings.some(
    (o) =>
      o.is_listed &&
      o.food_version_id === food.id &&
      (!serviceIds || serviceIds.has(o.menu_service_id)) &&
      catalog.services.some(
        (s) =>
          s.id === o.menu_service_id &&
          serviceIsOpen(s, now) &&
          stationAllowsService(
            catalog,
            catalog.stations?.find((station) => station.id === o.station_id),
            s,
            now,
          ),
      ),
  );
}

/** Merge contiguous services so a lunch-to-dinner handoff isn't a closure. */
export function kitchenHours(services: Service[], now = new Date()) {
  const windows = services
    .filter((s) => s.status === "published" && s.starts_at && s.ends_at)
    .map((s) => ({
      start: Date.parse(s.starts_at!),
      end: Date.parse(s.ends_at!),
    }))
    .filter(
      (w) =>
        Number.isFinite(w.start) && Number.isFinite(w.end) && w.end > w.start,
    )
    .sort((a, b) => a.start - b.start);
  const merged: typeof windows = [];
  for (const window of windows) {
    const last = merged.at(-1);
    if (last && window.start <= last.end)
      last.end = Math.max(last.end, window.end);
    else merged.push({ ...window });
  }
  const active = merged.find((w) => w.start <= +now && +now < w.end);
  if (active)
    return {
      open: true,
      next: new Date(active.end).toISOString(),
      label: `Closes ${timeLabel(new Date(active.end).toISOString())}`,
    };
  const next = merged.find((w) => w.start > +now);
  if (!next)
    return {
      open: false,
      next: null,
      label: "Closed · Next hours unavailable",
    };
  const opening = new Date(next.start).toISOString();
  const date = campusDate(opening),
    today = campusDate(now);
  const day =
    date === today
      ? ""
      : date === shiftDate(today, 1)
        ? "tomorrow "
        : dateLabel(date, {
            weekday: "short",
            month: "short",
            day: "numeric",
          }) + ", ";
  return {
    open: false,
    next: opening,
    label: `Opens ${day}${timeLabel(opening)}`,
  };
}

function minuteOfDay(date: string | Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CAMPUS_TZ,
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(new Date(date));
  return (
    Number(parts.find((p) => p.type === "hour")?.value) * 60 +
    Number(parts.find((p) => p.type === "minute")?.value)
  );
}
const clockLabel = (minute: number) => {
  const m = ((minute % 1440) + 1440) % 1440,
    hour = Math.floor(m / 60);
  return `${hour % 12 || 12}${m % 60 ? ":" + String(m % 60).padStart(2, "0") : ""} ${hour < 12 ? "AM" : "PM"}`;
};

/** Kitchen hours repeat daily; dish availability still requires a dated menu. */
export function dailyKitchenHours(services: Service[], now = new Date()) {
  const templates = services
    .filter((s) => s.status === "published" && s.starts_at && s.ends_at)
    .filter(
      (s, _, all) =>
        !all.some(
          (other) =>
            other.name === s.name && other.service_date > s.service_date,
        ),
    );
  const windows = templates
    .flatMap((s) => {
      const start = minuteOfDay(s.starts_at!),
        endMinute = minuteOfDay(s.ends_at!);
      const end = endMinute <= start ? endMinute + 1440 : endMinute;
      return [-1440, 0, 1440].map((offset) => ({
        start: start + offset,
        end: end + offset,
      }));
    })
    .sort((a, b) => a.start - b.start);
  const merged: typeof windows = [];
  for (const window of windows) {
    const last = merged.at(-1);
    if (last && window.start <= last.end)
      last.end = Math.max(last.end, window.end);
    else merged.push({ ...window });
  }
  const minute = minuteOfDay(now);
  const active = merged.find((w) => w.start <= minute && minute < w.end);
  if (active)
    return {
      open: true,
      label:
        active.end - active.start >= 4320
          ? "Open 24 hours"
          : `Closes ${clockLabel(active.end)}`,
    };
  const next = merged.find((w) => w.start > minute);
  return {
    open: false,
    label: next
      ? `Opens ${next.start >= 1440 ? "tomorrow " : ""}${clockLabel(next.start)}`
      : "Hours unavailable",
  };
}
