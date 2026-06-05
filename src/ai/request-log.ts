const SEP = "─".repeat(56);

export function logGeminiRequest(
  kind: "riddle" | "hint" | "nick" | "emo_riddle" | "insult",
  model: string,
  prompt: string,
  meta?: Record<string, unknown>,
): void {
  const ts = new Date().toISOString();
  console.log(`\n${SEP}`);
  console.log(`[Gemini →] ${kind.toUpperCase()}  ${ts}`);
  console.log(`model: ${model}`);
  if (meta && Object.keys(meta).length > 0) {
    console.log("meta:", JSON.stringify(meta));
  }
  console.log(SEP);
  console.log(prompt);
  console.log(`${SEP}\n`);
}

export function logGeminiResponse(
  kind: "riddle" | "hint" | "nick" | "emo_riddle" | "insult",
  raw: string | undefined,
  ms: number,
  extra?: Record<string, unknown>,
): void {
  const preview = raw ?? "(empty)";
  console.log(`[Gemini ←] ${kind}  ${ms}ms`);
  if (extra) console.log("parsed:", JSON.stringify(extra, null, 2));
  console.log(SEP);
  console.log(preview.length > 2000 ? `${preview.slice(0, 2000)}…` : preview);
  console.log(`${SEP}\n`);
}
