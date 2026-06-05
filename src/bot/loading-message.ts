import type { Api, InlineKeyboard } from "grammy";

export const RIDDLE_LOADING_STATUSES = [
  "🎲 Ща придумаю, погоди…",
  "🌫️ Кручу образ на реке…",
  "⚡ Почти придумал…",
  "✨ Добиваю загадку…",
  "🔮 Ещё чуть-чуть…",
  "🐸 Смокаю ульт на базе…",
  "📖 Листаю лор в Википедии…",
  "☕ Пью кларити, думаю…",
  "🛒 Смотрю, что в шопе у Рошана…",
  "👻 Сканю вард в тумане войны…",
  "🎯 Фармлю вдохновение на лайне…",
  "💀 Жду респ героя в голове…",
  "🧠 Стакую идеи в уме…",
  "⚔️ Байчу загадку на мид…",
  "🕐 Жду кд на креатив…",
  "🌲 Прячусь в лесу за сюжетом…",
  "🔥 Пушу мысль в таверну…",
  "🦅 Варжу глазами по карте…",
  "🧪 Мешаю лор с мемами…",
  "📢 Пингую нейросеть: GO MID…",
  "🏃 Ротация в сторону гениальности…",
  "💎 Дропнул инсайт, подбираю…",
  "🌀 ТПшусь к вдохновению…",
  "🛡️ Ставлю вард на очевидность…",
  "🎭 Примеряю голос героя…",
  "📜 Читаю патчноуты 2013 года…",
  "🤔 А если это всё-таки Techies?…",
  "🚫 Отменяю некастомный скиллбилд…",
  "🌙 Ночной фарм слов…",
  "🎪 Цирк идей, один остался…",
  "🍖 Рошан не готов, загадка — да…",
  "⏳ GG подождите, не GG…",
  "🧙 Кастую «Придумать загадку»…",
  "🗺️ Контроль варда над сюжетом…",
] as const;

export const NICK_LOADING_STATUSES = [
  "🎭 Придумываю позорный ник…",
  "📛 Ковыряюсь в словаре токсика…",
  "🧢 Меряю кепку смурфа…",
  "✏️ Вбиваю ник в Dota…",
  "🐸 Стив Блоуджобс одобряет…",
  "⚡ Почти готово, не репортите…",
  "🎪 Цирк ников открыт…",
  "💀 Жду респ креатива…",
] as const;

export const EMO_LOADING_STATUSES = [
  "🎭 Подбираю эмодзи под скиллы…",
  "⚡ Кастую «Эмодзи-ульт»…",
  "🪝 Хукаю подходящий смайл…",
  "✨ Бафаю QWER эмодзи…",
  "🧠 Стакую скиллы в строку…",
  "🎯 Мапплю способности на эмодзи…",
  "🔮 Почти готово…",
  "🐸 Смокаю ульт на базе…",
] as const;

export const HINT_LOADING_STATUSES = [
  "💡 Подсказка на подходе…",
  "💡 Почти готово…",
  "💡 Секунду…",
  "🔦 Светим фонариком в туман…",
  "🧩 Подкладываю кусочек пазла…",
  "📣 Шепчу намёк со спектром…",
  "🎯 Снижаю сложность рейда…",
  "☕ Добавляю сахар в подсказку…",
  "👀 Подсматриваю в чит-лист (шутка)…",
  "⚡ Бафаю понимание на 15 сек…",
] as const;

const TICK_MS = 3000;

export function pickRandomStatus(
  frames: readonly string[],
  exclude?: string,
): string {
  if (frames.length === 0) return "⏳ Подождите…";
  if (frames.length === 1) return frames[0]!;

  let next = frames[Math.floor(Math.random() * frames.length)]!;
  let guard = 0;
  while (next === exclude && guard++ < 8) {
    next = frames[Math.floor(Math.random() * frames.length)]!;
  }
  return next;
}

export type LoadingTicker = {
  stop: () => void;
};

/** Случайно меняет текст сообщения, пока идёт async-задача. */
export function startLoadingTicker(
  api: Api,
  chatId: number,
  messageId: number,
  frames: readonly string[],
  initial?: string,
): LoadingTicker {
  let current = initial ?? pickRandomStatus(frames);

  const tick = () => {
    current = pickRandomStatus(frames, current);
    api.editMessageText(chatId, messageId, current).catch(() => {});
  };

  const timer = setInterval(tick, TICK_MS);
  return {
    stop: () => clearInterval(timer),
  };
}

export async function replaceMessage(
  api: Api,
  chatId: number,
  messageId: number,
  text: string,
  html = false,
  keyboard?: InlineKeyboard,
): Promise<void> {
  await api.editMessageText(chatId, messageId, text, {
    parse_mode: html ? "HTML" : undefined,
    reply_markup: keyboard,
  });
}
