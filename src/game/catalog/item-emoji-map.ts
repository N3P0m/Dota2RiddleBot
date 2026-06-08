import fs from "node:fs";
import path from "node:path";

export type ItemEmojiMapEntry = {
  custom_emoji_id: string;
  emoji_fallback: string;
  updated_at: number;
};

export type ItemEmojiMapFile = Record<string, ItemEmojiMapEntry>;

export class ItemEmojiMapStore {
  private data: ItemEmojiMapFile = {};
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
      this.data = JSON.parse(raw) as ItemEmojiMapFile;
    } catch (err) {
      console.error("[ItemEmojiMap] load failed:", err);
      this.data = {};
    }
  }

  save(): void {
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.filePath, `${JSON.stringify(this.data, null, 2)}\n`);
  }

  get(itemId: number): ItemEmojiMapEntry | undefined {
    return this.data[String(itemId)];
  }

  getAll(): ItemEmojiMapFile {
    return { ...this.data };
  }

  set(
    itemId: number,
    customEmojiId: string,
    fallback: string,
  ): ItemEmojiMapEntry {
    const entry: ItemEmojiMapEntry = {
      custom_emoji_id: customEmojiId,
      emoji_fallback: fallback.trim() || "🎒",
      updated_at: Date.now(),
    };
    this.data[String(itemId)] = entry;
    this.save();
    console.log(
      `[ItemEmojiMap] item ${itemId} → id=${customEmojiId} fallback=${entry.emoji_fallback}`,
    );
    return entry;
  }

  setPending(userId: string, itemId: number): void {
    this.pendingByUser.set(userId, itemId);
  }

  getPending(userId: string): number | undefined {
    return this.pendingByUser.get(userId);
  }

  clearPending(userId: string): void {
    this.pendingByUser.delete(userId);
  }
}

let boundStore: ItemEmojiMapStore | null = null;

export function bindItemEmojiMapStore(store: ItemEmojiMapStore | null): void {
  boundStore = store;
}

export function getMappedItemCustomEmojiId(itemId: number): string | undefined {
  const id = boundStore?.get(itemId)?.custom_emoji_id?.trim();
  return id && id.length > 0 ? id : undefined;
}

export function getMappedItemEmojiFallback(itemId: number): string | undefined {
  const fb = boundStore?.get(itemId)?.emoji_fallback?.trim();
  return fb && fb.length > 0 ? fb : undefined;
}
