import { InlineKeyboard } from "grammy";

export const CB = {
  HINT: "hint",
  CANCEL: "cancel",
  TOP: "top",
  TOP_WEEK: "top_week",
  TOP_MONTH: "top_month",
  TOP_ALL: "top_all",
  RIDDLE: "riddle",
  EMO_RIDDLE: "emo_riddle",
  NICK_NEW: "nick_new",
} as const;

export type CallbackAction = (typeof CB)[keyof typeof CB];

/** Во время активного раунда (под загадкой и подсказкой). */
export function keyboardDuringRound(): InlineKeyboard {
  return new InlineKeyboard()
    .text("💡 Подсказка", CB.HINT)
    .text("🏳 Сдаться", CB.CANCEL);
}

/** После угадывания. */
export function keyboardAfterWin(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🏆 Топ", CB.TOP)
    .text("🧩 Новая загадка", CB.RIDDLE)
    .row()
    .text("🎭 Эмо-загадка", CB.EMO_RIDDLE);
}

/** Под сообщением топа — переключатель периода. */
export function keyboardLeaderboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Неделя", CB.TOP_WEEK)
    .text("Месяц", CB.TOP_MONTH)
    .text("Всё время", CB.TOP_ALL);
}

/** Под сообщением с дотаником. */
export function keyboardAfterNick(): InlineKeyboard {
  return new InlineKeyboard().text("🔄 Перекатить ник", CB.NICK_NEW);
}
