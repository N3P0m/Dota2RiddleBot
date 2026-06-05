import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

export type RiddleSource = "preset" | "ai";

export type TitleId = "creep" | "support" | "carry" | "core" | "divine";

export const config = {
  telegramBotToken: required("TELEGRAM_BOT_TOKEN"),
  geminiApiKey: required("GEMINI_API_KEY"),
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-flash-latest",
  pointsPerWin: Number(process.env.POINTS_PER_WIN ?? "10"),
  minPointsPerWin: Number(process.env.MIN_POINTS_PER_WIN ?? "1"),
  hintPenalty: Number(process.env.HINT_PENALTY ?? "2"),
  maxHintPenalty: Number(process.env.MAX_HINT_PENALTY ?? "6"),
  speedBonusFast: Number(process.env.SPEED_BONUS_FAST ?? "5"),
  speedBonusMed: Number(process.env.SPEED_BONUS_MED ?? "2"),
  streakBonus3: Number(process.env.STREAK_BONUS_3 ?? "2"),
  streakBonus5: Number(process.env.STREAK_BONUS_5 ?? "5"),
  streakBonus10: Number(process.env.STREAK_BONUS_10 ?? "10"),
  databasePath: process.env.DATABASE_PATH ?? "./data/bot.db",
  /** preset — готовые загадки; ai — Gemini */
  riddleSource: (process.env.RIDDLE_SOURCE ?? "preset") as RiddleSource,
  /** Показывать ответ в сообщении с загадкой (для тестов) */
  showAnswer: process.env.SHOW_ANSWER === "true",
  /** Логировать промпты и ответы Gemini в консоль */
  logGeminiRequests: process.env.LOG_GEMINI_REQUESTS !== "false",
  nickTimeZone: process.env.NICK_TIMEZONE ?? "Europe/Moscow",
  /** Сколько ников за один запрос к Gemini (перекаты без API, пока не кончится очередь) */
  nickStackSize: Math.min(
    10,
    Math.max(5, Number(process.env.NICK_STACK_SIZE ?? "8")),
  ),
  weeklyTitleEnabled: process.env.WEEKLY_TITLE_ENABLED !== "false",
  achievementsAnnounce: process.env.ACHIEVEMENTS_ANNOUNCE !== "false",
  insultsEnabled: process.env.INSULTS_ENABLED !== "false",
  insultMaxPool: Math.min(300, Math.max(50, Number(process.env.INSULT_MAX_POOL ?? "300"))),
  insultDailyBatch: Math.min(20, Math.max(5, Number(process.env.INSULT_DAILY_BATCH ?? "20"))),
  titleEmoji: {
    creep: process.env.TITLE_EMOJI_CREEP,
    support: process.env.TITLE_EMOJI_SUPPORT,
    carry: process.env.TITLE_EMOJI_CARRY,
    core: process.env.TITLE_EMOJI_CORE,
    divine: process.env.TITLE_EMOJI_DIVINE,
  } satisfies Record<TitleId, string | undefined>,
};
