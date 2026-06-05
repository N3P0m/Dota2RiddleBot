import Database from "better-sqlite3";
import { heroes } from "../heroes/match.js";
import { readFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export type ScoreRow = {
  chat_id: string;
  user_id: string;
  username: string | null;
  display_name: string;
  points: number;
  wins: number;
};

export type RoundRow = {
  id: number;
  chat_id: string;
  hero_id: number;
  started_by: string;
  started_at: number;
  winner_user_id: string | null;
  riddle: string | null;
  answer_variants: string | null;
  hints_used: number;
  round_mode: string;
  emo_skills: string | null;
};

const ROUND_COLUMNS =
  "id, chat_id, hero_id, started_by, started_at, winner_user_id, riddle, answer_variants, hints_used, round_mode, emo_skills";

export class Repository {
  private db: Database.Database;

  constructor(databasePath: string) {
    const dir = dirname(databasePath);
    mkdirSync(dir, { recursive: true });
    this.db = new Database(databasePath);
    this.db.pragma("journal_mode = WAL");
    const schema = readFileSync(join(__dirname, "schema.sql"), "utf-8");
    this.db.exec(schema);
    this.migrate();
  }

  private migrate(): void {
    const cols = this.db
      .prepare(`PRAGMA table_info(rounds)`)
      .all() as { name: string }[];
    const names = new Set(cols.map((c) => c.name));
    if (!names.has("riddle")) {
      this.db.exec(`ALTER TABLE rounds ADD COLUMN riddle TEXT`);
    }
    if (!names.has("answer_variants")) {
      this.db.exec(`ALTER TABLE rounds ADD COLUMN answer_variants TEXT`);
    }
    if (!names.has("hints_used")) {
      this.db.exec(
        `ALTER TABLE rounds ADD COLUMN hints_used INTEGER NOT NULL DEFAULT 0`,
      );
    }
    if (!names.has("round_mode")) {
      this.db.exec(
        `ALTER TABLE rounds ADD COLUMN round_mode TEXT NOT NULL DEFAULT 'text'`,
      );
    }
    if (!names.has("emo_skills")) {
      this.db.exec(`ALTER TABLE rounds ADD COLUMN emo_skills TEXT`);
    }

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS nick_profiles (
        user_id TEXT PRIMARY KEY,
        current_nickname TEXT NOT NULL,
        current_nick_date TEXT NOT NULL,
        previous_nicks TEXT NOT NULL DEFAULT '[]',
        display_name TEXT,
        username TEXT,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS nick_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        nickname TEXT NOT NULL,
        nick_date TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_nick_history_user ON nick_history(user_id, created_at DESC);
      CREATE TABLE IF NOT EXISTS nick_queues (
        user_id TEXT NOT NULL,
        nick_date TEXT NOT NULL,
        queue TEXT NOT NULL DEFAULT '[]',
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, nick_date)
      );
      CREATE TABLE IF NOT EXISTS chat_riddle_history (
        chat_id TEXT PRIMARY KEY,
        hero_ids TEXT NOT NULL DEFAULT '[]',
        updated_at INTEGER NOT NULL
      );
    `);

    const dailyRows = this.db
      .prepare(`SELECT user_id, nick_date, nickname, display_name, username, created_at FROM daily_nicks`)
      .all() as {
      user_id: string;
      nick_date: string;
      nickname: string;
      display_name: string | null;
      username: string | null;
      created_at: number;
    }[];

    for (const row of dailyRows) {
      const hasProfile = this.db
        .prepare(`SELECT 1 FROM nick_profiles WHERE user_id = ?`)
        .get(row.user_id);
      if (!hasProfile) {
        this.db
          .prepare(
            `INSERT INTO nick_profiles (user_id, current_nickname, current_nick_date, previous_nicks, display_name, username, updated_at)
             VALUES (?, ?, ?, '[]', ?, ?, ?)`,
          )
          .run(
            row.user_id,
            row.nickname,
            row.nick_date,
            row.display_name,
            row.username,
            row.created_at,
          );
      }
      const hasHistory = this.db
        .prepare(
          `SELECT 1 FROM nick_history WHERE user_id = ? AND nickname = ? AND nick_date = ?`,
        )
        .get(row.user_id, row.nickname, row.nick_date);
      if (!hasHistory) {
        this.db
          .prepare(
            `INSERT INTO nick_history (user_id, nickname, nick_date, created_at) VALUES (?, ?, ?, ?)`,
          )
          .run(row.user_id, row.nickname, row.nick_date, row.created_at);
      }
    }
  }

  getRound(chatId: string): RoundRow | undefined {
    return this.db
      .prepare(`SELECT ${ROUND_COLUMNS} FROM rounds WHERE chat_id = ?`)
      .get(chatId) as RoundRow | undefined;
  }

  getActiveRound(chatId: string): RoundRow | undefined {
    const round = this.getRound(chatId);
    if (!round || round.winner_user_id) return undefined;
    return round;
  }

  getAnswerVariants(chatId: string): string[] {
    const round = this.getRound(chatId);
    if (!round?.answer_variants) return [];
    try {
      return JSON.parse(round.answer_variants) as string[];
    } catch {
      return [];
    }
  }

  createRound(
    chatId: string,
    heroId: number,
    startedBy: string,
    riddle: string,
    answerVariants: string[],
    roundMode: "text" | "emoji" = "text",
    emoSkills: string | null = null,
  ): RoundRow {
    const startedAt = Date.now();
    const variantsJson = JSON.stringify(answerVariants);
    this.db
      .prepare(
        `INSERT INTO rounds (chat_id, hero_id, started_by, started_at, riddle, answer_variants, hints_used, winner_user_id, round_mode, emo_skills)
         VALUES (?, ?, ?, ?, ?, ?, 0, NULL, ?, ?)
         ON CONFLICT(chat_id) DO UPDATE SET
           hero_id = excluded.hero_id,
           started_by = excluded.started_by,
           started_at = excluded.started_at,
           riddle = excluded.riddle,
           answer_variants = excluded.answer_variants,
           hints_used = 0,
           winner_user_id = NULL,
           round_mode = excluded.round_mode,
           emo_skills = excluded.emo_skills`,
      )
      .run(
        chatId,
        heroId,
        startedBy,
        startedAt,
        riddle,
        variantsJson,
        roundMode,
        emoSkills,
      );
    return this.getActiveRound(chatId)!;
  }

  incrementHints(chatId: string): void {
    this.db
      .prepare(`UPDATE rounds SET hints_used = hints_used + 1 WHERE chat_id = ?`)
      .run(chatId);
  }

  finishRound(chatId: string, winnerUserId: string): void {
    this.db
      .prepare(`UPDATE rounds SET winner_user_id = ? WHERE chat_id = ?`)
      .run(winnerUserId, chatId);
  }

  deleteRound(chatId: string): void {
    this.db.prepare(`DELETE FROM rounds WHERE chat_id = ?`).run(chatId);
  }

  addWin(
    chatId: string,
    userId: string,
    username: string | null,
    displayName: string,
    points: number,
  ): void {
    this.db
      .prepare(
        `INSERT INTO scores (chat_id, user_id, username, display_name, points, wins)
         VALUES (?, ?, ?, ?, ?, 1)
         ON CONFLICT(chat_id, user_id) DO UPDATE SET
           username = excluded.username,
           display_name = excluded.display_name,
           points = points + excluded.points,
           wins = wins + 1`,
      )
      .run(chatId, userId, username, displayName, points);
  }

  getLeaderboard(chatId: string, limit = 10): ScoreRow[] {
    return this.db
      .prepare(
        `SELECT s.chat_id, s.user_id, s.username,
                COALESCE(np.current_nickname, s.display_name) AS display_name,
                s.points, s.wins
         FROM scores s
         LEFT JOIN nick_profiles np ON np.user_id = s.user_id
         WHERE s.chat_id = ?
         ORDER BY s.points DESC, s.wins DESC
         LIMIT ?`,
      )
      .all(chatId, limit) as ScoreRow[];
  }

  getUserScore(chatId: string, userId: string): ScoreRow | undefined {
    return this.db
      .prepare(
        `SELECT chat_id, user_id, username, display_name, points, wins
         FROM scores WHERE chat_id = ? AND user_id = ?`,
      )
      .get(chatId, userId) as ScoreRow | undefined;
  }

  getDailyNick(userId: string, nickDate: string): string | undefined {
    const row = this.db
      .prepare(
        `SELECT nickname FROM daily_nicks WHERE user_id = ? AND nick_date = ?`,
      )
      .get(userId, nickDate) as { nickname: string } | undefined;
    return row?.nickname;
  }

  getNickQueue(userId: string, nickDate: string): string[] {
    const row = this.db
      .prepare(
        `SELECT queue FROM nick_queues WHERE user_id = ? AND nick_date = ?`,
      )
      .get(userId, nickDate) as { queue: string } | undefined;
    if (!row) return [];
    return this.parseStringList(row.queue);
  }

  setNickQueue(userId: string, nickDate: string, queue: string[]): void {
    const now = Date.now();
    this.db
      .prepare(
        `INSERT INTO nick_queues (user_id, nick_date, queue, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id, nick_date) DO UPDATE SET
           queue = excluded.queue,
           updated_at = excluded.updated_at`,
      )
      .run(userId, nickDate, JSON.stringify(queue), now);
  }

  getPreviousNicks(userId: string): string[] {
    const row = this.db
      .prepare(`SELECT previous_nicks FROM nick_profiles WHERE user_id = ?`)
      .get(userId) as { previous_nicks: string } | undefined;
    if (!row) return [];
    try {
      const list = JSON.parse(row.previous_nicks) as unknown;
      return Array.isArray(list)
        ? list.filter((x): x is string => typeof x === "string")
        : [];
    } catch {
      return [];
    }
  }

  getNickHistory(userId: string, limit = 20): { nickname: string; nick_date: string; created_at: number }[] {
    return this.db
      .prepare(
        `SELECT nickname, nick_date, created_at FROM nick_history
         WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
      )
      .all(userId, limit) as { nickname: string; nick_date: string; created_at: number }[];
  }

  saveDailyNick(
    userId: string,
    nickDate: string,
    nickname: string,
    displayName: string | null,
    username: string | null,
  ): void {
    const now = Date.now();
    const oldToday = this.getDailyNick(userId, nickDate);
    const profile = this.db
      .prepare(`SELECT current_nickname, previous_nicks FROM nick_profiles WHERE user_id = ?`)
      .get(userId) as { current_nickname: string; previous_nicks: string } | undefined;

    const previous = this.parsePreviousList(profile?.previous_nicks);

    const toArchive = new Set<string>();
    if (oldToday && oldToday !== nickname) toArchive.add(oldToday);
    if (
      profile?.current_nickname &&
      profile.current_nickname !== nickname &&
      profile.current_nickname !== oldToday
    ) {
      toArchive.add(profile.current_nickname);
    }

    for (const nick of toArchive) {
      if (!previous.includes(nick)) previous.unshift(nick);
    }

    const capped = previous.slice(0, 100);

    this.db
      .prepare(
        `INSERT INTO daily_nicks (user_id, nick_date, nickname, display_name, username, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, nick_date) DO UPDATE SET
           nickname = excluded.nickname,
           display_name = excluded.display_name,
           username = excluded.username,
           created_at = excluded.created_at`,
      )
      .run(userId, nickDate, nickname, displayName, username, now);

    this.db
      .prepare(
        `INSERT INTO nick_profiles (user_id, current_nickname, current_nick_date, previous_nicks, display_name, username, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           current_nickname = excluded.current_nickname,
           current_nick_date = excluded.current_nick_date,
           previous_nicks = excluded.previous_nicks,
           display_name = excluded.display_name,
           username = excluded.username,
           updated_at = excluded.updated_at`,
      )
      .run(
        userId,
        nickname,
        nickDate,
        JSON.stringify(capped),
        displayName,
        username,
        now,
      );

    this.db
      .prepare(
        `INSERT INTO nick_history (user_id, nickname, nick_date, created_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(userId, nickname, nickDate, now);
  }

  private parsePreviousList(raw: string | undefined): string[] {
    return this.parseStringList(raw);
  }

  private parseStringList(raw: string | undefined): string[] {
    if (!raw) return [];
    try {
      const list = JSON.parse(raw) as unknown;
      return Array.isArray(list)
        ? list.filter((x): x is string => typeof x === "string")
        : [];
    } catch {
      return [];
    }
  }

  getRiddleHeroHistory(chatId: string): number[] {
    const row = this.db
      .prepare(`SELECT hero_ids FROM chat_riddle_history WHERE chat_id = ?`)
      .get(chatId) as { hero_ids: string } | undefined;
    if (!row) return [];
    try {
      const ids = JSON.parse(row.hero_ids) as unknown;
      return Array.isArray(ids)
        ? ids.filter((x): x is number => typeof x === "number")
        : [];
    } catch {
      return [];
    }
  }

  addRiddleHeroToHistory(chatId: string, heroId: number): void {
    const ids = this.getRiddleHeroHistory(chatId);
    ids.push(heroId);
    const uniqueCount = new Set(ids).size;
    const capped =
      uniqueCount >= heroes.length ? [heroId] : ids.slice(-200);
    const now = Date.now();
    this.db
      .prepare(
        `INSERT INTO chat_riddle_history (chat_id, hero_ids, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(chat_id) DO UPDATE SET
           hero_ids = excluded.hero_ids,
           updated_at = excluded.updated_at`,
      )
      .run(chatId, JSON.stringify(capped), now);
  }

  removeLastRiddleHeroFromHistory(chatId: string, heroId: number): void {
    const ids = this.getRiddleHeroHistory(chatId);
    if (ids.length === 0) return;
    if (ids[ids.length - 1] === heroId) {
      ids.pop();
      this.db
        .prepare(
          `UPDATE chat_riddle_history SET hero_ids = ?, updated_at = ? WHERE chat_id = ?`,
        )
        .run(JSON.stringify(ids), Date.now(), chatId);
    }
  }

  clearRiddleHeroHistory(chatId: string): void {
    this.db
      .prepare(`DELETE FROM chat_riddle_history WHERE chat_id = ?`)
      .run(chatId);
  }

  close(): void {
    this.db.close();
  }
}
