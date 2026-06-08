/** ID документа кастомного эмодзи Telegram (snowflake ≥14 цифр, не user id). */
export function isValidCustomEmojiId(id: string): boolean {
  const trimmed = id.trim();
  if (!/^\d+$/.test(trimmed)) return false;
  return trimmed.length >= 14;
}

export function stripCustomEmojiHtml(html: string): string {
  return html.replace(
    /<tg-emoji emoji-id="[^"]*">([\s\S]*?)<\/tg-emoji>/g,
    "$1",
  );
}

export function formatCustomEmojiHtml(
  customEmojiId: string | undefined,
  fallback: string,
): string {
  const id = customEmojiId?.trim();
  if (id && isValidCustomEmojiId(id)) {
    return `<tg-emoji emoji-id="${id}">${fallback}</tg-emoji>`;
  }
  return fallback;
}
