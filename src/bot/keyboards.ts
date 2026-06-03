import { InlineKeyboard } from "grammy";

export const CB = {
  HINT: "hint",
  CANCEL: "cancel",
  TOP: "top",
  RIDDLE: "riddle",
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
    .text("🧩 Новая загадка", CB.RIDDLE);
}

/** Под сообщением с дотаником. */
export function keyboardAfterNick(): InlineKeyboard {
  return new InlineKeyboard().text("🔄 Перекатить ник", CB.NICK_NEW);
}
