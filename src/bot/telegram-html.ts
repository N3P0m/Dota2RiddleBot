import type { Context, InlineKeyboard } from "grammy";
import { GrammyError } from "grammy";
import { stripCustomEmojiHtml } from "../game/catalog/custom-emoji.js";

export { isValidCustomEmojiId, stripCustomEmojiHtml } from "../game/catalog/custom-emoji.js";

function isCustomEmojiSendError(err: unknown): boolean {
  if (!(err instanceof GrammyError)) return false;
  const d = err.description ?? "";
  return (
    d.includes("DOCUMENT_INVALID") ||
    d.includes("CUSTOM_EMOJI") ||
    d.includes("ENTITY_BOUNDS")
  );
}

type HtmlOpts = {
  parse_mode: "HTML";
  reply_markup?: InlineKeyboard;
  reply_parameters?: { message_id: number };
};

async function trySend(
  ctx: Context,
  text: string,
  opts: HtmlOpts,
  preferEdit: boolean,
): Promise<boolean> {
  try {
    if (preferEdit && ctx.callbackQuery?.message) {
      await ctx.editMessageText(text, opts);
    } else {
      await ctx.reply(text, opts);
    }
    return true;
  } catch (err) {
    if (isCustomEmojiSendError(err)) return false;
    if (preferEdit && ctx.callbackQuery?.message) {
      try {
        await ctx.reply(text, opts);
        return true;
      } catch (err2) {
        if (isCustomEmojiSendError(err2)) return false;
        throw err2;
      }
    }
    throw err;
  }
}

/** Отправка/редактирование HTML; при невалидном tg-emoji — повтор без кастомных эмодзи. */
export async function replyOrEditHtml(
  ctx: Context,
  text: string,
  replyMarkup?: InlineKeyboard,
): Promise<void> {
  const opts: HtmlOpts = { parse_mode: "HTML", reply_markup: replyMarkup };
  const preferEdit = !!ctx.callbackQuery?.message;

  if (await trySend(ctx, text, opts, preferEdit)) return;

  const plain = stripCustomEmojiHtml(text);
  if (plain === text) throw new Error("HTML send failed");

  await trySend(ctx, plain, opts, preferEdit);
}

/** Ответ HTML с fallback для tg-emoji (reply/edit не используется). */
export async function replyHtml(
  ctx: Context,
  text: string,
  extras?: Pick<HtmlOpts, "reply_markup" | "reply_parameters">,
): Promise<void> {
  const opts: HtmlOpts = { parse_mode: "HTML", ...extras };
  if (await trySend(ctx, text, opts, false)) return;

  const plain = stripCustomEmojiHtml(text);
  if (plain === text) throw new Error("HTML send failed");

  await trySend(ctx, plain, opts, false);
}
