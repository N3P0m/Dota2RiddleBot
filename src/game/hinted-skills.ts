export function parseHintedSkills(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data
      .map((item) => String(item).trim())
      .filter((name) => name.length > 0);
  } catch {
    return [];
  }
}

export function serializeHintedSkills(skills: string[]): string {
  return JSON.stringify(skills);
}

export function isSkillAlreadyHinted(
  skillKey: string,
  previouslyHinted: string[],
): boolean {
  const norm = skillKey.trim().toUpperCase();
  return previouslyHinted.some((s) => s.trim().toUpperCase() === norm);
}
