import { GoogleGenerativeAI, type GenerationConfig } from "@google/generative-ai";
import type { Hero } from "../heroes/match.js";
import {
  SYSTEM_INSTRUCTION,
  isExplicitMechanicsHint,
  isWeakHint,
  isWeakRiddle,
  pickRiddleFormat,
  sanitizeHintText,
  type RiddleFormat,
} from "./riddle-style.js";
import {
  NICK_SYSTEM,
  buildNickBatchUserPrompt,
  buildNickUserPrompt,
  filterValidNickBatch,
  parseNickBatchJson,
  sanitizeDailyNick,
} from "./nick-style.js";
import type { EmoSkillEntry } from "../game/emo-skills.js";
import { logGeminiRequest, logGeminiResponse } from "./request-log.js";

export type RiddlePack = {
  riddle: string;
  possibleAnswers: string[];
};

export type EmoRiddlePack = {
  emojis: string;
  skills: EmoSkillEntry[];
  possibleAnswers: string[];
};

const EMO_SYSTEM = `You are a Dota 2 quiz bot. Create emoji riddles: one emoji per hero ability.
Use official Russian ability names from Dota 2 where possible.
Return strict JSON only. No markdown.`;

const EMO_GEN_CONFIG: GenerationConfig = {
  responseMimeType: "application/json",
  temperature: 0.95,
  topP: 0.9,
  topK: 40,
};

const RIDDLE_GEN_CONFIG: GenerationConfig = {
  responseMimeType: "application/json",
  temperature: 1.05,
  topP: 0.92,
  topK: 40,
};

const HINT_SYSTEM = `You write casual Russian hints for a Dota 2 hero quiz.
NOT poetry, NOT lore voice lines, NOT riddles.
Each hint describes ONE ability's GAMEPLAY EFFECT in plain Russian — станит, замедляет, притягивает, снимает баффы, лечит союзников, телепортирует, и т.д.
Do NOT name the ability in hint text. Do NOT name the hero. Do NOT use numbers (no seconds, damage, %, cooldowns — patches change values).
skill_key is for server-side dedup only; the player never sees it.
Return strict JSON only.`;

const HINT_SKILL_KEYS = new Set([
  "Q",
  "W",
  "E",
  "R",
  "ULT",
  "TALENT",
  "PASSIVE",
]);

const HINT_GEN_CONFIG: GenerationConfig = {
  responseMimeType: "application/json",
  temperature: 0.75,
  topP: 0.9,
};

export type HintPack = {
  hint: string;
  /** Q / W / E / R / ULT — для программного учёта, игрок не видит */
  skillKey: string;
};

const NICK_GEN_CONFIG: GenerationConfig = {
  temperature: 1.05,
  topP: 0.92,
  topK: 40,
};

const NICK_BATCH_GEN_CONFIG: GenerationConfig = {
  responseMimeType: "application/json",
  temperature: 1.1,
  topP: 0.92,
  topK: 40,
};

const NICK_MAX_ATTEMPTS = 2;

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

  async generateEmoRiddlePack(hero: Hero): Promise<EmoRiddlePack> {
    const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    for (let attempt = 0; attempt < 3; attempt++) {
      const pack = await this.requestEmoRiddle(hero, nonce, attempt);
      if (pack && pack.skills.length >= 3) {
        return pack;
      }
      console.warn(
        `Emo riddle quality retry ${attempt + 1}/3 for ${hero.name_en}`,
      );
    }

    return this.fallbackEmoRiddle(hero);
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

  private buildEmoRiddlePrompt(
    hero: Hero,
    nonce: string,
    attempt: number,
  ): string {
    const retryNote =
      attempt > 0
        ? "Previous attempt was weak. Pick more iconic, visually distinct abilities and clearer emojis."
        : "";

    return `Create an emoji riddle for ONE hero. Request id: ${nonce}. Attempt: ${attempt}.

Hero: ${hero.name_en} (RU: ${hero.name_ru}). Roles: ${hero.roles.join(", ")}.
${retryNote}

Rules:
- Pick exactly 4 most iconic abilities (prefer Q, W, E, R order).
- ONE emoji per ability — emoji must suggest the skill effect, NOT the hero's face or name.
- name_ru = official Russian ability name from Dota 2.
- emojis field = skills[].emoji joined with single spaces, same order as skills array.
- possibleAnswers: 6-12 guess variants (RU, EN, slang, typos) — do NOT include ability names.

JSON only:
{"emojis":"🪝 🍖 ⚡ 💀","skills":[{"emoji":"🪝","name_ru":"Мясной крюк","name_en":"Meat Hook"}],"possibleAnswers":["..."]}`;
  }

  private async requestEmoRiddle(
    hero: Hero,
    nonce: string,
    attempt: number,
  ): Promise<EmoRiddlePack | null> {
    const prompt = this.buildEmoRiddlePrompt(hero, nonce, attempt);
    if (this.logRequests) {
      logGeminiRequest("emo_riddle", this.modelName, prompt, {
        hero: hero.name_en,
        attempt: attempt + 1,
        systemInstruction: EMO_SYSTEM,
        config: EMO_GEN_CONFIG,
      });
    }

    const started = Date.now();
    try {
      const result = await this.getModel(EMO_GEN_CONFIG, EMO_SYSTEM).generateContent(
        prompt,
      );
      const raw = result.response.text();
      const parsed = this.parseEmoJsonResponse(raw);
      if (this.logRequests) {
        logGeminiResponse("emo_riddle", raw, Date.now() - started, parsed ?? undefined);
      }
      if (parsed && parsed.skills.length >= 3) {
        return parsed;
      }
    } catch (err) {
      console.error(`[Gemini ←] emo_riddle ERROR ${Date.now() - started}ms`, err);
    }
    return null;
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
    previouslyHinted: string[] = [],
  ): Promise<HintPack> {
    const alreadyHinted =
      previouslyHinted.length > 0
        ? previouslyHinted.join(", ")
        : "none yet";

    for (let attempt = 0; attempt < 3; attempt++) {
      const pack = await this.requestHint(
        hero,
        riddle,
        hintNumber,
        alreadyHinted,
        previouslyHinted,
        attempt,
      );
      if (pack) return pack;
      console.warn(
        `Hint quality retry ${attempt + 1}/3 for ${hero.name_en}`,
      );
    }

    return this.fallbackHint(hero, previouslyHinted);
  }

  private buildHintPrompt(
    hero: Hero,
    riddle: string,
    hintNumber: number,
    alreadyHinted: string,
    attempt: number,
  ): string {
    const retryNote =
      attempt > 0
        ? "Previous attempt named the ability, used numbers, repeated a skill_key, or was too poetic. Describe ONLY the effect; pick a DIFFERENT skill_key."
        : "";

    return `Text riddle round — hint #${hintNumber}. RUSSIAN ONLY.

Riddle (literary style, for context only — do NOT match its tone):
"""${riddle}"""

Hero: ${hero.name_en} / ${hero.name_ru}. Roles: ${hero.roles.join(", ")}.
Already hinted skill_key values this round (server tracks these — pick a DIFFERENT one): ${alreadyHinted}.
${retryNote}

Pick ONE different ability. In 1–2 short casual sentences describe what it DOES in gameplay terms:
- OK: оглушает, замедляет, притягивает к себе, снимает баффы, даёт невидимость, лечит, щит, урон по области
- NOT OK: название скилла, имя героя, цифры (секунды, урон, %, кд)

JSON only:
{"hint":"Цепляет врага и тащит к кастеру — из куста часто не ждут.","skill_key":"Q","skill_ru":"Мясной крюк"}`;
  }

  private async requestHint(
    hero: Hero,
    riddle: string,
    hintNumber: number,
    alreadyHinted: string,
    previouslyHinted: string[],
    attempt: number,
  ): Promise<HintPack | null> {
    const prompt = this.buildHintPrompt(
      hero,
      riddle,
      hintNumber,
      alreadyHinted,
      attempt,
    );

    if (this.logRequests) {
      logGeminiRequest("hint", this.modelName, prompt, {
        hero: hero.name_en,
        hintNumber,
        previouslyHinted,
        attempt: attempt + 1,
        systemInstruction: HINT_SYSTEM,
        config: HINT_GEN_CONFIG,
      });
    }

    const started = Date.now();
    try {
      const result = await this.getModel(HINT_GEN_CONFIG, HINT_SYSTEM).generateContent(
        prompt,
      );
      const raw = result.response.text();
      const parsed = this.parseHintJsonResponse(raw);
      if (this.logRequests) {
        logGeminiResponse("hint", raw, Date.now() - started, parsed ?? undefined);
      }
      if (!parsed) return null;

      const hint = sanitizeHintText(parsed.hint);
      const skillKey = parsed.skillKey.trim().toUpperCase();
      if (!hint || !skillKey) return null;
      if (!HINT_SKILL_KEYS.has(skillKey)) return null;
      if (isWeakHint(hint, hero.name_ru, hero.name_en)) return null;
      if (isExplicitMechanicsHint(hint, parsed.skillRu)) return null;

      const duplicate = previouslyHinted.some(
        (s) => s.trim().toUpperCase() === skillKey,
      );
      if (duplicate) return null;

      return { hint, skillKey };
    } catch (err) {
      console.error(`[Gemini ←] hint ERROR ${Date.now() - started}ms`, err);
    }
    return null;
  }

  private parseHintJsonResponse(raw: string | undefined): {
    hint: string;
    skillKey: string;
    skillRu?: string;
  } | null {
    if (!raw) return null;

    const tryParse = (text: string): {
      hint: string;
      skillKey: string;
      skillRu?: string;
    } | null => {
      try {
        const data = JSON.parse(text) as {
          hint?: string;
          skill_key?: string;
          skill_ru?: string;
        };
        const hint = String(data.hint ?? "").trim().replace(/\\n/g, "\n");
        const skillKey = String(data.skill_key ?? "").trim();
        const skillRu = String(data.skill_ru ?? "").trim();
        if (!hint || !skillKey) return null;
        return { hint, skillKey, skillRu };
      } catch {
        return null;
      }
    };

    const direct = tryParse(raw);
    if (direct) return direct;

    const match = raw.match(/\{[\s\S]*\}/);
    return match ? tryParse(match[0]) : null;
  }

  async generateDailyNick(nickDate: string, seed: string): Promise<string | null> {
    for (let attempt = 0; attempt < NICK_MAX_ATTEMPTS; attempt++) {
      const prompt = buildNickUserPrompt(nickDate, seed, attempt);

      if (this.logRequests) {
        logGeminiRequest("nick", this.modelName, prompt, { nickDate, seed, attempt });
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
        console.warn(
          `[Gemini] nick rejected (attempt ${attempt + 1}): "${raw.slice(0, 80)}"`,
        );
      } catch (err) {
        console.error(`[Gemini ←] nick ERROR ${Date.now() - started}ms`, err);
      }
    }
    return null;
  }

  async generateDailyNickBatch(
    nickDate: string,
    seed: string,
    count: number,
    exclude: string[] = [],
  ): Promise<string[]> {
    const excludeSet = new Set(exclude.map((n) => n.toLowerCase()));
    const prompt = buildNickBatchUserPrompt(nickDate, seed, count);

    if (this.logRequests) {
      logGeminiRequest("nick", this.modelName, prompt, {
        nickDate,
        seed,
        batch: count,
      });
    }

    const started = Date.now();
    try {
      const result = await this.getModel(NICK_BATCH_GEN_CONFIG, NICK_SYSTEM).generateContent(
        prompt,
      );
      const raw = result.response.text()?.trim() ?? "";
      const parsed = parseNickBatchJson(raw);
      const nicks = filterValidNickBatch(parsed, count, excludeSet);
      if (this.logRequests) {
        logGeminiResponse("nick", raw, Date.now() - started, {
          batch: nicks.length,
          nicks,
        });
      }
      if (nicks.length > 0) return nicks;
      console.warn(
        `[Gemini] nick batch rejected (${parsed.length} raw, 0 valid)`,
      );
    } catch (err) {
      console.error(`[Gemini ←] nick batch ERROR ${Date.now() - started}ms`, err);
    }

    const fallback = await this.generateDailyNick(nickDate, `${seed}-fallback`);
    return fallback ? [fallback] : [];
  }

  private parseEmoJsonResponse(raw: string | undefined): EmoRiddlePack | null {
    if (!raw) return null;

    const tryParse = (text: string): EmoRiddlePack | null => {
      try {
        const data = JSON.parse(text) as {
          emojis?: string;
          skills?: Array<{
            emoji?: string;
            name_ru?: string;
            name_en?: string;
          }>;
          possibleAnswers?: string[];
        };

        const skills: EmoSkillEntry[] = [];
        if (Array.isArray(data.skills)) {
          for (const item of data.skills) {
            const emoji = String(item.emoji ?? "").trim();
            const name_ru = String(item.name_ru ?? "").trim();
            const name_en = String(item.name_en ?? "").trim();
            if (!emoji || !name_ru) continue;
            skills.push({
              emoji,
              name_ru,
              name_en: name_en || name_ru,
            });
          }
        }

        if (skills.length < 3) return null;

        const emojis =
          String(data.emojis ?? "").trim() ||
          skills.map((s) => s.emoji).join(" ");

        return {
          emojis,
          skills,
          possibleAnswers: Array.isArray(data.possibleAnswers)
            ? data.possibleAnswers.map((s) => String(s).trim()).filter(Boolean)
            : [],
        };
      } catch {
        return null;
      }
    };

    const direct = tryParse(raw);
    if (direct) return direct;

    const match = raw.match(/\{[\s\S]*\}/);
    return match ? tryParse(match[0]) : null;
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

  private fallbackEmoRiddle(hero: Hero): EmoRiddlePack {
    const attr =
      hero.primary_attr === "str"
        ? "💪"
        : hero.primary_attr === "agi"
          ? "🏃"
          : hero.primary_attr === "int"
            ? "🧠"
            : "⚖️";
    const roleEmoji = hero.roles.includes("Support") ? "🛡️" : "⚔️";
    const skills: EmoSkillEntry[] = [
      { emoji: roleEmoji, name_ru: "Фирменная способность", name_en: "Signature" },
      { emoji: attr, name_ru: "Пассив / атрибут", name_en: "Passive" },
      { emoji: "✨", name_ru: "Ультимейт", name_en: "Ultimate" },
      { emoji: "🎯", name_ru: "Контроль / урон", name_en: "Control" },
    ];
    return {
      emojis: skills.map((s) => s.emoji).join(" "),
      skills,
      possibleAnswers: [],
    };
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

  private fallbackHint(hero: Hero, previouslyHinted: string[]): HintPack {
    const slots: Array<{ skillKey: string; hint: string }> = [
      {
        skillKey: "Q",
        hint: "Одна из кнопок накидывает жёсткий контроль — стан или рут, из которого сложно выбраться.",
      },
      {
        skillKey: "W",
        hint: "Вторая способность чаще замедляет, снимает баффы или даёт защиту в драке.",
      },
      {
        skillKey: "E",
        hint: "Ещё одна кнопка усиливает давление — пассивный урон, снижение брони или уклонение от ударов.",
      },
      {
        skillKey: "ULT",
        hint: "Ультимейт меняет тимфайт: массовый контроль, неуязвимость или огромный всплеск урона по области.",
      },
      {
        skillKey: "PASSIVE",
        hint: "Пассивка постоянно подкручивает его стиль — дополнительный урон, хил или бонус к передвижению.",
      },
    ];

    for (const slot of slots) {
      const used = previouslyHinted.some(
        (s) => s.trim().toUpperCase() === slot.skillKey,
      );
      if (!used) return slot;
    }

    return slots[slots.length - 1]!;
  }
}

