import {
  getCombatHero,
  getItemById,
  type CombatHero,
  type CombatSkill,
} from "../catalog/catalog.js";

export type BattleAction = "attack" | "Q" | "W" | "E" | "R";

/** На старте бои должны решаться за ~3–4 раунда. */
export const BATTLE_HP_FACTOR = 0.62;
export const BATTLE_DAMAGE_FACTOR = 1.5;

export type BattleItemState = {
  itemId: number;
  usesRemaining: number;
};

export type FighterState = {
  userId: string;
  heroId: number;
  level: number;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  armor: number;
  damage: number;
  battleItems: BattleItemState[];
  cooldowns: Record<string, number>;
  statuses: {
    stunned: number;
    silenced: number;
    dot: number;
    dotDamage: number;
    buffArmor: number;
    buffDamage: number;
    spellImmune: number;
    lifestealBuff: number;
    lifestealPercent: number;
  };
  pendingItemId?: number;
  pendingAction?: BattleAction;
  lastAction?: BattleAction;
};

export type BattleState = {
  challenger: FighterState;
  defender: FighterState;
  turn: number;
  log: string[];
};

function calcStats(
  combat: CombatHero,
  level: number,
): Pick<FighterState, "maxHp" | "maxMana" | "armor" | "damage"> {
  const maxHp = combat.base_hp + combat.hp_per_level * (level - 1);
  const maxMana = combat.base_mana + combat.mana_per_level * (level - 1);
  const armor = combat.base_armor;
  const damage = combat.base_damage + combat.damage_per_level * (level - 1);

  return {
    maxHp: Math.round(maxHp * BATTLE_HP_FACTOR),
    maxMana,
    armor,
    damage: Math.round(damage * BATTLE_DAMAGE_FACTOR),
  };
}

export function createFighter(
  userId: string,
  heroId: number,
  level: number,
  battleItems: BattleItemState[] = [],
): FighterState | null {
  const combat = getCombatHero(heroId);
  if (!combat) return null;

  const stats = calcStats(combat, level);

  return {
    userId,
    heroId,
    level,
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    mana: stats.maxMana,
    maxMana: stats.maxMana,
    armor: stats.armor,
    damage: stats.damage,
    battleItems: battleItems.map((i) => ({ ...i })),
    cooldowns: {},
    statuses: {
      stunned: 0,
      silenced: 0,
      dot: 0,
      dotDamage: 0,
      buffArmor: 0,
      buffDamage: 0,
      spellImmune: 0,
      lifestealBuff: 0,
      lifestealPercent: 0,
    },
  };
}

export function initBattle(
  challenger: FighterState,
  defender: FighterState,
): BattleState {
  return {
    challenger,
    defender,
    turn: 1,
    log: ["Бой начался!"],
  };
}

function getSkill(combat: CombatHero, action: BattleAction): CombatSkill | null {
  if (action === "attack") return null;
  return combat.skills.find((s) => s.key === action) ?? null;
}

function reduceArmor(damage: number, armor: number): number {
  const reduction = armor * 0.05;
  return Math.max(1, Math.round(damage * (1 - reduction)));
}

function scaleSkillDamage(value: number): number {
  return Math.round(value * BATTLE_DAMAGE_FACTOR);
}

function tickStatuses(f: FighterState): void {
  if (f.statuses.stunned > 0) f.statuses.stunned--;
  if (f.statuses.silenced > 0) f.statuses.silenced--;
  if (f.statuses.buffArmor > 0) f.statuses.buffArmor--;
  if (f.statuses.buffDamage > 0) f.statuses.buffDamage--;
  if (f.statuses.spellImmune > 0) f.statuses.spellImmune--;
  if (f.statuses.lifestealBuff > 0) f.statuses.lifestealBuff--;
  if (f.statuses.dot > 0) {
    f.hp -= f.statuses.dotDamage;
    f.statuses.dot--;
  }
  for (const key of Object.keys(f.cooldowns)) {
    if (f.cooldowns[key]! > 0) f.cooldowns[key]!--;
  }
  f.mana = Math.min(f.maxMana, f.mana + Math.round(f.maxMana * 0.08));
}

function applyDamage(
  attacker: FighterState,
  defender: FighterState,
  rawDamage: number,
  log: string[],
  label: string,
): void {
  let dmg = rawDamage + (attacker.statuses.buffDamage > 0 ? 10 : 0);
  const defArmor = defender.armor + (defender.statuses.buffArmor > 0 ? 3 : 0);
  dmg = reduceArmor(dmg, defArmor);

  if (defender.statuses.spellImmune > 0 && label !== "Атака") {
    log.push(`${label}: БКБ поглотил магию!`);
    return;
  }

  defender.hp -= dmg;
  log.push(`${label}: −${dmg} HP`);

  if (attacker.statuses.lifestealBuff > 0 && attacker.statuses.lifestealPercent > 0) {
    const heal = Math.round((dmg * attacker.statuses.lifestealPercent) / 100);
    attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
    if (heal > 0) log.push(`Вампиризм: +${heal} HP`);
  }
}

function applyItemEffect(
  user: FighterState,
  opponent: FighterState,
  itemId: number,
  log: string[],
): void {
  const item = getItemById(itemId);
  if (!item) return;

  const effect = item.battle_effect;
  const name = item.name_ru;
  const target = effect.target ?? "self";
  const subject = target === "enemy" ? opponent : user;

  switch (effect.type) {
    case "heal":
      subject.hp = Math.min(
        subject.maxHp,
        subject.hp + (effect.value ?? 0),
      );
      log.push(`${name}: +${effect.value ?? 0} HP (${user.userId})`);
      break;
    case "mana":
      subject.mana = Math.min(
        subject.maxMana,
        subject.mana + (effect.value ?? 0),
      );
      log.push(`${name}: +${effect.value ?? 0} MP (${user.userId})`);
      break;
    case "damage":
      applyDamage(
        user,
        opponent,
        effect.value ?? user.damage,
        log,
        name,
      );
      break;
    case "armor_buff":
      user.statuses.buffArmor = effect.duration_turns ?? 2;
      log.push(`${name}: +броня (${user.userId})`);
      break;
    case "damage_buff":
      user.statuses.buffDamage = effect.duration_turns ?? 2;
      log.push(`${name}: +урон (${user.userId})`);
      break;
    case "spell_immunity":
      user.statuses.spellImmune = effect.duration_turns ?? 1;
      log.push(`${name}: иммунитет к магии (${user.userId})`);
      break;
    case "lifesteal_buff":
      user.statuses.lifestealBuff = effect.duration_turns ?? 2;
      user.statuses.lifestealPercent = effect.value ?? 30;
      log.push(`${name}: вампиризм (${user.userId})`);
      break;
    default:
      break;
  }
}

function consumeBattleItem(f: FighterState, itemId: number): void {
  const entry = f.battleItems.find((i) => i.itemId === itemId);
  if (!entry) return;
  entry.usesRemaining -= 1;
  if (entry.usesRemaining <= 0) {
    f.battleItems = f.battleItems.filter((i) => i.itemId !== itemId);
  }
}

function executeAction(
  attacker: FighterState,
  defender: FighterState,
  action: BattleAction,
  log: string[],
): void {
  const combat = getCombatHero(attacker.heroId);
  if (!combat) return;

  if (attacker.statuses.stunned > 0) {
    log.push(`${attacker.userId}: стан — пропуск хода`);
    return;
  }

  if (action === "attack" || attacker.statuses.silenced > 0) {
    const dmg = attacker.damage;
    applyDamage(attacker, defender, dmg, log, "Атака");
    attacker.lastAction = "attack";
    return;
  }

  const skill = getSkill(combat, action);
  if (!skill) {
    applyDamage(attacker, defender, attacker.damage, log, "Атака");
    attacker.lastAction = "attack";
    return;
  }

  const cd = attacker.cooldowns[skill.key] ?? 0;
  if (cd > 0 || attacker.mana < skill.mana_cost) {
    applyDamage(attacker, defender, attacker.damage, log, "Атака");
    attacker.lastAction = "attack";
    return;
  }

  attacker.mana -= skill.mana_cost;
  if (skill.cooldown_turns > 0) {
    attacker.cooldowns[skill.key] = skill.cooldown_turns;
  }
  attacker.lastAction = action;

  const eff = skill.effect;
  const name = skill.name_ru;

  switch (eff.type) {
    case "damage":
      applyDamage(attacker, defender, scaleSkillDamage(eff.value), log, name);
      break;
    case "heal":
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + eff.value);
      log.push(`${name}: +${eff.value} HP`);
      break;
    case "stun":
      applyDamage(attacker, defender, scaleSkillDamage(eff.value), log, name);
      defender.statuses.stunned = eff.duration_turns ?? 1;
      log.push(`${name}: стан!`);
      break;
    case "silence":
      defender.statuses.silenced = eff.duration_turns ?? 2;
      log.push(`${name}: сайленс!`);
      break;
    case "dot": {
      const dotDmg = scaleSkillDamage(eff.value);
      applyDamage(attacker, defender, dotDmg, log, name);
      defender.statuses.dot = eff.duration_turns ?? 2;
      defender.statuses.dotDamage = Math.max(1, Math.round(dotDmg / 2));
      break;
    }
    case "buff_armor":
      attacker.statuses.buffArmor = eff.duration_turns ?? 2;
      log.push(`${name}: +броня`);
      break;
    case "buff_damage":
      attacker.statuses.buffDamage = eff.duration_turns ?? 2;
      log.push(`${name}: +урон`);
      break;
    default:
      applyDamage(
        attacker,
        defender,
        scaleSkillDamage(eff.value) || attacker.damage,
        log,
        name,
      );
  }

  if (combat.passive?.type === "counter" && defender.lastAction) {
    if (Math.random() < (combat.passive.chance ?? 0.3)) {
      applyDamage(
        defender,
        attacker,
        scaleSkillDamage(combat.passive.value),
        log,
        "Контр-спираль",
      );
    }
  }
}

function resolveFighterTurn(
  actor: FighterState,
  target: FighterState,
  action: BattleAction,
  log: string[],
): void {
  if (actor.pendingItemId != null) {
    applyItemEffect(actor, target, actor.pendingItemId, log);
    consumeBattleItem(actor, actor.pendingItemId);
  }
  executeAction(actor, target, action, log);
}

const SKILL_KEYS = ["Q", "W", "E", "R"] as const;

/** Случайный предмет (если есть) и скилл/атака для автобоя. */
export function pickRandomTurnChoices(fighter: FighterState): {
  itemId?: number;
  action: BattleAction;
} {
  const usableItems = fighter.battleItems.filter((i) => i.usesRemaining > 0);
  let itemId: number | undefined;
  if (usableItems.length > 0 && Math.random() < 0.55) {
    itemId =
      usableItems[Math.floor(Math.random() * usableItems.length)]!.itemId;
  }

  const combat = getCombatHero(fighter.heroId);
  const actions: BattleAction[] = ["attack"];
  if (combat && fighter.statuses.silenced <= 0) {
    for (const key of SKILL_KEYS) {
      const skill = combat.skills.find((s) => s.key === key);
      if (!skill) continue;
      const cd = fighter.cooldowns[key] ?? 0;
      if (cd <= 0 && fighter.mana >= skill.mana_cost) {
        actions.push(key);
      }
    }
  }

  return {
    itemId,
    action: actions[Math.floor(Math.random() * actions.length)]!,
  };
}

/** Заполняет pending-ходы обоих бойцов перед resolveTurn. */
export function prepareAutoTurn(state: BattleState): void {
  for (const fighter of [state.challenger, state.defender]) {
    const { itemId, action } = pickRandomTurnChoices(fighter);
    fighter.pendingItemId = itemId;
    fighter.pendingAction = action;
  }
}

export function setPendingItem(
  state: BattleState,
  userId: string,
  itemId: number,
): boolean {
  const fighter =
    state.challenger.userId === userId
      ? state.challenger
      : state.defender.userId === userId
        ? state.defender
        : null;
  if (!fighter) return false;
  if (fighter.pendingAction != null) return false;
  if (!fighter.battleItems.some((i) => i.itemId === itemId && i.usesRemaining > 0)) {
    return false;
  }
  fighter.pendingItemId = itemId;
  return true;
}

export function setPendingAction(
  state: BattleState,
  userId: string,
  action: BattleAction,
): boolean {
  if (state.challenger.userId === userId) {
    if (state.challenger.pendingAction != null) return false;
    state.challenger.pendingAction = action;
    return true;
  }
  if (state.defender.userId === userId) {
    if (state.defender.pendingAction != null) return false;
    state.defender.pendingAction = action;
    return true;
  }
  return false;
}

export function bothReady(state: BattleState): boolean {
  return (
    state.challenger.pendingAction != null &&
    state.defender.pendingAction != null
  );
}

export function isFighterReady(f: FighterState): boolean {
  return f.pendingAction != null;
}

export type TurnResult = {
  state: BattleState;
  finished: boolean;
  winnerId?: string;
};

export function resolveTurn(state: BattleState): TurnResult {
  const chAction = state.challenger.pendingAction ?? "attack";
  const defAction = state.defender.pendingAction ?? "attack";

  state.log.push(`——— Раунд ${state.turn} ———`);

  resolveFighterTurn(
    state.challenger,
    state.defender,
    chAction,
    state.log,
  );

  if (state.defender.hp <= 0) {
    state.log.push("Победа атакующего!");
    return {
      state,
      finished: true,
      winnerId: state.challenger.userId,
    };
  }

  resolveFighterTurn(
    state.defender,
    state.challenger,
    defAction,
    state.log,
  );

  if (state.challenger.hp <= 0) {
    state.log.push("Победа защитника!");
    return {
      state,
      finished: true,
      winnerId: state.defender.userId,
    };
  }

  tickStatuses(state.challenger);
  tickStatuses(state.defender);

  state.challenger.pendingAction = undefined;
  state.challenger.pendingItemId = undefined;
  state.defender.pendingAction = undefined;
  state.defender.pendingItemId = undefined;
  state.turn++;

  return { state, finished: false };
}

export function getWinner(state: BattleState): string | undefined {
  if (state.challenger.hp <= 0) return state.defender.userId;
  if (state.defender.hp <= 0) return state.challenger.userId;
  return undefined;
}

export function formatActionLabel(
  heroId: number,
  action: BattleAction,
): string {
  if (action === "attack") return "Атака";
  const combat = getCombatHero(heroId);
  const skill = combat?.skills.find((s) => s.key === action);
  return skill ? `${action} (${skill.name_ru})` : action;
}
