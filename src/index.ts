import { Bot } from "grammy";
import { config } from "./config.js";
import { GeminiClient } from "./ai/gemini.js";
import { Repository } from "./db/repository.js";
import { GameService } from "./game/round.js";
import { DailyNickService } from "./game/daily-nick.js";
import { InsultService } from "./game/insults.js";
import { FloodTauntService } from "./game/flood-taunts.js";
import { WalletService } from "./game/economy/wallet.js";
import { ShopService } from "./game/collection/shop.js";
import { BattleService } from "./game/battle/service.js";
import { registerBotCommands } from "./bot/commands.js";
import { registerHandlers } from "./bot/handlers.js";
import { BattleAutoRunner } from "./bot/battle-auto.js";
import { expirePendingBattle } from "./bot/battle-handlers.js";
import { logIncomingUpdates } from "./bot/incoming-log.js";
import {
  HeroEmojiMapStore,
  bindHeroEmojiMapStore,
} from "./game/catalog/hero-emoji-map.js";
import {
  ItemEmojiMapStore,
  bindItemEmojiMapStore,
} from "./game/catalog/item-emoji-map.js";
import {
  awardWeeklyTitles,
  shouldRunWeeklyAward,
} from "./game/weekly-title.js";
import { getPreviousWeekKey } from "./game/periods.js";

const repo = new Repository(config.databasePath, {
  startingGold: config.startingGold,
  startingBattleMmr: config.startingBattleMmr,
});
const wallet = new WalletService(repo);
const shop = new ShopService(repo, wallet);
const battle = new BattleService(repo, wallet, {
  battleKFactor: config.battleKFactor,
  goldPerBattleWin: config.goldPerBattleWin,
  goldPerBattleLoss: config.goldPerBattleLoss,
});

const gemini = new GeminiClient(
  config.geminiApiKey,
  config.geminiModel,
  config.logGeminiRequests,
);
const game = new GameService(
  repo,
  gemini,
  config,
  config,
  wallet,
  config.riddleSource,
  config.showAnswer,
  config.nickTimeZone,
  config.riddleItemChance,
  config.goldHintBuyCost,
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

const floodTaunts = new FloodTauntService(
  repo,
  config.nickTimeZone,
  config.floodTauntsEnabled,
  config.workHoursStart,
  config.workHoursEnd,
  config.floodWindowMinutes * 60 * 1000,
  config.floodTauntsMaxPerHour,
);

const heroEmojiMap = new HeroEmojiMapStore(config.heroEmojiMapPath);
bindHeroEmojiMapStore(heroEmojiMap);
console.log(`[HeroEmojiMap] loaded → ${config.heroEmojiMapPath}`);

const itemEmojiMap = new ItemEmojiMapStore(config.itemEmojiMapPath);
bindItemEmojiMapStore(itemEmojiMap);
console.log(`[ItemEmojiMap] loaded → ${config.itemEmojiMapPath}`);

const bot = new Bot(config.telegramBotToken);
bot.use(logIncomingUpdates(config.logIncomingMessages));
const battleRunner = new BattleAutoRunner(bot.api, repo, battle);
registerHandlers(
  bot,
  game,
  repo,
  dailyNick,
  insults,
  floodTaunts,
  wallet,
  shop,
  battle,
  battleRunner,
  heroEmojiMap,
  itemEmojiMap,
);

await registerBotCommands(bot);

bot.catch((err) => {
  console.error("Bot error:", err);
});

console.log(
  `Starting bot (riddles: ${config.riddleSource}, showAnswer: ${config.showAnswer}, logGemini: ${config.logGeminiRequests}, logIncoming: ${config.logIncomingMessages})…`,
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

const battlePickTimeoutMs = config.battlePickTimeoutMinutes * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const row of repo.listPendingBattles()) {
    if (now - row.created_at >= battlePickTimeoutMs) {
      void expirePendingBattle(bot.api, repo, battle, battleRunner, row.id);
    }
  }
}, 60 * 1000);

const shutdown = () => {
  console.log("Shutting down…");
  battleRunner.stopAll();
  repo.close();
  process.exit(0);
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

bot.start({
  onStart: (info) => {
    console.log(`Bot @${info.username} is running`);
    battleRunner.resumeActive();
  },
});
