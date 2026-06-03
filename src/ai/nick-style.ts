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
] as const;

export const NICK_SYSTEM = `You generate Russian Dota 2 pub nicknames in the EXACT register of the reference gallery below.

REFERENCE GALLERY — learn the MECHANICS (never copy verbatim):
• «Стив Блоуджобс» — famous name + phonetic parody + vulgar/absurd twist
• «Ранальдинье Трюки» — pseudo-epic fantasy name + random low noun
• «Дрянь Очаровашка» — insult/adjective + cute word corrupted ironically
• «уменяпапашахуесосик» — one glued lowercase toxic phrase, no spaces, stream-of-consciousness
• «Сибирская Гнида» / «Мясная сука» — adjective + harsh insult noun, deadpan
• «Адольф Мухтар» / «Рудольф Чашкин» / «Сальма Подгузникидзе» — celebrity or historical first name + absurd patronymic/surname pun (-идзе, phonetic twist)
• «Крип Пермафид» — Dota creep/lane slang + feed/perma-death pun
• «Сироп с пизды» — gross body-fluid metaphor, blunt and surreal
• «Мусульманого» — one word, offensive/absurd adjective-noun glue

Your output MUST clearly use ONE of these mechanics (same toxicity, same pub-3k cynicism, same wordplay density).

NOT required: literal hero name in nick. NOT wanted: generic «Токсик Мид», «Грифер 322», cute jokes, explanations.

FORBIDDEN: baby talk, animals-as-cute, wholesome memes, soft words (милый, зайка, котик), English, quotes, two nicknames.

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

const GENERIC_NICK_RE =
  /^(токсичн|токсик|грифер|фидер|саппорт|мидер|керри|нооб|про)\b/i;

export function pickNickReference(seed: string): (typeof NICK_REFERENCES)[number] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  return NICK_REFERENCES[Math.abs(h) % NICK_REFERENCES.length]!;
}

export function buildNickUserPrompt(
  nickDate: string,
  seed: string,
  attempt: number,
): string {
  const anchor = pickNickReference(`${seed}:${attempt}`);
  return `Date: ${nickDate}. Seed: ${seed}.

ANCHOR REFERENCE for this generation: «${anchor}»
Step 1 (internal): name the mechanic (parody / glued phrase / creep pun / insult pair / gross metaphor).
Step 2: invent ONE NEW nickname using the SAME mechanic and energy as the anchor and the full gallery — fresh words, same style register.

Do NOT copy the anchor. Do NOT output generic role labels without wordplay.

Russian only. Output ONLY the nickname, nothing else.`;
}

export function buildNickBatchUserPrompt(
  nickDate: string,
  seed: string,
  count: number,
): string {
  const anchors = [
    pickNickReference(`${seed}:0`),
    pickNickReference(`${seed}:1`),
    pickNickReference(`${seed}:2`),
  ];
  return `Date: ${nickDate}. Seed: ${seed}.

Generate exactly ${count} DIFFERENT Russian pub nicknames in ONE response.
Style anchors (mechanics only, do NOT copy text): «${anchors.join("», «")}».

Rules:
- Each nick uses a distinct mechanic from the gallery (parody name, glued phrase, creep pun, insult pair, gross metaphor…).
- All ${count} must be unique strings, same toxicity as references.
- No generic «Токсик Мид» / «Грифер 322».
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
  if (GENERIC_NICK_RE.test(lower)) return null;

  return s;
}
