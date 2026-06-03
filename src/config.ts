import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

export type RiddleSource = "preset" | "ai";

export const config = {
  telegramBotToken: required("TELEGRAM_BOT_TOKEN"),
  geminiApiKey: required("GEMINI_API_KEY"),
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-flash-latest",
  pointsPerWin: Number(process.env.POINTS_PER_WIN ?? "10"),
  databasePath: process.env.DATABASE_PATH ?? "./data/bot.db",
  /** preset — готовые загадки; ai — Gemini */
  riddleSource: (process.env.RIDDLE_SOURCE ?? "preset") as RiddleSource,
  /** Показывать ответ в сообщении с загадкой (для тестов) */
  showAnswer: process.env.SHOW_ANSWER === "true",
  /** Логировать промпты и ответы Gemini в консоль */
  logGeminiRequests: process.env.LOG_GEMINI_REQUESTS !== "false",
  nickTimeZone: process.env.NICK_TIMEZONE ?? "Europe/Moscow",
};
