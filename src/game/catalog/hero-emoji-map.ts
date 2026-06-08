import fs from "node:fs";
import path from "node:path";

export type HeroEmojiMapEntry = {
  custom_emoji_id: string;
  emoji_fallback: string;
  updated_at: number;
};

export type HeroEmojiMapFile = Record<string, HeroEmojiMapEntry>;

export class HeroEmojiMapStore {
  private data: HeroEmojiMapFile = {};
  private pendingByUser = new Map<string, number>();

  constructor(private filePath: string) {
    this.load();
  }

  load(): void {
    try {
      if (!fs.existsSync(this.filePath)) {
        this.data = {};
        return;
      }
      const raw = fs.readFileSync(this.filePath, "utf8");
      this.data = JSON.parse(raw) as HeroEmojiMapFile;
    } catch (err) {
      console.error("[HeroEmojiMap] load failed:", err);
      this.data = {};
    }
  }

  save(): void {
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.filePath, `${JSON.stringify(this.data, null, 2)}\n`);
  }

  get(heroId: number): HeroEmojiMapEntry | undefined {
    return this.data[String(heroId)];
  }

  getAll(): HeroEmojiMapFile {
    return { ...this.data };
  }

  set(heroId: number, customEmojiId: string, fallback: string): HeroEmojiMapEntry {
    const entry: HeroEmojiMapEntry = {
      custom_emoji_id: customEmojiId,
      emoji_fallback: fallback.trim() || "🦸",
      updated_at: Date.now(),
    };
    this.data[String(heroId)] = entry;
    this.save();
    console.log(
      `[HeroEmojiMap] hero ${heroId} → id=${customEmojiId} fallback=${entry.emoji_fallback}`,
    );
    return entry;
  }

  setPending(userId: string, heroId: number): void {
    this.pendingByUser.set(userId, heroId);
  }

  getPending(userId: string): number | undefined {
    return this.pendingByUser.get(userId);
  }

  clearPending(userId: string): void {
    this.pendingByUser.delete(userId);
  }
}

let boundStore: HeroEmojiMapStore | null = null;

export function bindHeroEmojiMapStore(store: HeroEmojiMapStore | null): void {
  boundStore = store;
}

export function getBoundHeroEmojiMapStore(): HeroEmojiMapStore | null {
  return boundStore;
}

export function getMappedCustomEmojiId(heroId: number): string | undefined {
  const id = boundStore?.get(heroId)?.custom_emoji_id?.trim();
  return id && id.length > 0 ? id : undefined;
}

export function getMappedEmojiFallback(heroId: number): string | undefined {
  const fb = boundStore?.get(heroId)?.emoji_fallback?.trim();
  return fb && fb.length > 0 ? fb : undefined;
}
