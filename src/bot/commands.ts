import type { Bot } from "grammy";

/** Меню при вводе «/» в чате (setMyCommands). */
const BOT_COMMANDS = [
  { command: "menu", description: "Меню команд игры" },
  { command: "riddle", description: "Новая загадка" },
  { command: "emo_riddle", description: "Эмо-загадка (скиллы эмодзи)" },
  { command: "hint", description: "Подсказка (золото)" },
  { command: "shop", description: "Магазин героев и предметов" },
  { command: "heroes", description: "Герои: статы и предметы" },
  { command: "collection", description: "Ваши герои (то же, что /heroes)" },
  { command: "gold", description: "Баланс золота и рейтинг чата" },
  { command: "fight", description: "Вызов на PvP-бой" },
  { command: "endfight", description: "Завершить активный бой" },
  { command: "nick", description: "Дотаник на сегодня" },
  { command: "top", description: "Топ-10 чата" },
  { command: "me", description: "Профиль: титул и очки" },
  { command: "achievements", description: "Достижения" },
  { command: "cancel", description: "Сдаться — показать ответ" },
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
