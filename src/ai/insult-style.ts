/** Референсы стиля — токсичный русский pub-треш, 2–3 этажа мата. */
export const INSULT_REFERENCES = [
  "Какой тупой сын бляди, даже крипа бы угадал",
  "Ебаный рот этого казино — вы вообще Dota ставили?",
  "Пиздец вы дауны, герой плачет от вашего IQ",
  "Охуенные типы — мозг на аутсорсе у саппорта без вардов",
  "Бля, вы настолько тупые, что инвокер на вас только Quas кастует",
  "Сын бляди, мозг у тебя как саппорт без TP на клатче",
  "Пиздец, вы даже хуже фидера — хотя бы он врага видит",
  "Охуенные дауны, герой кричит имя, а вы в афк мыслей",
] as const;

export const INSULT_SYSTEM = `You generate short Russian toxic taunts for a Dota 2 guess-the-hero Telegram bot.
Players failed to guess — the bot roasts the chat.

STYLE (mandatory):
• 1–2 sentences, max 120 characters each line (one line preferred)
• Heavy vulgar Russian mat (2–3 layers): блядь, сука, пиздец, ебаный, охуенный, сын бляди, etc.
• Dota 2 pub slang: фид, крип, мид, саппорт, рошан, 1к ммр, инвокер, варды
• Roast intelligence / inability to guess — NOT racism, NOT real-world violence, NOT slurs against protected groups
• Address «вы» or «ты» — mocking the whole chat or one player
• NO quotes, NO JSON in output for batch — see format below
• Fresh wording — never copy references verbatim

FORBIDDEN: English, cute jokes, wholesome tone, baby talk, explanations, hashtags.`;

export function pickInsultReference(seed: string): (typeof INSULT_REFERENCES)[number] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  return INSULT_REFERENCES[Math.abs(h) % INSULT_REFERENCES.length]!;
}

export function buildInsultBatchPrompt(
  insultDate: string,
  seed: string,
  count: number,
  exclude: string[],
): string {
  const anchor = pickInsultReference(seed);
  const excludeBlock =
    exclude.length > 0
      ? `\nDo NOT repeat or closely paraphrase:\n${exclude.slice(-40).map((e) => `• ${e}`).join("\n")}`
      : "";

  return `Date: ${insultDate}. Seed: ${seed}. Generate exactly ${count} NEW taunts.

ANCHOR (same energy, NEW words): «${anchor}»
${excludeBlock}

Output ONLY valid JSON array of ${count} strings, no markdown:
["taunt1", "taunt2", ...]`;
}

const MIN_INSULT_LEN = 18;
const MAX_INSULT_LEN = 200;

export function sanitizeInsult(raw: string): string | null {
  let t = raw.trim().replace(/^["'`]+|["'`]+$/g, "");
  if (t.length < MIN_INSULT_LEN || t.length > MAX_INSULT_LEN) return null;
  if (/[a-zA-Z]{4,}/.test(t)) return null;
  if (!/[а-яё]/i.test(t)) return null;
  return t;
}

export function parseInsultBatchJson(raw: string): string[] {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");
  if (start === -1 || end <= start) return [];
  try {
    const arr = JSON.parse(trimmed.slice(start, end + 1)) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x): x is string => typeof x === "string")
      .map(sanitizeInsult)
      .filter((x): x is string => x !== null);
  } catch {
    return [];
  }
}

export function filterValidInsultBatch(
  parsed: string[],
  count: number,
  exclude: Set<string>,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of parsed) {
    const key = line.toLowerCase();
    if (exclude.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(line);
    if (out.length >= count) break;
  }
  return out;
}
