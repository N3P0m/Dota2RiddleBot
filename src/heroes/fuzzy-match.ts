import levenshtein from "fast-levenshtein";

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

export function normalizeAnswer(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9]/g, "");
}

function hasCyrillic(s: string): boolean {
  return /[а-я]/.test(s);
}

/** Кириллическая запись англ. имени → латиница (бладсикер → bladsiker). */
export function transliterateToLatin(s: string): string {
  return [...s]
    .map((ch) => CYRILLIC_TO_LATIN[ch] ?? ch)
    .join("");
}

function trigrams(s: string): string[] {
  if (s.length < 3) return [s];
  const out: string[] = [];
  for (let i = 0; i <= s.length - 3; i++) {
    out.push(s.slice(i, i + 3));
  }
  return out;
}

/** Sørensen–Dice на триграммах (0..1). */
export function trigramSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;

  const ta = trigrams(a);
  const tb = trigrams(b);
  if (ta.length === 0 || tb.length === 0) return 0;

  const countB = new Map<string, number>();
  for (const t of tb) countB.set(t, (countB.get(t) ?? 0) + 1);

  let overlap = 0;
  for (const t of ta) {
    const n = countB.get(t) ?? 0;
    if (n > 0) {
      overlap++;
      countB.set(t, n - 1);
    }
  }

  return (2 * overlap) / (ta.length + tb.length);
}

export function levenshteinSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein.get(a, b) / maxLen;
}

/** Варианты строки для сравнения (оригинал + транслит). */
export function answerForms(normalized: string): string[] {
  const forms = new Set<string>([normalized]);
  if (hasCyrillic(normalized)) {
    forms.add(transliterateToLatin(normalized));
  }
  return [...forms];
}

function minLengthThreshold(len: number): number {
  if (len <= 3) return 0.85;
  if (len <= 5) return 0.72;
  if (len <= 8) return 0.58;
  return 0.52;
}

/**
 * Схожесть 0..1: levenshtein (fast-levenshtein) + триграммы + подстроки.
 */
export function combinedSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length >= 3 && b.length >= 3) {
    if (a.includes(b) || b.includes(a)) {
      const ratio = Math.min(a.length, b.length) / Math.max(a.length, b.length);
      return 0.88 + ratio * 0.12;
    }
  }

  const lev = levenshteinSimilarity(a, b);
  const tri = trigramSimilarity(a, b);
  return Math.max(lev, tri, lev * 0.45 + tri * 0.55);
}

export function isFuzzyMatch(inputNorm: string, candidateNorm: string): boolean {
  if (inputNorm.length < 2 || candidateNorm.length < 2) return false;

  const threshold = minLengthThreshold(
    Math.max(inputNorm.length, candidateNorm.length),
  );

  const inputForms = answerForms(inputNorm);
  const candidateForms = answerForms(candidateNorm);

  for (const inp of inputForms) {
    for (const cand of candidateForms) {
      if (combinedSimilarity(inp, cand) >= threshold) return true;
    }
  }

  return false;
}
