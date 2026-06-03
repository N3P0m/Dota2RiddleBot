/** Ключ дня YYYY-MM-DD (по умолчанию Москва). */
export function todayKey(timeZone = "Europe/Moscow"): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
}

export function formatTodayRu(timeZone = "Europe/Moscow"): string {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}
