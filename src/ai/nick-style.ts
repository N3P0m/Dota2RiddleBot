/** Референсы — эталон стиля, не для копирования. */
export const NICK_REFERENCES = [
  "Стив Блоуджобс",
  "Ранальдинье Трюки",
  "Дрянь Очаровашка",
  "уменяпапашахуесосик",
  "Сибирская Гнида",
  "Адольф Мухтар",
  "Крип Пермафид",
  "Сироп с пизды",
  "Мясная сука",
  "Мусульманого",
  "Рудольф Чашкин",
  "Сальма Подгузникидзе",
  "Воблер Спермолов",
  "Наполеон Табуреткин",
  "Брюс Ссалкин",
  "Проклятый Дуршлаг",
  "Саппорт Энурез",
  "Кефирный Ублюдок",
  "Копчёный Позор",
  "Инспектор Соплежуй",
  "Заместитель Пермафида",
  "уменявлесукрипыорут",
  "мамаявсмокепотерялся",
  "никтонеденайткатапульту",
  "Спермов",
  "Соплякин",
  "Зассанский",
  "Подливкин",
  "Шпротолов",
  "Калович",
  "Пельмендзе",
] as const;

export const NICK_MECHANICS = [
  {
    weight: 40,
    label: "absurd surname",
    instruction:
      "Fake surname on -ов/-ин/-кин/-евич/-олов/-ский/-дзе from vulgar, bodily or mundane root (Спермов, Соплякин, Пельмендзе…). Pair with ordinary first name, famous person, or household object.",
  },
  {
    weight: 20,
    label: "adjective + object/insult",
    instruction:
      "Noble/epic adjective + maximally mundane object (Великий Шампур), OR food + aggression/disgust (Кефирный Ублюдок), OR bureaucratic title + absurd degradation (Инспектор Соплежуй).",
  },
  {
    weight: 15,
    label: "dota slang mutation",
    instruction:
      "Dota/pub slang + medical/household term with wordplay (Саппорт Энурез, Ластхит Амнезия). NOT bare role labels.",
  },
  {
    weight: 15,
    label: "glued lowercase rant",
    instruction:
      "One glued lowercase schizophrenic phrase, no spaces, stream-of-consciousness, ≥10 chars (уменявлесукрипыорут, мамаявсмокепотерялся).",
  },
  {
    weight: 10,
    label: "surreal construction",
    instruction:
      "Completely surreal combo: famous person + shameful household object (Наполеон Табуреткин), gross metaphor, or one-word absurd glue (Мусульманого).",
  },
] as const;

export const NICK_SYSTEM = `You generate Russian Dota 2 pub nicknames in the EXACT register of the reference gallery below.

REFERENCE GALLERY — learn the MECHANICS (never copy verbatim):
• Famous person + бытовой/позорный объект: «Наполеон Табуреткин», «Брюс Ссалкин»
• Noble/epic adjective + приземлённый предмет: «Великий Шампур», «Проклятый Дуршлаг»
• Dota/pub slang + медицинский/бытовой термин: «Саппорт Энурез», «Ластхит Амнезия»
• Food + aggression/disgust: «Кефирный Ублюдок», «Копчёный Позор»
• Bureaucratic/job title + absurd degradation: «Инспектор Соплежуй», «Заместитель Пермафида»
• One glued lowercase schizophrenic rant: «уменявлесукрипыорут», «мамаявсмокепотерялся», «никтонеденайткатапульту»
• Fake surnames from vulgar/bodily/mundane roots: -ов, -ин, -кин, -евич, -олов, -ский, -дзе (Спермов, Соплякин, Зассанский, Подливкин, Шпротолов, Калович, Пельмендзе)
• Classic gallery: «Стив Блоуджобс», «Ранальдинье Трюки», «Дрянь Очаровашка», «уменяпапашахуесосик», «Крип Пермафид», «Сироп с пизды», «Воблер Спермолов»

STYLE RULES:
• Sound like a nickname invented at 3 AM after a 7-game losing streak.
• Prefer absurdity over direct insults. Wordplay > pure obscenity.
• Nick should feel accidental yet memorable. Mild grammatical corruption is desirable.
• Occasionally use Soviet, village, school, military or bureaucratic vocabulary.
• Surreal combinations encouraged. Sounds cursed, pathetic, accidentally legendary — like a real pub player.
• Avoid obvious internet meme templates and generic esports nicknames.
• Avoid repeating Dota terms too often — when used, MUST have wordplay twist.

BAD (never output): «Токсик Мидер», «Грифер228», «Лучший Керри», «Король Доты», «Нагибатор», cute jokes, baby talk, wholesome memes, English, quotes, two nicknames.

NOT required: literal hero name in nick.

FORBIDDEN: soft words (милый, зайка, котик), animals-as-cute, protected-group slurs, real-world violence threats.

Output: ONLY the nickname. Russian. Either 2–4 words OR one glued word ≥10 characters.`;

const SOFT_NICK_WORDS = [
  "милый",
  "милая",
  "зайка",
  "котик",
  "пушистик",
  "солнышко",
  "няш",
  "люблю",
  "дружб",
  "весёл",
  "весел",
  "смешн",
  "прикольн",
  "кавай",
  "чудес",
  "волшеб",
];

/** Generic esports / meme nick patterns and their stems — reject in post-filter. */
const BANNED_NICK_SUBSTRINGS = [
  // negative examples + stems
  "нагибатор",
  "нагибат",
  "нагибщик",
  "нагиб",
  "король дот",
  "королев дот",
  "корольдот",
  "лучший кер",
  "лучший мид",
  "лучший сап",
  "лучший игр",
  "лучший в ми",
  "легенда дот",
  "легендадот",
  "герой дот",
  "геройдот",
  "бог дот",
  "богдот",
  "токсик мид",
  "токсикмид",
  "токсик кер",
  "токсиккер",
  "токсик сап",
  "токсиксап",
  "токсик",
  "токсичн",
  "токсич",
  "грифер",
  "гриффер",
  "гриф",
  "фидер3",
  "фидер2",
  "ноуб",
  "нууб",
  "noob",
  "pro gamer",
  "progamer",
  "pro player",
  "про игр",
  "проигр",
  "гной",
  // meme numbers / templates
  "322",
  "228",
  "1337",
  "leets",
  "xboct",
  "noobmaster",
  "нуубмаст",
  "dota king",
  "dotaking",
  "dota2god",
  "dota god",
  "carry god",
  "mid god",
  "support god",
  "king of dota",
  "lord of dota",
  "god of dota",
  // generic esports / rank brag
  "имба",
  "имбов",
  "immortal",
  "divine",
  "ancient5",
  "ancient7",
  "global elite",
  "grandmaster",
  "challenger",
  "esports",
  "cybersport",
  "киберспорт",
  "mmr",
  "ммр",
  "smurf",
  "смурф",
  "буст",
  "boost",
  "читер",
  "cheat",
  "vac ban",
  "vacban",
  // internet meme templates
  "sigma",
  "sigm",
  "skibidi",
  "скибид",
  "rizz",
  "based",
  "cringe",
  "кринж",
  "chad",
  "pepega",
  "kekw",
  "kappa",
  "pogchamp",
  "monkas",
  "бazinga",
  "мемас",
  "tiktok",
  "тикток",
  "among us",
  "pubg",
  "fortnite",
  "minecraft",
];

const BRAG_ROLE_NICK_RE =
  /^(лучший|король|легенда|бог)\s+(кер|мид|сап|игр|дот)/i;

const GENERIC_COMBO_NICK_RE =
  /^(токсик|токсичн|грифер|гриффер|фидер)\s*(мид|кер|сап|лес|офф|322|228)?/i;

const ENGLISH_WORD_RE = /[a-zA-Z]{4,}/;

function isGenericEsportsNick(lower: string): boolean {
  if (BRAG_ROLE_NICK_RE.test(lower)) return true;
  if (GENERIC_COMBO_NICK_RE.test(lower)) return true;
  if (/^(нагибатор|имба|легенда|нооб|про|smurf|смурф)\b/i.test(lower)) return true;
  return false;
}

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function pickNickReference(seed: string): (typeof NICK_REFERENCES)[number] {
  return NICK_REFERENCES[hashSeed(seed) % NICK_REFERENCES.length]!;
}

export function pickNickMechanic(seed: string): (typeof NICK_MECHANICS)[number] {
  const total = NICK_MECHANICS.reduce((sum, m) => sum + m.weight, 0);
  let roll = hashSeed(`${seed}:mechanic`) % total;
  for (const mechanic of NICK_MECHANICS) {
    roll -= mechanic.weight;
    if (roll < 0) return mechanic;
  }
  return NICK_MECHANICS[0]!;
}

function pickMechanicsForBatch(seed: string, count: number): (typeof NICK_MECHANICS)[number][] {
  return Array.from({ length: count }, (_, i) =>
    pickNickMechanic(`${seed}:batch:${i}`),
  );
}

export function containsBannedNickContent(text: string): boolean {
  const lower = text.toLowerCase().replace(/ё/g, "e");
  for (const ban of BANNED_NICK_SUBSTRINGS) {
    if (lower.includes(ban.replace(/ё/g, "e"))) return true;
  }
  if (isGenericEsportsNick(lower)) return true;
  if (ENGLISH_WORD_RE.test(text)) return true;
  return false;
}

export function buildNickUserPrompt(
  nickDate: string,
  seed: string,
  attempt: number,
): string {
  const anchor = pickNickReference(`${seed}:${attempt}`);
  const mechanic = pickNickMechanic(`${seed}:${attempt}`);
  return `Date: ${nickDate}. Seed: ${seed}.

TARGET MECHANIC (${mechanic.weight}% bucket): ${mechanic.instruction}
ANCHOR REFERENCE for energy (do NOT copy): «${anchor}»

Step 1 (internal): confirm mechanic fits the distribution bucket.
Step 2: invent ONE NEW nickname — fresh words, same cursed pub-3k register as the gallery.

Do NOT copy the anchor. Do NOT output generic role labels without wordplay.

Russian only. Output ONLY the nickname, nothing else.`;
}

export function buildNickBatchUserPrompt(
  nickDate: string,
  seed: string,
  count: number,
): string {
  const mechanics = pickMechanicsForBatch(seed, count);
  const mechanicLines = mechanics
    .map((m, i) => `${i + 1}. [${m.label}] ${m.instruction}`)
    .join("\n");
  const anchors = [
    pickNickReference(`${seed}:0`),
    pickNickReference(`${seed}:1`),
    pickNickReference(`${seed}:2`),
  ];
  return `Date: ${nickDate}. Seed: ${seed}.

Generate exactly ${count} DIFFERENT Russian pub nicknames in ONE response.
Each nick MUST follow its assigned mechanic (distribution: 40% absurd surname, 20% adjective+object, 15% dota mutation, 15% glued phrase, 10% surreal):

${mechanicLines}

Style anchors (mechanics only, do NOT copy text): «${anchors.join("», «")}».

Rules:
- All ${count} must be unique strings, same cursed energy as references.
- Prefer absurdity and wordplay over direct insults.
- No generic «Токсик Мид» / «Грифер 322» / «Нагибатор» / «Король Доты».
- Russian only.

Return JSON only: { "nicknames": ["ник1", "ник2", ...] } with exactly ${count} items.`;
}

export function parseNickBatchJson(raw: string | undefined): string[] {
  if (!raw) return [];
  const tryParse = (text: string): string[] => {
    const data = JSON.parse(text) as { nicknames?: unknown };
    if (!Array.isArray(data.nicknames)) return [];
    return data.nicknames
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter(Boolean);
  };
  try {
    return tryParse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return [];
    try {
      return tryParse(match[0]);
    } catch {
      return [];
    }
  }
}

export function filterValidNickBatch(
  rawList: string[],
  maxCount: number,
  exclude: Set<string> = new Set(),
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of rawList) {
    const nick = sanitizeDailyNick(item);
    if (!nick) continue;
    const key = nick.toLowerCase();
    if (seen.has(key) || exclude.has(key)) continue;
    seen.add(key);
    out.push(nick);
    if (out.length >= maxCount) break;
  }
  return out;
}

export function sanitizeDailyNick(raw: string): string | null {
  let s = raw
    .trim()
    .replace(/^["'`«]|["'`»]$/g, "")
    .replace(/^ник\s*:\s*/i, "")
    .replace(/^nickname\s*:\s*/i, "")
    .split("\n")[0]!
    .trim();

  if (s.length < 4 || s.length > 64) return null;
  if (/[?!]/.test(s)) return null;

  const words = s.split(/\s+/).filter(Boolean);
  if (words.length > 4) return null;
  if (words.length === 1) {
    if (s.length < 10) return null;
  } else if (words.length < 2) {
    return null;
  }

  const lower = s.toLowerCase().replace(/ё/g, "е");
  for (const soft of SOFT_NICK_WORDS) {
    if (lower.includes(soft)) return null;
  }
  if (containsBannedNickContent(s)) return null;

  const refSet = new Set(NICK_REFERENCES.map((r) => r.toLowerCase().replace(/ё/g, "е")));
  if (refSet.has(lower)) return null;

  return s;
}
