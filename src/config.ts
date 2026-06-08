import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

export type RiddleSource = "preset" | "ai";

export type TitleId =
  | "herald"
  | "guardian"
  | "crusader"
  | "archon"
  | "legend"
  | "ancient"
  | "divine"
  | "immortal";

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
  /** Логировать входящие сообщения и нажатия кнопок пользователей */
  logIncomingMessages: process.env.LOG_INCOMING_MESSAGES !== "false",
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
  floodTauntsEnabled: process.env.FLOOD_TAUNTS_ENABLED !== "false",
  workHoursStart: Number(process.env.WORK_HOURS_START ?? "8"),
  workHoursEnd: Number(process.env.WORK_HOURS_END ?? "16"),
  floodWindowMinutes: Math.min(
    60,
    Math.max(10, Number(process.env.FLOOD_WINDOW_MINUTES ?? "30")),
  ),
  floodTauntsMaxPerHour: Math.min(
    5,
    Math.max(1, Number(process.env.FLOOD_TAUNTS_MAX_PER_HOUR ?? "2")),
  ),
  startingGold: Number(process.env.STARTING_GOLD ?? "80"),
  goldPerWin: Number(process.env.GOLD_PER_WIN ?? "8"),
  goldPerBattleWin: Number(process.env.GOLD_PER_BATTLE_WIN ?? "20"),
  goldPerBattleLoss: Number(process.env.GOLD_PER_BATTLE_LOSS ?? "6"),
  goldHintBuyCost: Number(process.env.GOLD_HINT_BUY_COST ?? "5"),
  goldHintWinnerTax: Number(process.env.GOLD_HINT_WINNER_TAX ?? "2"),
  itemRechargeRate: Number(process.env.ITEM_RECHARGE_RATE ?? "0.4"),
  riddleItemChance: Number(process.env.RIDDLE_ITEM_CHANCE ?? "0.15"),
  battleKFactor: Number(process.env.BATTLE_K_FACTOR ?? "25"),
  startingBattleMmr: Number(process.env.STARTING_BATTLE_MMR ?? "1000"),
  /** Тест: кнопка «Отменить бой» без штрафов */
  testBattleCancel: process.env.TEST_BATTLE_CANCEL === "true",
  /** Таймаут ожидания выбора героя защитником (минуты) */
  battlePickTimeoutMinutes: Math.min(
    30,
    Math.max(3, Number(process.env.BATTLE_PICK_TIMEOUT_MINUTES ?? "8")),
  ),
  /** Доля цены при продаже героя (0.5 = 50%) */
  heroSellRefundRate: Number(process.env.HERO_SELL_REFUND_RATE ?? "0.5"),
  /** Dev: /emo-map — привязка custom emoji к героям (глобально для бота) */
  heroEmojiMapDev: process.env.HERO_EMOJI_MAP_DEV === "true",
  heroEmojiMapPath:
    process.env.HERO_EMOJI_MAP_PATH ?? "./data/hero-emoji-map.json",
  itemEmojiMapPath:
    process.env.ITEM_EMOJI_MAP_PATH ?? "./data/item-emoji-map.json",
  titleEmoji: {
    herald: process.env.TITLE_EMOJI_HERALD ?? process.env.TITLE_EMOJI_CREEP,
    guardian: process.env.TITLE_EMOJI_GUARDIAN ?? process.env.TITLE_EMOJI_SUPPORT,
    crusader: process.env.TITLE_EMOJI_CRUSADER ?? process.env.TITLE_EMOJI_CARRY,
    archon: process.env.TITLE_EMOJI_ARCHON ?? process.env.TITLE_EMOJI_CORE,
    legend: process.env.TITLE_EMOJI_LEGEND,
    ancient: process.env.TITLE_EMOJI_ANCIENT,
    divine: process.env.TITLE_EMOJI_DIVINE,
    immortal: process.env.TITLE_EMOJI_IMMORTAL,
  } satisfies Record<TitleId, string | undefined>,
};
