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
import { addHeroButton } from "./keyboard-emoji.js";
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
import { MVP_HEROES, MVP_ITEMS } from "../game/catalog/catalog.js";
import { getHeroById } from "../heroes/match.js";

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
  SHOP: "shop",
  SHOP_FULL: "shop_full",
  SHOP_AVAIL: "shop_avail",
  COLLECTION: "collection",
  MENU: "menu",
  FIGHT: "fight",
  COL_BACK: "col_back",
} as const;

export type CallbackAction = (typeof CB)[keyof typeof CB];

export type ShopViewMode = "compact" | "full";

/** Единая навигация после ключевых действий и в меню. */
export function keyboardHub(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🧩 Загадка", CB.RIDDLE)
    .text("🎭 Эмо-загадка", CB.EMO_RIDDLE)
    .row()
    .text("🏪 Магазин", CB.SHOP)
    .text("📦 Коллекция", CB.COLLECTION)
    .row()
    .text("⚔️ Бой", CB.FIGHT)
    .text("🏆 Топ", CB.TOP)
    .row()
    .text("📋 Меню", CB.MENU);
}

/** Во время активного раунда (под загадкой и подсказкой). */
export function keyboardDuringRound(): InlineKeyboard {
  const cost = config.goldHintBuyCost;
  return new InlineKeyboard()
    .text(`💡 Подсказка (${cost}g)`, CB.HINT)
    .text("🏳 Сдаться", CB.CANCEL);
}

/** После угадывания. */
export function keyboardAfterWin(): InlineKeyboard {
  return keyboardHub();
}

/** Под итогами боя. */
export function keyboardAfterBattle(): InlineKeyboard {
  return keyboardHub();
}

export function keyboardMenu(): InlineKeyboard {
  return keyboardHub();
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
    .text("Всё время", CB.TOP_ALL);
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
  rechargeSlots: { slot: number; itemId: number; cost: number }[] = [],
  viewMode: ShopViewMode = "compact",
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
  for (const r of rechargeSlots) {
    const label = formatItemButtonLabel(r.itemId);
    kb.text(`🔋 ${label} (${r.cost}g)`, `shop_r:${r.slot}`);
    const itemIcon = getItemCustomEmojiId(r.itemId);
    if (itemIcon) kb.icon(itemIcon);
    kb.row();
  }
  if (viewMode === "compact") {
    kb.text("🔒 Весь каталог", CB.SHOP_FULL).row();
  } else {
    kb.text("📋 Доступное", CB.SHOP_AVAIL).row();
  }
  kb.text("« К героям", CB.COLLECTION).text("📋 Меню", CB.MENU);
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
  kb.text("🏳 Отклонить", `btl_decline:${battleId}`).row();
  if (config.testBattleCancel) {
    kb.text("🧪 Отменить бой", `btl_cancel:${battleId}`);
  }
  return kb;
}

/** Кнопки на сообщении инициатора, пока ждём защитника. */
export function keyboardChallengePending(battleId: number): InlineKeyboard {
  return new InlineKeyboard().text(
    "❌ Отменить вызов",
    `btl_cancel:${battleId}`,
  );
}

export function keyboardPickHeroForFight(
  heroIds: number[],
  targetUserId: string,
): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const id of heroIds) {
    addHeroButton(kb, id, `fight_ch:${targetUserId}:${id}`).row();
  }
  kb.text("« К соперникам", CB.FIGHT).row();
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

export function mvpHeroIdsForShop(): number[] {
  return MVP_HEROES.map((h) => h.hero_id);
}
