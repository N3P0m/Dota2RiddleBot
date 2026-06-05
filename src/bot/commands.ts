import type { Bot } from "grammy";

/** Меню при вводе «/» в чате (setMyCommands). */
const BOT_COMMANDS = [
  { command: "riddle", description: "Новая загадка" },
  { command: "emo_riddle", description: "Эмо-загадка (скиллы эмодзи)" },
  { command: "hint", description: "Подсказка (каждая явнее)" },
  { command: "nick", description: "Дотаник на сегодня" },
  { command: "top", description: "Топ-10 чата" },
  { command: "me", description: "Профиль: титул и очки" },
  { command: "achievements", description: "Достижения" },
  { command: "cancel", description: "Сдаться — показать героя" },
  { command: "help", description: "Правила и команды" },
  { command: "start", description: "Справка" },
] as const;

export async function registerBotCommands(bot: Bot): Promise<void> {
  const commands = [...BOT_COMMANDS];
  await bot.api.setMyCommands(commands);
  await bot.api.setMyCommands(commands, {
    scope: { type: "all_group_chats" },
  });
}
