import {
  getCombatHero,
  type CombatHero,
} from "../catalog/catalog.js";
import { BATTLE_DAMAGE_FACTOR, BATTLE_HP_FACTOR } from "../battle/engine.js";

export type HeroCombatStats = {
  hp: number;
  mana: number;
  damage: number;
  armor: number;
};

export function computeHeroStats(
  heroId: number,
  level: number,
): HeroCombatStats | null {
  const combat = getCombatHero(heroId);
  if (!combat) return null;

  const hp = combat.base_hp + combat.hp_per_level * (level - 1);
  const mana = combat.base_mana + combat.mana_per_level * (level - 1);
  const armor = combat.base_armor;
  const damage = combat.base_damage + combat.damage_per_level * (level - 1);

  return {
    hp: Math.round(hp * BATTLE_HP_FACTOR),
    mana,
    damage: Math.round(damage * BATTLE_DAMAGE_FACTOR),
    armor,
  };
}

export function formatSkillSummary(combat: CombatHero): string {
  return combat.skills
    .map((s) => `${s.key}: ${s.name_ru}`)
    .join(" · ");
}
