import { Bot } from "grammy";
import { config } from "./config.js";
import { GeminiClient } from "./ai/gemini.js";
import { Repository } from "./db/repository.js";
import { GameService } from "./game/round.js";
import { DailyNickService } from "./game/daily-nick.js";
import { InsultService } from "./game/insults.js";
import { registerBotCommands } from "./bot/commands.js";
import { registerHandlers } from "./bot/handlers.js";
import {
  awardWeeklyTitles,
  shouldRunWeeklyAward,
} from "./game/weekly-title.js";
import { getPreviousWeekKey } from "./game/periods.js";

const repo = new Repository(config.databasePath);
const gemini = new GeminiClient(
  config.geminiApiKey,
  config.geminiModel,
  config.logGeminiRequests,
);
const game = new GameService(
  repo,
  gemini,
  config,
  config.riddleSource,
  config.showAnswer,
  config.nickTimeZone,
);

const dailyNick = new DailyNickService(
  repo,
  gemini,
  config.nickTimeZone,
  config.nickStackSize,
);

const insults = new InsultService(
  repo,
  gemini,
  config.nickTimeZone,
  config.insultMaxPool,
  config.insultDailyBatch,
  config.insultsEnabled,
);

const bot = new Bot(config.telegramBotToken);
registerHandlers(bot, game, repo, dailyNick, insults);

await registerBotCommands(bot);

bot.catch((err) => {
  console.error("Bot error:", err);
});

console.log(
  `Starting bot (riddles: ${config.riddleSource}, showAnswer: ${config.showAnswer}, logGemini: ${config.logGeminiRequests})…`,
);

let lastWeeklyAwardWeek = getPreviousWeekKey(new Date(), config.nickTimeZone);

function runWeeklyTitleJob(): void {
  if (!config.weeklyTitleEnabled) return;
  if (!shouldRunWeeklyAward(config.nickTimeZone, lastWeeklyAwardWeek)) return;
  const awarded = awardWeeklyTitles(repo, config.nickTimeZone, true);
  lastWeeklyAwardWeek = getPreviousWeekKey(new Date(), config.nickTimeZone);
  if (awarded > 0) {
    console.log(`[WeeklyTitle] Awarded ${awarded} title(s)`);
  }
}

if (config.weeklyTitleEnabled) {
  const catchUp = awardWeeklyTitles(repo, config.nickTimeZone, true);
  if (catchUp > 0) {
    console.log(`[WeeklyTitle] Catch-up: awarded ${catchUp} title(s)`);
  }
  setInterval(runWeeklyTitleJob, 60 * 60 * 1000);
}

const shutdown = () => {
  console.log("Shutting down…");
  repo.close();
  process.exit(0);
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

bot.start({
  onStart: (info) => {
    console.log(`Bot @${info.username} is running`);
  },
});
