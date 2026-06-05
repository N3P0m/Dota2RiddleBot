/** Эталон стиля (Dazzle) — в systemInstruction, не копировать дословно. */
export const STYLE_STACCATO_RU = `Мясо падает. Кости ломаются. Моя кровь течет. Твоя броня тверда. Заклинания — духи огня. Они слабые враги. Они сильные друзья. Спит, пока еда не найдена. Спириты смотрят. Мы живем.`;

export const STYLE_ELEVATED_RU = `Рождённый, дабы поддерживать своих спутников, он не дозволяет соратникам угаснуть, пока те гасят врагов. Как в старом сказании о луне, что не покидает тьму, его необычные заклинания вплетаются в броню, и вот, противники ослабевают, а союзники крепнут. Ибо, когда меч возвышается, и щит должен стоять.`;

export const SYSTEM_INSTRUCTION = `You write Dota 2 hero riddles for a Russian Telegram quiz.

GOLD STANDARD (Dazzle — match TONE and STRUCTURE, never copy sentences):

[STACCATO]
${STYLE_STACCATO_RU}

[ELEVATED]
${STYLE_ELEVATED_RU}

Output rules:
- Field "riddle": RUSSIAN ONLY.
- Sound like in-game lore / voice lines — NOT a school riddle, NOT "guess who", NOT "я герой", NOT listing roles like "керри/саппорт".
- Each riddle must be UNIQUE: fresh metaphors, concrete ability imagery for the requested hero.
- Never include the hero's name (RU/EN) or obvious letter-play on it.
- No markdown, no questions to the player ("кто я?", "угадай").`;

export type RiddleFormat = "staccato" | "elevated";

export function pickRiddleFormat(): RiddleFormat {
  return Math.random() < 0.5 ? "staccato" : "elevated";
}

const BANNED_SUBSTRINGS = [
  "угадай",
  "угадайте",
  "какой герой",
  "кто я",
  "кто он",
  "назовите",
  "назови героя",
  "это герой",
  "я герой",
  "на линии",
  "пабличк",
  "поле боя",
  "викторин",
  "отгадай",
];

export function isWeakRiddle(riddle: string, heroNameRu: string, heroNameEn: string): boolean {
  const lower = riddle.toLowerCase().replace(/ё/g, "е");
  if (riddle.length < 80) return true;
  if (riddle.includes("?")) return true;

  for (const ban of BANNED_SUBSTRINGS) {
    if (lower.includes(ban)) return true;
  }

  return containsHeroName(lower, heroNameRu, heroNameEn);
}

const HINT_BANNED = [
  "угадай",
  "угадайте",
  "кто я",
  "назовите героя",
  "назови героя",
];

/** Маркеры литературного/лорного стиля — для текстовых подсказок нежелательны. */
const HINT_LITERARY_MARKERS = [
  "дабы",
  "ибо",
  "рождён",
  "рожден",
  "узрев",
  "паче чаяния",
  "соратник",
  "угаснуть",
  "возвышается",
];

export function sanitizeHintText(raw: string): string {
  return raw
    .trim()
    .replace(/^подсказка\s*:\s*/i, "")
    .trim();
}

/** Подсказка короче загадки — отдельные правила (не режем «поле боя» и длину 80). */
export function isWeakHint(hint: string, heroNameRu: string, heroNameEn: string): boolean {
  const text = sanitizeHintText(hint);
  const lower = text.toLowerCase().replace(/ё/g, "е");
  if (text.length < 20) return true;
  if (text.includes("?")) return true;

  for (const ban of HINT_BANNED) {
    if (lower.includes(ban)) return true;
  }

  // Шаблон fallback («стихия — универсал»)
  if (lower.includes("стихия —") && lower.includes("на поле он чаще")) {
    return true;
  }

  for (const marker of HINT_LITERARY_MARKERS) {
    if (lower.includes(marker)) return true;
  }

  if (isExplicitMechanicsHint(text)) return true;

  return containsHeroName(lower, heroNameRu, heroNameEn);
}

/** Подсказка не должна называть скилл и не должна содержать цифры (патч-значения). */
export function isExplicitMechanicsHint(
  hint: string,
  skillNameRu?: string,
): boolean {
  const text = sanitizeHintText(hint);
  if (/\d/.test(text)) return true;

  if (skillNameRu) {
    const skill = skillNameRu.toLowerCase().replace(/ё/g, "е").trim();
    if (skill.length >= 4) {
      const lower = text.toLowerCase().replace(/ё/g, "е");
      if (lower.includes(skill)) return true;
    }
  }

  return false;
}

function containsHeroName(
  lower: string,
  heroNameRu: string,
  heroNameEn: string,
): boolean {
  const ru = heroNameRu.toLowerCase().replace(/ё/g, "е");
  const en = heroNameEn.toLowerCase().replace(/[^a-z]/g, "");
  if (ru.length >= 4 && lower.includes(ru)) return true;
  if (en.length >= 4 && lower.replace(/[^a-zа-я]/g, "").includes(en)) return true;
  return false;
}
