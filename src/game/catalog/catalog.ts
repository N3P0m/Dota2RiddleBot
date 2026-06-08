import heroesMvpData from "./heroes-mvp.json" with { type: "json" };
import itemsMvpData from "./items-mvp.json" with { type: "json" };
import combatHeroesData from "./combat-heroes.json" with { type: "json" };

export type MvpHeroCatalogEntry = {
  hero_id: number;
  rarity: "starter" | "common" | "rare" | "epic";
  required_guesses: number;
  price: number;
  /** ID кастомного эмодзи Telegram (<tg-emoji emoji-id="…">). Пусто — только emoji_fallback. */
  custom_emoji_id?: string;
  /** Unicode fallback и текст внутри tg-emoji (кнопки, превью). */
  emoji_fallback?: string;
};

export type ItemBattleEffectType =
  | "heal"
  | "mana"
  | "damage"
  | "armor_buff"
  | "damage_buff"
  | "spell_immunity"
  | "lifesteal_buff";

export type ItemBattleEffect = {
  type: ItemBattleEffectType;
  value?: number;
  duration_turns?: number;
  target?: "self" | "enemy";
};

export type ItemCatalogEntry = {
  id: number;
  name_en: string;
  name_ru: string;
  tier: 1 | 2 | 3;
  price: number;
  required_guesses: number;
  min_hero_level: number;
  min_mmr: number;
  max_uses: number;
  aliases: string[];
  bonuses: {
    hp?: number;
    mana?: number;
    damage?: number;
    armor?: number;
    lifesteal?: number;
    spell_immunity?: number;
  };
  battle_effect: ItemBattleEffect;
};

export const PLAYER_ITEM_SLOTS = 3;

export type SkillEffect = {
  type:
    | "damage"
    | "stun"
    | "heal"
    | "dot"
    | "silence"
    | "buff_armor"
    | "buff_damage"
    | "passive";
  value: number;
  duration_turns?: number;
};

export type CombatSkill = {
  key: "Q" | "W" | "E" | "R";
  name_ru: string;
  name_en: string;
  mana_cost: number;
  cooldown_turns: number;
  effect: SkillEffect;
};

export type CombatHero = {
  hero_id: number;
  base_hp: number;
  base_mana: number;
  base_armor: number;
  base_damage: number;
  hp_per_level: number;
  mana_per_level: number;
  damage_per_level: number;
  skills: CombatSkill[];
  passive?: { type: string; value: number; chance?: number };
};

export const MVP_HEROES = heroesMvpData as MvpHeroCatalogEntry[];
export const MVP_ITEMS = itemsMvpData as ItemCatalogEntry[];
export const COMBAT_HEROES = combatHeroesData as CombatHero[];

const mvpHeroMap = new Map(MVP_HEROES.map((h) => [h.hero_id, h]));
const itemMap = new Map(MVP_ITEMS.map((i) => [i.id, i]));
const combatMap = new Map(COMBAT_HEROES.map((h) => [h.hero_id, h]));

export function getMvpHeroEntry(heroId: number): MvpHeroCatalogEntry | undefined {
  return mvpHeroMap.get(heroId);
}

export function getItemById(id: number): ItemCatalogEntry | undefined {
  return itemMap.get(id);
}

export function getCombatHero(heroId: number): CombatHero | undefined {
  return combatMap.get(heroId);
}

export function getMvpHeroIds(): number[] {
  return MVP_HEROES.map((h) => h.hero_id);
}

export function maxItemSlotsForLevel(level: number): number {
  if (level >= 8) return 3;
  if (level >= 3) return 2;
  return 1;
}

export function maxItemTierForLevel(level: number): 1 | 2 | 3 {
  if (level >= 8) return 3;
  if (level >= 3) return 2;
  return 1;
}
