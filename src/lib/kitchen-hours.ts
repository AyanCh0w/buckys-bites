import holidayHours from "../../scripts/benson-holiday-hours.json";
import { CAMPUS_TZ, campusDate, shiftDate } from "./domain";
import { kitchenKey } from "./theme";
import type { Catalog, Service, Station } from "./types";

type Window = readonly [string, string];

// Transact screenshot supplied November 19, 2026, confirmed by the user as
// the regular weekday schedule. These are kitchen hours, not dish offerings.
const weekdayHours: Record<string, readonly Window[]> = {
  "spice-market": [
    ["11:00", "14:30"],
    ["17:00", "20:30"],
  ],
  "global-grill": [
    ["07:00", "10:30"],
    ["11:00", "14:30"],
    ["17:00", "20:30"],
  ],
  "la-parrilla": [
    ["07:00", "10:30"],
    ["11:00", "21:00"],
  ],
  "mission-bakery": [["07:00", "20:00"]],
  fire: [
    ["11:00", "20:30"],
    ["20:30", "23:58"],
  ],
  trattoria: [
    ["11:00", "14:30"],
    ["17:00", "21:00"],
  ],
  "simply-oasis": [
    ["11:00", "14:30"],
    ["17:00", "20:30"],
  ],
};

const clockFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: CAMPUS_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const offsetFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: CAMPUS_TZ,
  timeZoneName: "longOffset",
});

function campusTimestamp(date: string, clock: string) {
  // Resolve the offset on the target date so winter observations retain their
  // local clock times in summer. Overrides apply only on weekdays (no DST jump).
  const offset = offsetFormatter
    .formatToParts(new Date(`${date}T12:00:00Z`))
    .find((part) => part.type === "timeZoneName")!
    .value.replace("GMT", "");
  return new Date(`${date}T${clock}:00${offset}`).toISOString();
}

function regularWeekday(catalog: Catalog, station: Station, date: string) {
  const cafe = catalog.cafes.find((c) => c.id === station.cafe_id);
  if (!cafe || !["marketplace-2", "mission-bakery"].includes(cafe.source_key))
    return false;
  const exceptions =
    holidayHours[cafe.source_key as "marketplace-2" | "mission-bakery"];
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return (
    day !== 0 &&
    day !== 6 &&
    !Object.hasOwn(exceptions, date) &&
    !catalog.services.some(
      (s) =>
        s.cafe_id === station.cafe_id &&
        s.service_date === date &&
        s.status === "closed",
    )
  );
}

/** Keep operating hours independent of shared cafe-level menu service rows. */
export function operatingServices(
  catalog: Catalog,
  stations: Station[],
  services: Service[],
  now = new Date(),
): Service[] {
  const station = stations[0];
  if (!station) return services;
  const key = kitchenKey(station.name);
  if (!weekdayHours[key] && key !== "slice") return services;
  const today = campusDate(now);
  const dates = new Set([
    ...services.map((s) => s.service_date),
    ...Array.from({ length: 8 }, (_, day) => shiftDate(today, day)),
  ]);
  return [...dates].flatMap((date) => {
    const dated = services.filter((s) => s.service_date === date);
    if (
      catalog.services.some(
        (s) =>
          s.cafe_id === station.cafe_id &&
          s.service_date === date &&
          s.status === "closed",
      )
    )
      return [];
    if (!regularWeekday(catalog, station, date)) return dated;
    if (key === "slice") {
      // The screenshot confirms the next opening, not a complete daily window.
      // Retain published lunch/closing times; cafe-wide All Day is not evidence
      // that Slice serves during its afternoon break.
      return dated
        .filter((s) => !s.name.startsWith("All Day"))
        .map((s) =>
          s.name === "Dinner"
            ? { ...s, starts_at: campusTimestamp(date, "17:30") }
            : s,
        );
    }
    return weekdayHours[key].map(([start, end], index) => ({
      id: `hours:${station.cafe_id}:${key}:${date}:${index}`,
      cafe_id: station.cafe_id,
      service_date: date,
      name: "Operating hours",
      status: "published",
      starts_at: campusTimestamp(date, start),
      ends_at: campusTimestamp(date, end),
      last_successful_sync_at: null,
    }));
  });
}

/** Used only to constrain dated dish availability, never to invent a menu. */
export function stationAllowsService(
  catalog: Catalog,
  station: Station | undefined,
  service: Service,
  now: Date,
) {
  if (
    catalog.services.some(
      (s) =>
        s.cafe_id === service.cafe_id &&
        s.service_date === service.service_date &&
        s.status === "closed",
    )
  )
    return false;
  if (!station || !regularWeekday(catalog, station, service.service_date))
    return true;
  const key = kitchenKey(station.name);
  const windows = weekdayHours[key];
  if (!windows && key !== "slice") return true;
  const clock = clockFormatter.format(now);
  if (key === "slice")
    return (
      !service.name.startsWith("All Day") &&
      (service.name !== "Dinner" || clock >= "17:30")
    );
  return windows.some(([start, end]) => start <= clock && clock < end);
}
