import { InlineKeyboard } from "grammy";
import { config } from "../config.js";
import {
  formatHeroButtonLabel,
  getHeroCustomEmojiId,
} from "../game/catalog/hero-emoji.js";
import {
  formatItemButtonLabel,
  getItemCustomEmojiId,
} from "../game/catalog/item-emoji.js";
import { addHeroButton, addItemButton } from "./keyboard-emoji.js";
import type { HeroEmojiMapStore } from "../game/catalog/hero-emoji-map.js";
import type { ItemEmojiMapStore } from "../game/catalog/item-emoji-map.js";
import {
  clampEmoMapPage,
  getEmoMapHeroesPage,
  getEmoMapPageCount,
  isHeroEmojiMapped,
} from "./emo-map-pages.js";
import {
  clampItemEmoMapPage,
  getItemEmoMapPage,
  getItemEmoMapPageCount,
  isItemEmojiMapped,
} from "./item-emo-map-pages.js";
import { skillButtonLabel } from "../game/battle/format.js";
import { MVP_HEROES, MVP_ITEMS } from "../game/catalog/catalog.js";
import { getHeroById } from "../heroes/match.js";

export const CB = {
  HINT: "hint",
  CANCEL: "cancel",
  TOP: "top",
  TOP_WEEK: "top_week",
  TOP_MONTH: "top_month",
  TOP_ALL: "top_all",
  TOP_BATTLE: "top_battle",
  RIDDLE: "riddle",
  EMO_RIDDLE: "emo_riddle",
  NICK_NEW: "nick_new",
  SHOP: "shop",
  COLLECTION: "collection",
  MENU: "menu",
  FIGHT: "fight",
  COL_BACK: "col_back",
} as const;

export type CallbackAction = (typeof CB)[keyof typeof CB];

/** Во время активного раунда (под загадкой и подсказкой). */
export function keyboardDuringRound(): InlineKeyboard {
  const cost = config.goldHintBuyCost;
  return new InlineKeyboard()
    .text(`💡 Подсказка (${cost}g)`, CB.HINT)
    .text("🏳 Сдаться", CB.CANCEL);
}

/** После угадывания. */
export function keyboardAfterWin(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🏆 Топ", CB.TOP)
    .text("🧩 Новая загадка", CB.RIDDLE)
    .row()
    .text("🎭 Эмо-загадка", CB.EMO_RIDDLE)
    .row()
    .text("🏪 Магазин", CB.SHOP)
    .text("📦 Коллекция", CB.COLLECTION)
    .row()
    .text("⚔️ Вызвать на бой", CB.FIGHT);
}

export function keyboardCollectionExtras(): InlineKeyboard {
  return new InlineKeyboard()
    .text("⚔️ Вызвать на бой", CB.FIGHT)
    .text("🏪 Магазин", CB.SHOP)
    .row()
    .text("📋 Меню", CB.MENU);
}

export function keyboardMenu(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🧩 Загадка", CB.RIDDLE)
    .text("🏪 Магазин", CB.SHOP)
    .row()
    .text("📦 Герои", CB.COLLECTION)
    .text("⚔️ Бой", CB.FIGHT)
    .row()
    .text("🏆 Топ", CB.TOP);
}

export function keyboardEmoMapHeroes(
  store: HeroEmojiMapStore,
  page = 0,
): InlineKeyboard {
  const kb = new InlineKeyboard();
  const p = clampEmoMapPage(page);
  const slice = getEmoMapHeroesPage(p);
  const pages = getEmoMapPageCount();

  for (let i = 0; i < slice.length; i += 2) {
    const h1 = slice[i]!;
    addEmoMapHeroButton(kb, store, h1.id, h1.name_ru, `emo_map:${h1.id}`);
    const h2 = slice[i + 1];
    if (h2) {
      addEmoMapHeroButton(kb, store, h2.id, h2.name_ru, `emo_map:${h2.id}`);
    }
    kb.row();
  }

  if (pages > 1) {
    if (p > 0) kb.text("◀️", `emo_map_p:${p - 1}`);
    else kb.text("·", "emo_map_nop");
    kb.text(`${p + 1}/${pages}`, "emo_map_nop");
    if (p < pages - 1) kb.text("▶️", `emo_map_p:${p + 1}`);
    else kb.text("·", "emo_map_nop");
  }
  return kb;
}

function emoMapButtonLabel(
  store: HeroEmojiMapStore,
  heroId: number,
  name: string,
): string {
  const prefix = isHeroEmojiMapped(store, heroId) ? "✅ " : "";
  const max = 14;
  const short = name.length > max ? `${name.slice(0, max - 1)}…` : name;
  return `${prefix}${short}`;
}

function addEmoMapHeroButton(
  kb: InlineKeyboard,
  store: HeroEmojiMapStore,
  heroId: number,
  name: string,
  callbackData: string,
): void {
  kb.text(emoMapButtonLabel(store, heroId, name), callbackData);
  const iconId = getHeroCustomEmojiId(heroId);
  if (iconId) kb.icon(iconId);
}

function addEmoMapItemButton(
  kb: InlineKeyboard,
  store: ItemEmojiMapStore,
  itemId: number,
  name: string,
  callbackData: string,
): void {
  kb.text(itemEmoMapButtonLabel(store, itemId, name), callbackData);
  const iconId = getItemCustomEmojiId(itemId);
  if (iconId) kb.icon(iconId);
}

export function keyboardItemEmoMap(
  store: ItemEmojiMapStore,
  page = 0,
): InlineKeyboard {
  const kb = new InlineKeyboard();
  const p = clampItemEmoMapPage(page);
  const slice = getItemEmoMapPage(p);
  const pages = getItemEmoMapPageCount();

  for (let i = 0; i < slice.length; i += 2) {
    const item1 = slice[i]!;
    addEmoMapItemButton(
      kb,
      store,
      item1.id,
      item1.name_ru,
      `item_emo_map:${item1.id}`,
    );
    const item2 = slice[i + 1];
    if (item2) {
      addEmoMapItemButton(
        kb,
        store,
        item2.id,
        item2.name_ru,
        `item_emo_map:${item2.id}`,
      );
    }
    kb.row();
  }

  if (pages > 1) {
    if (p > 0) kb.text("◀️", `item_emo_map_p:${p - 1}`);
    else kb.text("·", "item_emo_map_nop");
    kb.text(`${p + 1}/${pages}`, "item_emo_map_nop");
    if (p < pages - 1) kb.text("▶️", `item_emo_map_p:${p + 1}`);
    else kb.text("·", "item_emo_map_nop");
  }
  return kb;
}

function itemEmoMapButtonLabel(
  store: ItemEmojiMapStore,
  itemId: number,
  name: string,
): string {
  const prefix = isItemEmojiMapped(store, itemId) ? "✅ " : "";
  const max = 14;
  const short = name.length > max ? `${name.slice(0, max - 1)}…` : name;
  return `${prefix}${short}`;
}

export function keyboardCollectionList(heroIds: number[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const id of heroIds) {
    addHeroButton(kb, id, `col_h:${id}`).row();
  }
  kb.text("🏪 Магазин", CB.SHOP).text("📋 Меню", CB.MENU);
  return kb;
}

export function keyboardHeroDetail(
  heroId: number,
  sellRefund: number,
  canSell: boolean,
): InlineKeyboard {
  const kb = new InlineKeyboard();

  if (canSell && sellRefund > 0) {
    kb.text(`💰 Продать (+${sellRefund}g)`, `col_sell:${heroId}`).row();
  }

  kb.text("« К героям", CB.COL_BACK).text("📋 Меню", CB.MENU);
  return kb;
}

/** Под сообщением топа — переключатель периода. */
export function keyboardLeaderboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Неделя", CB.TOP_WEEK)
    .text("Месяц", CB.TOP_MONTH)
    .text("Всё время", CB.TOP_ALL)
    .row()
    .text("🏆 Рейтинг", CB.TOP_BATTLE);
}

/** Под сообщением с дотаником. */
export function keyboardAfterNick(): InlineKeyboard {
  return new InlineKeyboard().text("🔄 Перекатить ник", CB.NICK_NEW);
}

export function keyboardShop(
  unlockedHeroes: { heroId: number; price: number; owned: boolean; unlocked: boolean }[],
  unlockedItems: {
    itemId: number;
    price: number;
    unlocked: boolean;
    owned: boolean;
    canBuy: boolean;
  }[],
): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const h of unlockedHeroes) {
    if (h.owned || !h.unlocked) continue;
    const label = formatHeroButtonLabel(h.heroId);
    kb.text(`Купить ${label} (${h.price}g)`, `shop_h:${h.heroId}`);
    const heroIcon = getHeroCustomEmojiId(h.heroId);
    if (heroIcon) kb.icon(heroIcon);
    kb.row();
  }
  for (const i of unlockedItems) {
    if (!i.canBuy) continue;
    const label = formatItemButtonLabel(i.itemId);
    kb.text(`Купить ${label} (${i.price}g)`, `shop_i:${i.itemId}`);
    const itemIcon = getItemCustomEmojiId(i.itemId);
    if (itemIcon) kb.icon(itemIcon);
    kb.row();
  }
  kb.text("« Коллекция", CB.COLLECTION).text("📋 Меню", CB.MENU);
  return kb;
}

export function keyboardPickHero(
  battleId: number,
  heroIds: number[],
): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const id of heroIds) {
    addHeroButton(kb, id, `btl_pick:${battleId}:${id}`).row();
  }
  if (config.testBattleCancel) {
    kb.text("🧪 Отменить бой", `btl_cancel:${battleId}`);
  }
  return kb;
}

export function keyboardPickHeroForFight(
  heroIds: number[],
  targetUserId: string,
): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const id of heroIds) {
    addHeroButton(kb, id, `fight_ch:${targetUserId}:${id}`).row();
  }
  kb.text("« Назад", CB.FIGHT).row();
  return kb;
}

export function keyboardFightOpponents(
  opponents: { userId: string; displayName: string }[],
): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const o of opponents.slice(0, 12)) {
    const name =
      o.displayName.length > 22
        ? `${o.displayName.slice(0, 20)}…`
        : o.displayName;
    kb.text(`⚔️ ${name}`, `fight_vs:${o.userId}`).row();
  }
  return kb;
}

const BTL_SEP = "btl_nop";

function appendAttackRow(
  kb: InlineKeyboard,
  battleId: number,
  side: "ch" | "def",
  sideLabel: string,
): void {
  kb.text(`${sideLabel} Атака`, `btl:${battleId}:${side}:attack`).row();
}

function appendItemRow(
  kb: InlineKeyboard,
  battleId: number,
  side: "ch" | "def",
  sideLabel: string,
  items: { itemId: number; usesRemaining: number }[],
  pendingItemId?: number,
): void {
  const usable = items.filter((i) => i.usesRemaining > 0);
  if (usable.length === 0) return;

  for (const item of usable) {
    const label = formatItemButtonLabel(item.itemId);
    const short = label.length > 14 ? `${label.slice(0, 12)}…` : label;
    const mark = pendingItemId === item.itemId ? "✓ " : "";
    kb.text(
      `${sideLabel} ${mark}${short} (${item.usesRemaining})`,
      `btl_item:${battleId}:${side}:${item.itemId}`,
    );
    const itemIcon = getItemCustomEmojiId(item.itemId);
    if (itemIcon) kb.icon(itemIcon);
  }
  kb.row();
}

function appendSkillRow(
  kb: InlineKeyboard,
  battleId: number,
  side: "ch" | "def",
  heroId: number,
): void {
  for (const key of ["Q", "W", "E", "R"] as const) {
    const label = skillButtonLabel(heroId, key);
    kb.text(label, `btl:${battleId}:${side}:${key}`);
  }
  kb.row();
}

/** Атака → предметы → скиллы для одного игрока. */
function appendPlayerBattleRows(
  kb: InlineKeyboard,
  battleId: number,
  side: "ch" | "def",
  heroId: number,
  sideLabel: string,
  items: { itemId: number; usesRemaining: number }[],
  pendingItemId?: number,
): void {
  appendAttackRow(kb, battleId, side, sideLabel);
  appendItemRow(kb, battleId, side, sideLabel, items, pendingItemId);
  appendSkillRow(kb, battleId, side, heroId);
}

/** Разделитель между блоками игроков (nop-кнопка). */
function appendBattleSeparator(kb: InlineKeyboard): void {
  kb.text("· · ·", BTL_SEP).row();
}

/** Ряды боя: атака / предметы / скиллы для каждого игрока. */
export function keyboardBattleActions(
  battleId: number,
  challengerHeroId: number,
  defenderHeroId: number,
  challengerItems: { itemId: number; usesRemaining: number }[],
  defenderItems: { itemId: number; usesRemaining: number }[],
  challengerPendingItemId?: number,
  defenderPendingItemId?: number,
): InlineKeyboard {
  const kb = new InlineKeyboard();
  appendPlayerBattleRows(
    kb,
    battleId,
    "ch",
    challengerHeroId,
    "▶️",
    challengerItems,
    challengerPendingItemId,
  );
  appendBattleSeparator(kb);
  appendPlayerBattleRows(
    kb,
    battleId,
    "def",
    defenderHeroId,
    "🛡",
    defenderItems,
    defenderPendingItemId,
  );
  if (config.testBattleCancel) {
    kb.text("🧪 Отменить бой", `btl_cancel:${battleId}`);
  }
  return kb;
}

export function mvpHeroIdsForShop(): number[] {
  return MVP_HEROES.map((h) => h.hero_id);
}
