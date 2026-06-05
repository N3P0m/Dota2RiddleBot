export type RoundMode = "text" | "emoji";

export function isEmojiRound(mode: string | null | undefined): boolean {
  return mode === "emoji";
}
