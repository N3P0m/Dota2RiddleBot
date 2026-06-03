import { GoogleGenerativeAI, type GenerationConfig } from "@google/generative-ai";
import type { Hero } from "../heroes/match.js";
import {
  SYSTEM_INSTRUCTION,
  isWeakHint,
  isWeakRiddle,
  pickRiddleFormat,
  sanitizeHintText,
  type RiddleFormat,
} from "./riddle-style.js";
import { logGeminiRequest, logGeminiResponse } from "./request-log.js";

export type RiddlePack = {
  riddle: string;
  possibleAnswers: string[];
};

const RIDDLE_GEN_CONFIG: GenerationConfig = {
  responseMimeType: "application/json",
  temperature: 1.05,
  topP: 0.92,
  topK: 40,
};

const HINT_GEN_CONFIG: GenerationConfig = {
  temperature: 0.85,
  topP: 0.9,
};

const NICK_GEN_CONFIG: GenerationConfig = {
  temperature: 1.15,
  topP: 0.95,
  topK: 50,
};

const NICK_SYSTEM = `You invent harsh, cynical Russian Dota 2 pub nicknames — like real 3k toxic smurfs, not cute jokes.

Tone: adult, biting, rude wordplay, hero/ability puns, feed/blame/mid ego, dark pub humor. NO baby talk, NO "funny animals", NO wholesome memes, NO soft adjectives (милый, пушистик, зайка, котик).

Style reference (do NOT copy verbatim): Стив Блоуджобс, Ранальдинье Трюки, Дрянь Очаровашка, уменяпапашахуесосик, Сибирская Гнида, Адольф Мухтар, Крип Пермафид, Сироп с пизды, Мясная сука, Мусульманого, Рудольф Чашкин.

Output: ONE nickname, Russian, 1-3 words, no quotes, no explanation.`;

export class GeminiClient {
  private genAI: GoogleGenerativeAI;
  private modelName: string;
  private logRequests: boolean;

  constructor(apiKey: string, modelName: string, logRequests = true) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.modelName = modelName;
    this.logRequests = logRequests;
  }

  private getModel(genConfig?: GenerationConfig, systemInstruction = SYSTEM_INSTRUCTION) {
    return this.genAI.getGenerativeModel({
      model: this.modelName,
      systemInstruction,
      ...(genConfig ? { generationConfig: genConfig } : {}),
    });
  }

  async generateRiddlePack(hero: Hero): Promise<RiddlePack> {
    const format = pickRiddleFormat();
    const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    for (let attempt = 0; attempt < 3; attempt++) {
      const pack = await this.requestRiddle(hero, format, nonce, attempt);
      if (
        pack &&
        !isWeakRiddle(pack.riddle, hero.name_ru, hero.name_en)
      ) {
        return pack;
      }
      console.warn(
        `Riddle quality retry ${attempt + 1}/3 for ${hero.name_en}`,
      );
    }

    return {
      riddle: this.fallbackRiddle(hero, format),
      possibleAnswers: [],
    };
  }

  private buildRiddlePrompt(
    hero: Hero,
    format: RiddleFormat,
    nonce: string,
    attempt: number,
  ): string {
    const formatGuide =
      format === "staccato"
        ? `Use STACCATO format: many short sentences (3–8 words), rhythm like battle litany. Periods. Dramatic fragments.`
        : `Use ELEVATED format: flowing literary Russian, archaic flavor ("дабы", "ибо"), one dense paragraph.`;

    const retryNote =
      attempt > 0
        ? "Previous attempt was too generic. Be bolder and more specific to THIS hero's iconic spells."
        : "";

    return `Create ONE original riddle. Request id: ${nonce}. Attempt: ${attempt}.

Hero: ${hero.name_en} (RU: ${hero.name_ru}). Roles: ${hero.roles.join(", ")}.
${formatGuide}
${retryNote}

Content:
- Weave 2–4 recognizable hints: signature abilities, items, lore, voice-line mood — for THIS hero only.
- Do NOT reuse imagery from the Dazzle examples (no meat/bones/spirits/moon/armor weave unless hero is Dazzle).
- 5–9 sentences in "riddle", Russian only.
- In JSON, separate sentences with literal \\n\\n (blank line between each sentence) for readability.

JSON only:
{"riddle":"...","possibleAnswers":["ru","en","slang","typo variants, 6-12 items"]}`;
  }

  private async requestRiddle(
    hero: Hero,
    format: RiddleFormat,
    nonce: string,
    attempt: number,
  ): Promise<RiddlePack | null> {
    const prompt = this.buildRiddlePrompt(hero, format, nonce, attempt);
    if (this.logRequests) {
      logGeminiRequest("riddle", this.modelName, prompt, {
        hero: hero.name_en,
        format,
        attempt: attempt + 1,
        systemInstruction: "(see riddle-style.ts SYSTEM_INSTRUCTION)",
        config: RIDDLE_GEN_CONFIG,
      });
    }

    const started = Date.now();
    try {
      const result = await this.getModel(RIDDLE_GEN_CONFIG).generateContent(
        prompt,
      );
      const raw = result.response.text();
      const parsed = this.parseJsonResponse(raw);
      if (this.logRequests) {
        logGeminiResponse("riddle", raw, Date.now() - started, parsed ?? undefined);
      }
      if (parsed?.riddle && parsed.riddle.length >= 50) {
        return {
          riddle: parsed.riddle.replace(/\\n/g, "\n"),
          possibleAnswers: parsed.possibleAnswers ?? [],
        };
      }
    } catch (err) {
      console.error(`[Gemini ←] riddle ERROR ${Date.now() - started}ms`, err);
    }
    return null;
  }

  async generateHint(
    hero: Hero,
    riddle: string,
    hintNumber: number,
  ): Promise<string> {
    const levelRules = hintLevelRules(hintNumber);
    const prompt = `Hint for active round. RUSSIAN ONLY, 1–2 sentences.

This is hint #${hintNumber} in this round. It MUST be noticeably more revealing than any previous hint in the same round (players already saw ${hintNumber - 1} weaker hint(s)).

Riddle already shown:
"""${riddle}"""

Hero: ${hero.name_en} / ${hero.name_ru}. Roles: ${hero.roles.join(", ")}. Primary attribute: ${hero.primary_attr}.

${levelRules}

Rules: same lore tone; NO hero name; NOT a quiz question. Do NOT start with "Подсказка:". Plain text, no markdown. Use \\n\\n between sentences if more than one.`;

    if (this.logRequests) {
      logGeminiRequest("hint", this.modelName, prompt, {
        hero: hero.name_en,
        config: HINT_GEN_CONFIG,
      });
    }

    const started = Date.now();
    try {
      const result = await this.getModel(HINT_GEN_CONFIG).generateContent(
        prompt,
      );
      const raw = result.response.text();
      const text = sanitizeHintText(raw?.trim().replace(/\\n/g, "\n") ?? "");
      if (this.logRequests) {
        logGeminiResponse("hint", raw, Date.now() - started, text ? { text } : undefined);
      }
      if (text && !isWeakHint(text, hero.name_ru, hero.name_en)) {
        return text;
      }
      console.warn(
        `[Gemini] hint rejected for ${hero.name_en}, using fallback (len=${text.length})`,
      );
    } catch (err) {
      console.error(`[Gemini ←] hint ERROR ${Date.now() - started}ms`, err);
    }

    return this.fallbackHint(hero, hintNumber);
  }

  async generateDailyNick(nickDate: string, seed: string): Promise<string | null> {
    const prompt = `Invent ONE harsh pub nickname for ${nickDate}. Seed: ${seed}.
Must feel toxic/cynical, not childish. Bold pun or insult + Dota hero/role reference. Russian only. Unique today.`;

    if (this.logRequests) {
      logGeminiRequest("nick", this.modelName, prompt, { nickDate, seed });
    }

    const started = Date.now();
    try {
      const result = await this.getModel(NICK_GEN_CONFIG, NICK_SYSTEM).generateContent(
        prompt,
      );
      const raw = result.response.text()?.trim() ?? "";
      const nick = sanitizeDailyNick(raw);
      if (this.logRequests) {
        logGeminiResponse("nick", raw, Date.now() - started, nick ? { nick } : undefined);
      }
      if (nick) return nick;
      console.warn(`[Gemini] nick rejected: "${raw.slice(0, 80)}"`);
    } catch (err) {
      console.error(`[Gemini ←] nick ERROR ${Date.now() - started}ms`, err);
    }
    return null;
  }

  private parseJsonResponse(raw: string | undefined): {
    riddle: string;
    possibleAnswers: string[];
  } | null {
    if (!raw) return null;
    try {
      const data = JSON.parse(raw) as {
        riddle?: string;
        possibleAnswers?: string[];
      };
      if (!data.riddle) return null;
      return {
        riddle: data.riddle.trim().replace(/\\n/g, "\n"),
        possibleAnswers: Array.isArray(data.possibleAnswers)
          ? data.possibleAnswers.map((s) => String(s).trim()).filter(Boolean)
          : [],
      };
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) return null;
      try {
        const data = JSON.parse(match[0]) as {
          riddle?: string;
          possibleAnswers?: string[];
        };
        return data.riddle
          ? {
              riddle: data.riddle.trim().replace(/\\n/g, "\n"),
              possibleAnswers: data.possibleAnswers ?? [],
            }
          : null;
      } catch {
        return null;
      }
    }
  }

  private fallbackRiddle(hero: Hero, format: RiddleFormat): string {
    if (format === "staccato") {
      return [
        "Крики на дороге.",
        "Пыль на клинке.",
        "Враг вспоминает его удары.",
        "Союзник — тень у плеча.",
        "Заклинание звенит.",
        "Тишина.",
        "Снова удар.",
      ].join("\n\n");
    }
    return [
      "Рождённый для битвы, он идёт туда, где страшнее всего.",
      "Там, где другие пасуют, остаётся он — и на земле лишь след способностей и шёпот тех, кто узнал его по одному движению руки.",
    ].join("\n\n");
  }

  private fallbackHint(hero: Hero, hintNumber: number): string {
    const attr =
      hero.primary_attr === "str"
        ? "сила"
        : hero.primary_attr === "agi"
          ? "ловкость"
          : hero.primary_attr === "int"
            ? "интеллект"
            : "универсал";
    const roles = hero.roles.slice(0, 2).join(" и ");

    if (hintNumber <= 1) {
      return `На линии его чаще видят как ${roles}; стихия — ${attr}, без явных имён способностей.`;
    }
    if (hintNumber === 2) {
      return `Стихия — ${attr}, роли: ${roles}. Вспомни фирменный скилл или предмет, с которым его узнают в пабе.`;
    }
    return `Почти ответ: ${attr}, ${roles} — назови вслух фирменный скилл, ульт или предмет, без имени героя в тексте; догадаться уже должно быть легко.`;
  }
}

function hintLevelRules(hintNumber: number): string {
  if (hintNumber <= 1) {
    return `Level 1 (MILD): atmosphere + vague role/lane only; NO signature ability names; weakest clue.`;
  }
  if (hintNumber === 2) {
    return `Level 2 (STRONGER than hint #1): one signature skill OR iconic item OR lane matchup; still NO hero name.`;
  }
  if (hintNumber === 3) {
    return `Level 3 (STRONGER than hints #1–#2): two concrete mechanics, voice-line mood, or item combo players instantly associate with this hero.`;
  }
  return `Level ${hintNumber} (MAX — stronger than ALL prior hints): near-reveal — spell/item/ult combo + attribute + role; prepared players guess instantly; still NO hero name in text.`;
}

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

function sanitizeDailyNick(raw: string): string | null {
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
  if (words.length < 2 || words.length > 5) return null;

  const lower = s.toLowerCase().replace(/ё/g, "е");
  for (const soft of SOFT_NICK_WORDS) {
    if (lower.includes(soft)) return null;
  }
  return s;
}
