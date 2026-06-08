import type { Context, NextFunction } from "grammy";
import type { Message } from "grammy/types";

export type CustomEmojiLogHit = {
  id: string;
  glyph?: string;
  source: "entity" | "sticker";
};

function userLabel(ctx: Context): string {
  const from = ctx.from;
  if (!from) return "user=?";
  const name =
    from.first_name + (from.last_name ? ` ${from.last_name}` : "");
  const uname = from.username ? `@${from.username}` : "no-username";
  return `user=${from.id} (${uname}, ${name})`;
}

function chatLabel(ctx: Context): string {
  const chat = ctx.chat;
  if (!chat) return "chat=?";
  const title =
    "title" in chat && chat.title
      ? ` «${chat.title}»`
      : "username" in chat && chat.username
        ? ` @${chat.username}`
        : "";
  return `chat=${chat.id}${title}`;
}

/** custom_emoji_id из entities текста/подписи и из sticker. */
export function extractCustomEmojiIds(message: Message): CustomEmojiLogHit[] {
  const hits: CustomEmojiLogHit[] = [];
  const seen = new Set<string>();
  const text = message.text ?? message.caption ?? "";

  const entitySources = [
    ...(message.entities ?? []),
    ...(message.caption_entities ?? []),
  ];

  for (const entity of entitySources) {
    if (entity.type !== "custom_emoji") continue;
    const id = String(entity.custom_emoji_id);
    if (seen.has(id)) continue;
    seen.add(id);
    const glyph = text.slice(entity.offset, entity.offset + entity.length);
    hits.push({
      id,
      glyph: glyph || undefined,
      source: "entity",
    });
  }

  const sticker = message.sticker;
  if (sticker?.custom_emoji_id != null) {
    const id = String(sticker.custom_emoji_id);
    if (!seen.has(id)) {
      hits.push({
        id,
        glyph: sticker.emoji,
        source: "sticker",
      });
    }
  }

  return hits;
}

function logCustomEmojis(hits: CustomEmojiLogHit[]): void {
  for (const hit of hits) {
    const glyphPart = hit.glyph ? ` fallback="${hit.glyph}"` : "";
    console.log(
      `[CustomEmoji] id=${hit.id}${glyphPart} (${hit.source})`,
    );
  }
}

export function logIncomingUpdates(enabled: boolean) {
  return async (ctx: Context, next: NextFunction): Promise<void> => {
    if (enabled) {
      const prefix = `[User →] ${chatLabel(ctx)} ${userLabel(ctx)}`;

      if (ctx.message?.text) {
        console.log(`${prefix}: ${ctx.message.text}`);
      } else if (ctx.callbackQuery?.data) {
        console.log(`${prefix} [callback]: ${ctx.callbackQuery.data}`);
      } else if (ctx.message) {
        const kind = ctx.message.photo
          ? "photo"
          : ctx.message.sticker
            ? "sticker"
            : ctx.message.document
              ? "document"
              : "message";
        const caption = ctx.message.caption;
        console.log(
          `${prefix} [${kind}]${caption ? `: ${caption}` : ""}`,
        );
      }

      if (ctx.message) {
        const emojiHits = extractCustomEmojiIds(ctx.message);
        if (emojiHits.length > 0) logCustomEmojis(emojiHits);
      }
    }

    await next();
  };
}
