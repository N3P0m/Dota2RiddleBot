/**
 * Разбивает сплошной текст загадки на абзацы для Telegram.
 */
export function formatReadableText(text: string): string {
  let t = text.trim().replace(/\r\n/g, "\n");

  if (!t) return t;

  // Уже есть явные переносы
  if (t.includes("\n")) {
    return t
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .join("\n\n");
  }

  t = t.replace(/\s+/g, " ");

  const sentences =
    t.match(/[^.!?…]+[.!?…]+(?:\s+|$)|[^.!?…]+$/g)?.map((s) => s.trim()) ??
    [t];

  if (sentences.length <= 1) return t;

  const avgLen =
    sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length;

  // Короткие фразы (стаккато) — каждая с новой строки
  if (avgLen < 55 || sentences.length >= 6) {
    return sentences.join("\n\n");
  }

  // Длинная проза — по 2 предложения в абзац
  const blocks: string[] = [];
  for (let i = 0; i < sentences.length; i += 2) {
    blocks.push(sentences.slice(i, i + 2).join(" "));
  }
  return blocks.join("\n\n");
}
