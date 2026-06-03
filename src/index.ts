import { Bot } from "grammy";
import { config } from "./config.js";
import { GeminiClient } from "./ai/gemini.js";
import { Repository } from "./db/repository.js";
import { GameService } from "./game/round.js";
import { DailyNickService } from "./game/daily-nick.js";
import { registerBotCommands } from "./bot/commands.js";
import { registerHandlers } from "./bot/handlers.js";

const repo = new Repository(config.databasePath);
const gemini = new GeminiClient(
  config.geminiApiKey,
  config.geminiModel,
  config.logGeminiRequests,
);
const game = new GameService(
  repo,
  gemini,
  config.pointsPerWin,
  config.riddleSource,
  config.showAnswer,
);

const dailyNick = new DailyNickService(
  repo,
  gemini,
  config.nickTimeZone,
  config.nickStackSize,
);

const bot = new Bot(config.telegramBotToken);
registerHandlers(bot, game, repo, dailyNick);

await registerBotCommands(bot);

bot.catch((err) => {
  console.error("Bot error:", err);
});

console.log(
  `Starting bot (riddles: ${config.riddleSource}, showAnswer: ${config.showAnswer}, logGemini: ${config.logGeminiRequests})…`,
);

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
