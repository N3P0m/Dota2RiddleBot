export type WorkTimeSlot = "morning" | "midday" | "afternoon";

/** Слот для подбора флуд-реплики. */
export type FloodTauntSlot =
  | WorkTimeSlot
  | "work"
  | "evening"
  | "night"
  | "leisure";

export function getHourInTimeZone(
  date: Date,
  timeZone: string,
): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hour12: false,
  }).format(date);
  return Number(hour);
}

export function getWorkTimeSlot(
  date: Date,
  timeZone: string,
  workStart = 8,
  workEnd = 16,
): WorkTimeSlot | null {
  const hour = getHourInTimeZone(date, timeZone);
  if (hour < workStart || hour >= workEnd) return null;
  const span = workEnd - workStart;
  const third = span / 3;
  const offset = hour - workStart;
  if (offset < third) return "morning";
  if (offset < third * 2) return "midday";
  return "afternoon";
}

export function isWorkHours(
  date: Date,
  timeZone: string,
  workStart = 8,
  workEnd = 16,
): boolean {
  return getWorkTimeSlot(date, timeZone, workStart, workEnd) !== null;
}

/** Слот подбора текста: рабочие — про работу, остальное — общие. */
export function getFloodTauntSlot(
  date: Date,
  timeZone: string,
  workStart = 8,
  workEnd = 16,
): { slot: FloodTauntSlot; isWorkHours: boolean } {
  const workSlot = getWorkTimeSlot(date, timeZone, workStart, workEnd);
  if (workSlot) {
    return { slot: workSlot, isWorkHours: true };
  }

  const hour = getHourInTimeZone(date, timeZone);
  if (hour >= workEnd && hour < 22) {
    return { slot: "evening", isWorkHours: false };
  }
  if (hour >= 22 || hour < 6) {
    return { slot: "night", isWorkHours: false };
  }
  return { slot: "leisure", isWorkHours: false };
}

export function workHourKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value ?? "0000";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  const h = parts.find((p) => p.type === "hour")?.value ?? "00";
  return `${y}-${m}-${d}T${h}`;
}
