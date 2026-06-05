export type EmoSkillEntry = {
  emoji: string;
  name_ru: string;
  name_en: string;
};

export function parseEmoSkills(raw: string | null | undefined): EmoSkillEntry[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data
      .map((item) => {
        const o = item as Record<string, unknown>;
        const emoji = String(o.emoji ?? "").trim();
        const name_ru = String(o.name_ru ?? "").trim();
        const name_en = String(o.name_en ?? "").trim();
        if (!emoji || !name_ru) return null;
        return { emoji, name_ru, name_en: name_en || name_ru };
      })
      .filter((x): x is EmoSkillEntry => x !== null);
  } catch {
    return [];
  }
}

export function serializeEmoSkills(skills: EmoSkillEntry[]): string {
  return JSON.stringify(skills);
}

export function formatEmoHintFromSkills(
  skills: EmoSkillEntry[],
  revealedCount: number,
): string {
  const count = Math.min(revealedCount, skills.length);
  if (count === 0) return "Подсказок больше нет.";
  return skills
    .slice(0, count)
    .map((s) => `${s.emoji} — ${s.name_ru}`)
    .join("\n");
}
