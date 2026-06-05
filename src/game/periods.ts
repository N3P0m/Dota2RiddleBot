/** Ключ недели: YYYY-Www (ISO, понедельник — начало недели). */
export function weekKey(date = new Date(), timeZone = "Europe/Moscow"): string {
  const parts = getDateParts(date, timeZone);
  const iso = getIsoWeek(parts.year, parts.month, parts.day);
  return `${iso.year}-W${String(iso.week).padStart(2, "0")}`;
}

/** Ключ месяца: YYYY-MM. */
export function monthKey(date = new Date(), timeZone = "Europe/Moscow"): string {
  const parts = getDateParts(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}`;
}

export function getPreviousWeekKey(
  date = new Date(),
  timeZone = "Europe/Moscow",
): string {
  const d = new Date(date.getTime() - 7 * 24 * 60 * 60 * 1000);
  return weekKey(d, timeZone);
}

export function getPreviousMonthKey(
  date = new Date(),
  timeZone = "Europe/Moscow",
): string {
  const parts = getDateParts(date, timeZone);
  let year = parts.year;
  let month = parts.month - 1;
  if (month < 1) {
    month = 12;
    year -= 1;
  }
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Диапазон недели для заголовка: «2–8 июня». */
export function formatWeekRange(
  key: string,
  timeZone = "Europe/Moscow",
): string {
  const match = /^(\d{4})-W(\d{2})$/.exec(key);
  if (!match) return key;

  const year = Number(match[1]);
  const week = Number(match[2]);
  const monday = isoWeekToDate(year, week);
  const sunday = new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000);

  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("ru-RU", {
      timeZone,
      day: "numeric",
      month: "long",
    }).format(d);

  const monStr = fmt(monday);
  const sunStr = fmt(sunday);
  if (monStr === sunStr) return monStr;
  const monDay = monStr.replace(/\s.+$/, "");
  return `${monDay}–${sunStr}`;
}

export function formatMonthLabel(
  key: string,
  timeZone = "Europe/Moscow",
): string {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match) return key;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const d = new Date(Date.UTC(year, month, 15));
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone,
    month: "long",
    year: "numeric",
  }).format(d);
}

function getDateParts(
  date: Date,
  timeZone: string,
): { year: number; month: number; day: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [y, m, d] = fmt.format(date).split("-").map(Number);
  return { year: y!, month: m!, day: d! };
}

function getIsoWeek(
  year: number,
  month: number,
  day: number,
): { year: number; week: number } {
  const d = new Date(Date.UTC(year, month - 1, day));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const isoYear = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return { year: isoYear, week };
}

function isoWeekToDate(year: number, week: number): Date {
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  const dow = simple.getUTCDay();
  const diff = dow <= 4 ? dow - 1 : dow - 8;
  simple.setUTCDate(simple.getUTCDate() - diff);
  return simple;
}
