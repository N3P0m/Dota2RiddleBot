import Database from "better-sqlite3";
import { heroes } from "../heroes/match.js";
import { todayKey } from "../game/nick-date.js";
import { INSULTS_SEED } from "../game/insults-seed.js";
import { FLOOD_TAUNTS_SEED } from "../game/work-taunts-seed.js";
import type { FloodTauntSlot } from "../game/work-hours.js";
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
  current_streak: number;
  best_streak: number;
  riddles_started: number;
};

export type PeriodLeaderboardRow = {
  user_id: string;
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
  hinted_skills: string;
  wrong_guesses: number;
  taunts_sent: number;
  target_type: string;
  hint_payers: string;
};

export type WalletRow = {
  user_id: string;
  gold: number;
  battle_mmr: number;
  created_at: number;
};

export type PlayerHeroRow = {
  chat_id: string;
  user_id: string;
  hero_id: number;
  level: number;
  xp: number;
  equipped_items: string;
};

export type ChatUnlockRow = {
  chat_id: string;
  entity_type: string;
  entity_id: number;
  guess_count: number;
  unlocked_at: number | null;
};

export type BattleRow = {
  id: number;
  chat_id: string;
  message_id: number | null;
  message_chat_id: string | null;
  challenger_id: string;
  defender_id: string;
  state: string;
  turn: number;
  state_json: string;
  created_at: number;
  winner_id: string | null;
};

export type BattleMmrRow = {
  user_id: string;
  display_name: string;
  battle_mmr: number;
};

export type UserAchievementRow = {
  achievement_id: string;
  unlocked_at: number;
};

export type WeeklyTitleRow = {
  title: string;
  week_key: string;
  expires_at: number;
};

const ROUND_COLUMNS =
  "id, chat_id, hero_id, started_by, started_at, winner_user_id, riddle, answer_variants, hints_used, round_mode, emo_skills, hinted_skills, wrong_guesses, taunts_sent, target_type, hint_payers";

const SCORE_COLUMNS =
  "chat_id, user_id, username, display_name, points, wins, current_streak, best_streak, riddles_started";

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
    const roundCols = this.db
      .prepare(`PRAGMA table_info(rounds)`)
      .all() as { name: string }[];
    const roundNames = new Set(roundCols.map((c) => c.name));
    if (!roundNames.has("riddle")) {
      this.db.exec(`ALTER TABLE rounds ADD COLUMN riddle TEXT`);
    }
    if (!roundNames.has("answer_variants")) {
      this.db.exec(`ALTER TABLE rounds ADD COLUMN answer_variants TEXT`);
    }
    if (!roundNames.has("hints_used")) {
      this.db.exec(
        `ALTER TABLE rounds ADD COLUMN hints_used INTEGER NOT NULL DEFAULT 0`,
      );
    }
    if (!roundNames.has("round_mode")) {
      this.db.exec(
        `ALTER TABLE rounds ADD COLUMN round_mode TEXT NOT NULL DEFAULT 'text'`,
      );
    }
    if (!roundNames.has("emo_skills")) {
      this.db.exec(`ALTER TABLE rounds ADD COLUMN emo_skills TEXT`);
    }
    if (!roundNames.has("hinted_skills")) {
      this.db.exec(
        `ALTER TABLE rounds ADD COLUMN hinted_skills TEXT NOT NULL DEFAULT '[]'`,
      );
    }
    if (!roundNames.has("wrong_guesses")) {
      this.db.exec(
        `ALTER TABLE rounds ADD COLUMN wrong_guesses INTEGER NOT NULL DEFAULT 0`,
      );
    }
    if (!roundNames.has("taunts_sent")) {
      this.db.exec(
        `ALTER TABLE rounds ADD COLUMN taunts_sent INTEGER NOT NULL DEFAULT 0`,
      );
    }
    if (!roundNames.has("target_type")) {
      this.db.exec(
        `ALTER TABLE rounds ADD COLUMN target_type TEXT NOT NULL DEFAULT 'hero'`,
      );
    }
    if (!roundNames.has("hint_payers")) {
      this.db.exec(
        `ALTER TABLE rounds ADD COLUMN hint_payers TEXT NOT NULL DEFAULT '[]'`,
      );
    }

    const scoreCols = this.db
      .prepare(`PRAGMA table_info(scores)`)
      .all() as { name: string }[];
    const scoreNames = new Set(scoreCols.map((c) => c.name));
    if (!scoreNames.has("current_streak")) {
      this.db.exec(
        `ALTER TABLE scores ADD COLUMN current_streak INTEGER NOT NULL DEFAULT 0`,
      );
    }
    if (!scoreNames.has("best_streak")) {
      this.db.exec(
        `ALTER TABLE scores ADD COLUMN best_streak INTEGER NOT NULL DEFAULT 0`,
      );
    }
    if (!scoreNames.has("riddles_started")) {
      this.db.exec(
        `ALTER TABLE scores ADD COLUMN riddles_started INTEGER NOT NULL DEFAULT 0`,
      );
    }

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS round_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        hero_id INTEGER NOT NULL,
        points_earned INTEGER NOT NULL,
        hints_used INTEGER NOT NULL DEFAULT 0,
        elapsed_ms INTEGER NOT NULL,
        difficulty_multiplier REAL NOT NULL DEFAULT 1.0,
        streak_after INTEGER NOT NULL DEFAULT 0,
        won_at INTEGER NOT NULL,
        period_week TEXT NOT NULL,
        period_month TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_round_results_chat_week ON round_results(chat_id, period_week);
      CREATE INDEX IF NOT EXISTS idx_round_results_chat_month ON round_results(chat_id, period_month);
      CREATE INDEX IF NOT EXISTS idx_round_results_user ON round_results(user_id, won_at DESC);

      CREATE TABLE IF NOT EXISTS user_achievements (
        chat_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        achievement_id TEXT NOT NULL,
        unlocked_at INTEGER NOT NULL,
        PRIMARY KEY (chat_id, user_id, achievement_id)
      );

      CREATE TABLE IF NOT EXISTS weekly_titles (
        chat_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        week_key TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        PRIMARY KEY (chat_id, user_id)
      );

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
        bonus_rerolls INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, nick_date)
      );
      CREATE TABLE IF NOT EXISTS chat_riddle_history (
        chat_id TEXT PRIMARY KEY,
        hero_ids TEXT NOT NULL DEFAULT '[]',
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS insults (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS insult_refill_log (
        refill_date TEXT PRIMARY KEY,
        added_count INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS chat_taunt_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT NOT NULL,
        insult_id INTEGER NOT NULL,
        used_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_chat_taunt_history ON chat_taunt_history(chat_id, used_at DESC);

      CREATE TABLE IF NOT EXISTS work_taunts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT NOT NULL UNIQUE,
        time_slot TEXT NOT NULL DEFAULT 'any',
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS chat_round_activity (
        chat_id TEXT PRIMARY KEY,
        round_starts TEXT NOT NULL DEFAULT '[]',
        work_taunt_hour_key TEXT,
        work_taunts_sent_hour INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS chat_work_taunt_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT NOT NULL,
        work_taunt_id INTEGER NOT NULL,
        used_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_chat_work_taunt_history ON chat_work_taunt_history(chat_id, used_at DESC);

      CREATE TABLE IF NOT EXISTS player_wallets (
        user_id TEXT PRIMARY KEY,
        gold INTEGER NOT NULL DEFAULT 100,
        battle_mmr INTEGER NOT NULL DEFAULT 1000,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS gold_ledger (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        chat_id TEXT,
        amount INTEGER NOT NULL,
        reason TEXT NOT NULL,
        ref_id TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_gold_ledger_user ON gold_ledger(user_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS chat_unlocks (
        chat_id TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        guess_count INTEGER NOT NULL DEFAULT 0,
        unlocked_at INTEGER,
        PRIMARY KEY (chat_id, entity_type, entity_id)
      );

      CREATE TABLE IF NOT EXISTS player_heroes (
        chat_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        hero_id INTEGER NOT NULL,
        level INTEGER NOT NULL DEFAULT 1,
        xp INTEGER NOT NULL DEFAULT 0,
        equipped_items TEXT NOT NULL DEFAULT '[]',
        PRIMARY KEY (chat_id, user_id, hero_id)
      );

      CREATE TABLE IF NOT EXISTS player_items (
        chat_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        slot INTEGER NOT NULL CHECK(slot >= 0 AND slot < 3),
        item_id INTEGER NOT NULL,
        uses_remaining INTEGER NOT NULL,
        PRIMARY KEY (chat_id, user_id, slot)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_player_items_unique_item
        ON player_items(chat_id, user_id, item_id);

      CREATE TABLE IF NOT EXISTS battles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT NOT NULL UNIQUE,
        message_id INTEGER,
        message_chat_id TEXT,
        challenger_id TEXT NOT NULL,
        defender_id TEXT NOT NULL,
        state TEXT NOT NULL,
        turn INTEGER NOT NULL DEFAULT 1,
        state_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        winner_id TEXT
      );
    `);

    this.seedInsultsIfEmpty();
    this.seedWorkTaunts();

    const nickQueueCols = this.db
      .prepare(`PRAGMA table_info(nick_queues)`)
      .all() as { name: string }[];
    const nickQueueNames = new Set(nickQueueCols.map((c) => c.name));
    if (!nickQueueNames.has("bonus_rerolls")) {
      this.db.exec(
        `ALTER TABLE nick_queues ADD COLUMN bonus_rerolls INTEGER NOT NULL DEFAULT 0`,
      );
    }

    this.migratePlayerItemsTable();

    const dailyRows = this.db
      .prepare(
        `SELECT user_id, nick_date, nickname, display_name, username, created_at FROM daily_nicks`,
      )
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
    targetId: number,
    startedBy: string,
    riddle: string,
    answerVariants: string[],
    roundMode: "text" | "emoji" = "text",
    emoSkills: string | null = null,
    targetType: "hero" | "item" = "hero",
  ): RoundRow {
    const startedAt = Date.now();
    const variantsJson = JSON.stringify(answerVariants);
    this.db
      .prepare(
        `INSERT INTO rounds (chat_id, hero_id, started_by, started_at, riddle, answer_variants, hints_used, winner_user_id, round_mode, emo_skills, hinted_skills, wrong_guesses, taunts_sent, target_type, hint_payers)
         VALUES (?, ?, ?, ?, ?, ?, 0, NULL, ?, ?, '[]', 0, 0, ?, '[]')
         ON CONFLICT(chat_id) DO UPDATE SET
           hero_id = excluded.hero_id,
           started_by = excluded.started_by,
           started_at = excluded.started_at,
           riddle = excluded.riddle,
           answer_variants = excluded.answer_variants,
           hints_used = 0,
           winner_user_id = NULL,
           round_mode = excluded.round_mode,
           emo_skills = excluded.emo_skills,
           hinted_skills = '[]',
           wrong_guesses = 0,
           taunts_sent = 0,
           target_type = excluded.target_type,
           hint_payers = '[]'`,
      )
      .run(
        chatId,
        targetId,
        startedBy,
        startedAt,
        riddle,
        variantsJson,
        roundMode,
        emoSkills,
        targetType,
      );
    return this.getActiveRound(chatId)!;
  }

  getHintPayers(chatId: string): { user_id: string; hint_number: number }[] {
    const round = this.getRound(chatId);
    if (!round?.hint_payers) return [];
    try {
      return JSON.parse(round.hint_payers) as {
        user_id: string;
        hint_number: number;
      }[];
    } catch {
      return [];
    }
  }

  appendHintPayer(chatId: string, userId: string, hintNumber: number): void {
    const payers = this.getHintPayers(chatId);
    payers.push({ user_id: userId, hint_number: hintNumber });
    this.db
      .prepare(`UPDATE rounds SET hint_payers = ? WHERE chat_id = ?`)
      .run(JSON.stringify(payers), chatId);
  }

  incrementHints(chatId: string): void {
    this.db
      .prepare(`UPDATE rounds SET hints_used = hints_used + 1 WHERE chat_id = ?`)
      .run(chatId);
  }

  getHintedSkills(chatId: string): string[] {
    const round = this.getRound(chatId);
    if (!round?.hinted_skills) return [];
    try {
      const data = JSON.parse(round.hinted_skills) as unknown;
      if (!Array.isArray(data)) return [];
      return data.map((s) => String(s).trim()).filter(Boolean);
    } catch {
      return [];
    }
  }

  appendHintedSkill(chatId: string, skillKey: string): void {
    const skills = this.getHintedSkills(chatId);
    const trimmed = skillKey.trim().toUpperCase();
    if (!trimmed) return;
    if (skills.some((s) => s.trim().toUpperCase() === trimmed)) {
      return;
    }
    skills.push(trimmed);
    this.db
      .prepare(`UPDATE rounds SET hinted_skills = ? WHERE chat_id = ?`)
      .run(JSON.stringify(skills), chatId);
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
        `INSERT INTO scores (chat_id, user_id, username, display_name, points, wins, current_streak, best_streak, riddles_started)
         VALUES (?, ?, ?, ?, ?, 1, 0, 0, 0)
         ON CONFLICT(chat_id, user_id) DO UPDATE SET
           username = excluded.username,
           display_name = excluded.display_name,
           points = scores.points + excluded.points,
           wins = scores.wins + 1`,
      )
      .run(chatId, userId, username, displayName, points);
  }

  /** Единый рейтинг чата (загадки + бои). delta может быть отрицательной. */
  adjustPoints(
    chatId: string,
    userId: string,
    username: string | null,
    displayName: string,
    delta: number,
  ): number {
    const existing = this.getUserScore(chatId, userId);
    const newPoints = Math.max(0, (existing?.points ?? 0) + delta);

    if (existing) {
      this.db
        .prepare(
          `UPDATE scores SET
             points = ?,
             username = COALESCE(?, username),
             display_name = ?
           WHERE chat_id = ? AND user_id = ?`,
        )
        .run(newPoints, username, displayName, chatId, userId);
    } else {
      this.db
        .prepare(
          `INSERT INTO scores (chat_id, user_id, username, display_name, points, wins, current_streak, best_streak, riddles_started)
           VALUES (?, ?, ?, ?, ?, 0, 0, 0, 0)`,
        )
        .run(chatId, userId, username, displayName, newPoints);
    }

    return newPoints;
  }

  getCurrentStreak(chatId: string, userId: string): number {
    const row = this.db
      .prepare(
        `SELECT current_streak FROM scores WHERE chat_id = ? AND user_id = ?`,
      )
      .get(chatId, userId) as { current_streak: number } | undefined;
    return row?.current_streak ?? 0;
  }

  updateStreaks(chatId: string, winnerUserId: string): number {
    this.db
      .prepare(
        `UPDATE scores SET current_streak = 0 WHERE chat_id = ? AND user_id != ?`,
      )
      .run(chatId, winnerUserId);

    const current = this.getCurrentStreak(chatId, winnerUserId);
    const newStreak = current + 1;

    this.db
      .prepare(
        `UPDATE scores SET
           current_streak = ?,
           best_streak = MAX(best_streak, ?)
         WHERE chat_id = ? AND user_id = ?`,
      )
      .run(newStreak, newStreak, chatId, winnerUserId);

    return newStreak;
  }

  incrementRiddlesStarted(
    chatId: string,
    userId: string,
    username: string | null,
    displayName: string,
  ): void {
    this.db
      .prepare(
        `INSERT INTO scores (chat_id, user_id, username, display_name, points, wins, current_streak, best_streak, riddles_started)
         VALUES (?, ?, ?, ?, 0, 0, 0, 0, 1)
         ON CONFLICT(chat_id, user_id) DO UPDATE SET
           username = excluded.username,
           display_name = excluded.display_name,
           riddles_started = riddles_started + 1`,
      )
      .run(chatId, userId, username, displayName);
  }

  getRiddlesStarted(chatId: string, userId: string): number {
    const row = this.db
      .prepare(
        `SELECT riddles_started FROM scores WHERE chat_id = ? AND user_id = ?`,
      )
      .get(chatId, userId) as { riddles_started: number } | undefined;
    return row?.riddles_started ?? 0;
  }

  recordRoundResult(params: {
    chatId: string;
    userId: string;
    heroId: number;
    pointsEarned: number;
    hintsUsed: number;
    elapsedMs: number;
    difficultyMultiplier: number;
    streakAfter: number;
    periodWeek: string;
    periodMonth: string;
  }): void {
    this.db
      .prepare(
        `INSERT INTO round_results
         (chat_id, user_id, hero_id, points_earned, hints_used, elapsed_ms,
          difficulty_multiplier, streak_after, won_at, period_week, period_month)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        params.chatId,
        params.userId,
        params.heroId,
        params.pointsEarned,
        params.hintsUsed,
        params.elapsedMs,
        params.difficultyMultiplier,
        params.streakAfter,
        Date.now(),
        params.periodWeek,
        params.periodMonth,
      );
  }

  getLeaderboard(chatId: string, limit = 10): ScoreRow[] {
    return this.db
      .prepare(
        `SELECT s.chat_id, s.user_id, s.username,
                COALESCE(np.current_nickname, s.display_name) AS display_name,
                s.points, s.wins, s.current_streak, s.best_streak, s.riddles_started
         FROM scores s
         LEFT JOIN nick_profiles np ON np.user_id = s.user_id
         WHERE s.chat_id = ?
         ORDER BY s.points DESC, s.wins DESC
         LIMIT ?`,
      )
      .all(chatId, limit) as ScoreRow[];
  }

  getLeaderboardForPeriod(
    chatId: string,
    periodType: "week" | "month",
    periodKey: string,
    limit = 10,
  ): PeriodLeaderboardRow[] {
    const col = periodType === "week" ? "period_week" : "period_month";
    return this.db
      .prepare(
        `SELECT rr.user_id,
                COALESCE(np.current_nickname, s.display_name, rr.user_id) AS display_name,
                SUM(rr.points_earned) AS points,
                COUNT(*) AS wins
         FROM round_results rr
         LEFT JOIN scores s ON s.chat_id = rr.chat_id AND s.user_id = rr.user_id
         LEFT JOIN nick_profiles np ON np.user_id = rr.user_id
         WHERE rr.chat_id = ? AND rr.${col} = ?
         GROUP BY rr.user_id
         ORDER BY points DESC, wins DESC, MAX(rr.won_at) DESC
         LIMIT ?`,
      )
      .all(chatId, periodKey, limit) as PeriodLeaderboardRow[];
  }

  getPeriodLeader(
    chatId: string,
    periodType: "week" | "month",
    periodKey: string,
  ): PeriodLeaderboardRow | undefined {
    return this.getLeaderboardForPeriod(chatId, periodType, periodKey, 1)[0];
  }

  getUserScore(chatId: string, userId: string): ScoreRow | undefined {
    return this.db
      .prepare(
        `SELECT ${SCORE_COLUMNS}
         FROM scores WHERE chat_id = ? AND user_id = ?`,
      )
      .get(chatId, userId) as ScoreRow | undefined;
  }

  /** Ник → имя из scores → имя из nick_profiles → @username → «Игрок». */
  getPlayerDisplayName(chatId: string, userId: string): string {
    const row = this.db
      .prepare(
        `SELECT COALESCE(
           np.current_nickname,
           s.display_name,
           np.display_name,
           CASE WHEN np.username IS NOT NULL AND np.username != '' THEN '@' || np.username END,
           CASE WHEN s.username IS NOT NULL AND s.username != '' THEN '@' || s.username END
         ) AS name
         FROM (SELECT ? AS user_id) AS u
         LEFT JOIN scores s ON s.chat_id = ? AND s.user_id = u.user_id
         LEFT JOIN nick_profiles np ON np.user_id = u.user_id`,
      )
      .get(userId, chatId) as { name: string | null } | undefined;

    const name = row?.name?.trim();
    return name && name.length > 0 ? name : "Игрок";
  }

  getAllChatIds(): string[] {
    const fromScores = this.db
      .prepare(`SELECT DISTINCT chat_id FROM scores`)
      .all() as { chat_id: string }[];
    const fromResults = this.db
      .prepare(`SELECT DISTINCT chat_id FROM round_results`)
      .all() as { chat_id: string }[];
    return [
      ...new Set([
        ...fromScores.map((r) => r.chat_id),
        ...fromResults.map((r) => r.chat_id),
      ]),
    ];
  }

  isFirstWinInChat(chatId: string, userId: string): boolean {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS c FROM round_results WHERE chat_id = ? AND user_id = ?`,
      )
      .get(chatId, userId) as { c: number };
    return row.c <= 1;
  }

  countWinsNoHints(chatId: string, userId: string): number {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS c FROM round_results
         WHERE chat_id = ? AND user_id = ? AND hints_used = 0`,
      )
      .get(chatId, userId) as { c: number };
    return row.c;
  }

  countWinsOnHardHeroes(chatId: string, userId: string): number {
    const hardIds = heroes
      .filter((h) => h.difficulty === "hard" || h.difficulty === "expert")
      .map((h) => h.id);
    if (hardIds.length === 0) return 0;
    const placeholders = hardIds.map(() => "?").join(",");
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS c FROM round_results
         WHERE chat_id = ? AND user_id = ? AND hero_id IN (${placeholders})`,
      )
      .get(chatId, userId, ...hardIds) as { c: number };
    return row.c;
  }

  countDistinctPrimaryAttrs(chatId: string, userId: string): number {
    const rows = this.db
      .prepare(
        `SELECT DISTINCT hero_id FROM round_results WHERE chat_id = ? AND user_id = ?`,
      )
      .all(chatId, userId) as { hero_id: number }[];
    const attrs = new Set<string>();
    for (const row of rows) {
      const hero = heroes.find((h) => h.id === row.hero_id);
      if (hero) attrs.add(hero.primary_attr);
    }
    return attrs.size;
  }

  countChatWins(chatId: string, userId: string): number {
    const row = this.db
      .prepare(
        `SELECT wins FROM scores WHERE chat_id = ? AND user_id = ?`,
      )
      .get(chatId, userId) as { wins: number } | undefined;
    return row?.wins ?? 0;
  }

  unlockAchievement(
    chatId: string,
    userId: string,
    achievementId: string,
    unlockedAt: number,
  ): void {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO user_achievements (chat_id, user_id, achievement_id, unlocked_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(chatId, userId, achievementId, unlockedAt);
  }

  getUserAchievements(
    chatId: string,
    userId: string,
  ): UserAchievementRow[] {
    return this.db
      .prepare(
        `SELECT achievement_id, unlocked_at FROM user_achievements
         WHERE chat_id = ? AND user_id = ?
         ORDER BY unlocked_at ASC`,
      )
      .all(chatId, userId) as UserAchievementRow[];
  }

  getWeeklyTitle(
    chatId: string,
    userId: string,
  ): WeeklyTitleRow | undefined {
    return this.db
      .prepare(
        `SELECT title, week_key, expires_at FROM weekly_titles
         WHERE chat_id = ? AND user_id = ?`,
      )
      .get(chatId, userId) as WeeklyTitleRow | undefined;
  }

  setWeeklyTitle(
    chatId: string,
    userId: string,
    title: string,
    weekKey: string,
    expiresAt: number,
  ): void {
    this.db
      .prepare(
        `INSERT INTO weekly_titles (chat_id, user_id, title, week_key, expires_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(chat_id, user_id) DO UPDATE SET
           title = excluded.title,
           week_key = excluded.week_key,
           expires_at = excluded.expires_at`,
      )
      .run(chatId, userId, title, weekKey, expiresAt);
  }

  deleteExpiredWeeklyTitles(): void {
    this.db
      .prepare(`DELETE FROM weekly_titles WHERE expires_at <= ?`)
      .run(Date.now());
  }

  grantBonusReroll(userId: string, timeZone: string): void {
    const date = todayKey(timeZone);
    const now = Date.now();
    this.db
      .prepare(
        `INSERT INTO nick_queues (user_id, nick_date, queue, bonus_rerolls, updated_at)
         VALUES (?, ?, '[]', 1, ?)
         ON CONFLICT(user_id, nick_date) DO UPDATE SET
           bonus_rerolls = bonus_rerolls + 1,
           updated_at = excluded.updated_at`,
      )
      .run(userId, date, now);
  }

  consumeBonusReroll(userId: string, nickDate: string): boolean {
    const row = this.db
      .prepare(
        `SELECT bonus_rerolls FROM nick_queues WHERE user_id = ? AND nick_date = ?`,
      )
      .get(userId, nickDate) as { bonus_rerolls: number } | undefined;
    if (!row || row.bonus_rerolls <= 0) return false;
    this.db
      .prepare(
        `UPDATE nick_queues SET bonus_rerolls = bonus_rerolls - 1, updated_at = ?
         WHERE user_id = ? AND nick_date = ?`,
      )
      .run(Date.now(), userId, nickDate);
    return true;
  }

  getBonusRerolls(userId: string, nickDate: string): number {
    const row = this.db
      .prepare(
        `SELECT bonus_rerolls FROM nick_queues WHERE user_id = ? AND nick_date = ?`,
      )
      .get(userId, nickDate) as { bonus_rerolls: number } | undefined;
    return row?.bonus_rerolls ?? 0;
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

  getNickHistory(
    userId: string,
    limit = 20,
  ): { nickname: string; nick_date: string; created_at: number }[] {
    return this.db
      .prepare(
        `SELECT nickname, nick_date, created_at FROM nick_history
         WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
      )
      .all(userId, limit) as {
      nickname: string;
      nick_date: string;
      created_at: number;
    }[];
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
      .prepare(
        `SELECT current_nickname, previous_nicks FROM nick_profiles WHERE user_id = ?`,
      )
      .get(userId) as
      | { current_nickname: string; previous_nicks: string }
      | undefined;

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

  private seedInsultsIfEmpty(): void {
    const now = Date.now();
    const stmt = this.db.prepare(
      `INSERT OR IGNORE INTO insults (text, created_at) VALUES (?, ?)`,
    );
    let added = 0;
    for (const text of INSULTS_SEED) {
      const r = stmt.run(text, now);
      if (r.changes > 0) added++;
    }
    if (added > 0) {
      console.log(`[Insult] Seed sync: +${added} (total seed ${INSULTS_SEED.length})`);
    }
  }

  countInsults(): number {
    const row = this.db
      .prepare(`SELECT COUNT(*) AS c FROM insults`)
      .get() as { c: number };
    return row.c;
  }

  getAllInsultTexts(): string[] {
    return (
      this.db.prepare(`SELECT text FROM insults ORDER BY id`).all() as {
        text: string;
      }[]
    ).map((r) => r.text);
  }

  addInsults(texts: string[]): number {
    const now = Date.now();
    const stmt = this.db.prepare(
      `INSERT OR IGNORE INTO insults (text, created_at) VALUES (?, ?)`,
    );
    let added = 0;
    for (const text of texts) {
      const r = stmt.run(text.trim(), now);
      if (r.changes > 0) added++;
    }
    return added;
  }

  hasInsultRefillToday(refillDate: string): boolean {
    return !!this.db
      .prepare(`SELECT 1 FROM insult_refill_log WHERE refill_date = ?`)
      .get(refillDate);
  }

  markInsultRefillToday(refillDate: string, addedCount: number): void {
    this.db
      .prepare(
        `INSERT INTO insult_refill_log (refill_date, added_count, created_at)
         VALUES (?, ?, ?)
         ON CONFLICT(refill_date) DO UPDATE SET
           added_count = excluded.added_count,
           created_at = excluded.created_at`,
      )
      .run(refillDate, addedCount, Date.now());
  }

  pickRandomInsult(chatId: string): string | null {
    const recent = this.db
      .prepare(
        `SELECT insult_id FROM chat_taunt_history
         WHERE chat_id = ? ORDER BY used_at DESC LIMIT 8`,
      )
      .all(chatId) as { insult_id: number }[];
    const excludeIds = recent.map((r) => r.insult_id);

    let row: { id: number; text: string } | undefined;
    if (excludeIds.length > 0) {
      const placeholders = excludeIds.map(() => "?").join(",");
      row = this.db
        .prepare(
          `SELECT id, text FROM insults
           WHERE id NOT IN (${placeholders})
           ORDER BY RANDOM() LIMIT 1`,
        )
        .get(...excludeIds) as { id: number; text: string } | undefined;
    }
    if (!row) {
      row = this.db
        .prepare(`SELECT id, text FROM insults ORDER BY RANDOM() LIMIT 1`)
        .get() as { id: number; text: string } | undefined;
    }
    if (!row) return null;

    this.db
      .prepare(
        `INSERT INTO chat_taunt_history (chat_id, insult_id, used_at) VALUES (?, ?, ?)`,
      )
      .run(chatId, row.id, Date.now());
    return row.text;
  }

  incrementWrongGuesses(chatId: string): void {
    this.db
      .prepare(
        `UPDATE rounds SET wrong_guesses = wrong_guesses + 1 WHERE chat_id = ? AND winner_user_id IS NULL`,
      )
      .run(chatId);
  }

  incrementRoundTaunts(chatId: string): void {
    this.db
      .prepare(`UPDATE rounds SET taunts_sent = taunts_sent + 1 WHERE chat_id = ?`)
      .run(chatId);
  }

  getTauntContext(chatId: string): {
    wrongGuesses: number;
    hintsUsed: number;
    tauntsSent: number;
  } {
    const round = this.getActiveRound(chatId);
    return {
      wrongGuesses: round?.wrong_guesses ?? 0,
      hintsUsed: round?.hints_used ?? 0,
      tauntsSent: round?.taunts_sent ?? 0,
    };
  }

  private seedWorkTaunts(): void {
    const now = Date.now();
    const stmt = this.db.prepare(
      `INSERT OR IGNORE INTO work_taunts (text, time_slot, created_at) VALUES (?, ?, ?)`,
    );
    let added = 0;
    for (const item of FLOOD_TAUNTS_SEED) {
      const r = stmt.run(item.text, item.slot, now);
      if (r.changes > 0) added++;
    }
    if (added > 0) {
      console.log(`[FloodTaunt] Seed sync: +${added} flood taunts`);
    }
  }

  recordChatRoundStart(
    chatId: string,
    timestampMs: number,
    windowMs: number,
  ): void {
    const row = this.db
      .prepare(`SELECT round_starts FROM chat_round_activity WHERE chat_id = ?`)
      .get(chatId) as { round_starts: string } | undefined;

    let starts: number[] = [];
    if (row) {
      try {
        const parsed = JSON.parse(row.round_starts) as unknown;
        if (Array.isArray(parsed)) {
          starts = parsed.filter((x): x is number => typeof x === "number");
        }
      } catch {
        starts = [];
      }
    }

    starts.push(timestampMs);
    const cutoff = timestampMs - windowMs;
    starts = starts.filter((t) => t >= cutoff).slice(-30);

    this.db
      .prepare(
        `INSERT INTO chat_round_activity (chat_id, round_starts, work_taunt_hour_key, work_taunts_sent_hour)
         VALUES (?, ?, NULL, 0)
         ON CONFLICT(chat_id) DO UPDATE SET round_starts = excluded.round_starts`,
      )
      .run(chatId, JSON.stringify(starts));
  }

  countRecentRounds(
    chatId: string,
    windowMs: number,
    nowMs: number,
  ): number {
    const row = this.db
      .prepare(`SELECT round_starts FROM chat_round_activity WHERE chat_id = ?`)
      .get(chatId) as { round_starts: string } | undefined;
    if (!row) return 1;

    try {
      const starts = JSON.parse(row.round_starts) as unknown;
      if (!Array.isArray(starts)) return 1;
      const cutoff = nowMs - windowMs;
      return starts.filter((t): t is number => typeof t === "number" && t >= cutoff)
        .length;
    } catch {
      return 1;
    }
  }

  getWorkTauntsSentInHour(chatId: string, hourKey: string): number {
    const row = this.db
      .prepare(
        `SELECT work_taunt_hour_key, work_taunts_sent_hour FROM chat_round_activity WHERE chat_id = ?`,
      )
      .get(chatId) as
      | { work_taunt_hour_key: string | null; work_taunts_sent_hour: number }
      | undefined;
    if (!row || row.work_taunt_hour_key !== hourKey) return 0;
    return row.work_taunts_sent_hour;
  }

  incrementWorkTauntsSent(chatId: string, hourKey: string): void {
    const row = this.db
      .prepare(
        `SELECT work_taunt_hour_key FROM chat_round_activity WHERE chat_id = ?`,
      )
      .get(chatId) as { work_taunt_hour_key: string | null } | undefined;

    if (!row) {
      this.db
        .prepare(
          `INSERT INTO chat_round_activity (chat_id, round_starts, work_taunt_hour_key, work_taunts_sent_hour)
           VALUES (?, '[]', ?, 1)`,
        )
        .run(chatId, hourKey);
      return;
    }

    if (row.work_taunt_hour_key === hourKey) {
      this.db
        .prepare(
          `UPDATE chat_round_activity SET work_taunts_sent_hour = work_taunts_sent_hour + 1 WHERE chat_id = ?`,
        )
        .run(chatId);
    } else {
      this.db
        .prepare(
          `UPDATE chat_round_activity SET work_taunt_hour_key = ?, work_taunts_sent_hour = 1 WHERE chat_id = ?`,
        )
        .run(hourKey, chatId);
    }
  }

  pickRandomFloodTaunt(
    chatId: string,
    slot: FloodTauntSlot,
    isWorkHours: boolean,
  ): string | null {
    const recent = this.db
      .prepare(
        `SELECT work_taunt_id FROM chat_work_taunt_history
         WHERE chat_id = ? ORDER BY used_at DESC LIMIT 6`,
      )
      .all(chatId) as { work_taunt_id: number }[];
    const excludeIds = recent.map((r) => r.work_taunt_id);

    const slots: FloodTauntSlot[] = isWorkHours
      ? [slot, "work"]
      : [slot, "leisure"];

    for (const s of slots) {
      let row: { id: number; text: string } | undefined;
      if (excludeIds.length > 0) {
        const ph = excludeIds.map(() => "?").join(",");
        row = this.db
          .prepare(
            `SELECT id, text FROM work_taunts
             WHERE time_slot = ? AND id NOT IN (${ph})
             ORDER BY RANDOM() LIMIT 1`,
          )
          .get(s, ...excludeIds) as { id: number; text: string } | undefined;
      } else {
        row = this.db
          .prepare(
            `SELECT id, text FROM work_taunts WHERE time_slot = ? ORDER BY RANDOM() LIMIT 1`,
          )
          .get(s) as { id: number; text: string } | undefined;
      }
      if (row) {
        this.db
          .prepare(
            `INSERT INTO chat_work_taunt_history (chat_id, work_taunt_id, used_at) VALUES (?, ?, ?)`,
          )
          .run(chatId, row.id, Date.now());
        return row.text;
      }
    }

    const fallback = this.db
      .prepare(`SELECT id, text FROM work_taunts ORDER BY RANDOM() LIMIT 1`)
      .get() as { id: number; text: string } | undefined;
    if (!fallback) return null;

    this.db
      .prepare(
        `INSERT INTO chat_work_taunt_history (chat_id, work_taunt_id, used_at) VALUES (?, ?, ?)`,
      )
      .run(chatId, fallback.id, Date.now());
    return fallback.text;
  }

  ensureWallet(userId: string): WalletRow {
    const existing = this.db
      .prepare(
        `SELECT user_id, gold, battle_mmr, created_at FROM player_wallets WHERE user_id = ?`,
      )
      .get(userId) as WalletRow | undefined;
    if (existing) return existing;

    const now = Date.now();
    this.db
      .prepare(
        `INSERT INTO player_wallets (user_id, gold, battle_mmr, created_at) VALUES (?, 100, 1000, ?)`,
      )
      .run(userId, now);
    return { user_id: userId, gold: 100, battle_mmr: 1000, created_at: now };
  }

  adjustGold(
    userId: string,
    amount: number,
    reason: string,
    chatId?: string,
    refId?: string,
  ): number {
    this.ensureWallet(userId);
    this.db
      .prepare(`UPDATE player_wallets SET gold = gold + ? WHERE user_id = ?`)
      .run(amount, userId);
    this.db
      .prepare(
        `INSERT INTO gold_ledger (user_id, chat_id, amount, reason, ref_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(userId, chatId ?? null, amount, reason, refId ?? null, Date.now());
    return this.ensureWallet(userId).gold;
  }

  adjustBattleMmr(userId: string, delta: number): number {
    this.ensureWallet(userId);
    this.db
      .prepare(
        `UPDATE player_wallets SET battle_mmr = MAX(0, battle_mmr + ?) WHERE user_id = ?`,
      )
      .run(delta, userId);
    return this.ensureWallet(userId).battle_mmr;
  }

  getBattleMmrLeaderboard(limit = 10): BattleMmrRow[] {
    const rows = this.db
      .prepare(
        `SELECT user_id, battle_mmr FROM player_wallets ORDER BY battle_mmr DESC LIMIT ?`,
      )
      .all(limit) as { user_id: string; battle_mmr: number }[];

    return rows.map((r) => {
      const score = this.db
        .prepare(
          `SELECT display_name FROM scores WHERE user_id = ? ORDER BY points DESC LIMIT 1`,
        )
        .get(r.user_id) as { display_name: string } | undefined;
      return {
        user_id: r.user_id,
        display_name: score?.display_name ?? r.user_id,
        battle_mmr: r.battle_mmr,
      };
    });
  }

  incrementChatUnlock(
    chatId: string,
    entityType: "hero" | "item",
    entityId: number,
    requiredGuesses: number,
  ): ChatUnlockRow {
    const now = Date.now();
    this.db
      .prepare(
        `INSERT INTO chat_unlocks (chat_id, entity_type, entity_id, guess_count, unlocked_at)
         VALUES (?, ?, ?, 1, NULL)
         ON CONFLICT(chat_id, entity_type, entity_id) DO UPDATE SET
           guess_count = guess_count + 1,
           unlocked_at = CASE
             WHEN unlocked_at IS NOT NULL THEN unlocked_at
             WHEN guess_count + 1 >= ? THEN ?
             ELSE NULL
           END`,
      )
      .run(chatId, entityType, entityId, requiredGuesses, now);
    return this.getChatUnlock(chatId, entityType, entityId)!;
  }

  getChatUnlock(
    chatId: string,
    entityType: string,
    entityId: number,
  ): ChatUnlockRow | undefined {
    return this.db
      .prepare(
        `SELECT chat_id, entity_type, entity_id, guess_count, unlocked_at
         FROM chat_unlocks WHERE chat_id = ? AND entity_type = ? AND entity_id = ?`,
      )
      .get(chatId, entityType, entityId) as ChatUnlockRow | undefined;
  }

  isChatUnlocked(
    chatId: string,
    entityType: string,
    entityId: number,
    requiredGuesses: number,
  ): boolean {
    if (requiredGuesses <= 0) return true;
    const row = this.getChatUnlock(chatId, entityType, entityId);
    return (row?.guess_count ?? 0) >= requiredGuesses || row?.unlocked_at != null;
  }

  getPlayerHero(
    chatId: string,
    userId: string,
    heroId: number,
  ): PlayerHeroRow | undefined {
    return this.db
      .prepare(
        `SELECT chat_id, user_id, hero_id, level, xp, equipped_items
         FROM player_heroes WHERE chat_id = ? AND user_id = ? AND hero_id = ?`,
      )
      .get(chatId, userId, heroId) as PlayerHeroRow | undefined;
  }

  getPlayerHeroes(chatId: string, userId: string): PlayerHeroRow[] {
    return this.db
      .prepare(
        `SELECT chat_id, user_id, hero_id, level, xp, equipped_items
         FROM player_heroes WHERE chat_id = ? AND user_id = ? ORDER BY hero_id`,
      )
      .all(chatId, userId) as PlayerHeroRow[];
  }

  /** Игроки чата, у которых есть хотя бы один герой в коллекции. */
  getChatHeroOwners(
    chatId: string,
    excludeUserId: string,
  ): { user_id: string; display_name: string }[] {
    return this.db
      .prepare(
        `SELECT DISTINCT ph.user_id,
                COALESCE(np.current_nickname, s.display_name, ph.user_id) AS display_name
         FROM player_heroes ph
         LEFT JOIN scores s ON s.chat_id = ph.chat_id AND s.user_id = ph.user_id
         LEFT JOIN nick_profiles np ON np.user_id = ph.user_id
         WHERE ph.chat_id = ? AND ph.user_id != ?
         ORDER BY display_name COLLATE NOCASE`,
      )
      .all(chatId, excludeUserId) as { user_id: string; display_name: string }[];
  }

  addPlayerHero(
    chatId: string,
    userId: string,
    heroId: number,
  ): PlayerHeroRow {
    this.db
      .prepare(
        `INSERT INTO player_heroes (chat_id, user_id, hero_id, level, xp, equipped_items)
         VALUES (?, ?, ?, 1, 0, '[]')
         ON CONFLICT(chat_id, user_id, hero_id) DO NOTHING`,
      )
      .run(chatId, userId, heroId);
    return this.getPlayerHero(chatId, userId, heroId)!;
  }

  addHeroXp(
    chatId: string,
    userId: string,
    heroId: number,
    xpGain: number,
  ): PlayerHeroRow {
    const row = this.getPlayerHero(chatId, userId, heroId);
    if (!row) throw new Error("hero not owned");
    const newXp = row.xp + xpGain;
    const newLevel = Math.min(15, Math.floor(newXp / 50) + 1);
    this.db
      .prepare(
        `UPDATE player_heroes SET xp = ?, level = ? WHERE chat_id = ? AND user_id = ? AND hero_id = ?`,
      )
      .run(newXp, newLevel, chatId, userId, heroId);
    return this.getPlayerHero(chatId, userId, heroId)!;
  }

  setEquippedItems(
    chatId: string,
    userId: string,
    heroId: number,
    items: number[],
  ): void {
    this.db
      .prepare(
        `UPDATE player_heroes SET equipped_items = ? WHERE chat_id = ? AND user_id = ? AND hero_id = ?`,
      )
      .run(JSON.stringify(items), chatId, userId, heroId);
  }

  deletePlayerHero(
    chatId: string,
    userId: string,
    heroId: number,
  ): boolean {
    const result = this.db
      .prepare(
        `DELETE FROM player_heroes WHERE chat_id = ? AND user_id = ? AND hero_id = ?`,
      )
      .run(chatId, userId, heroId);
    return result.changes > 0;
  }

  private migratePlayerItemsTable(): void {
    const cols = this.db
      .prepare(`PRAGMA table_info(player_items)`)
      .all() as { name: string }[];
    if (cols.length === 0) return;
    const names = new Set(cols.map((c) => c.name));
    if (names.has("slot") && names.has("uses_remaining")) return;

    this.db.exec(`
      DROP TABLE IF EXISTS player_items;
      CREATE TABLE player_items (
        chat_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        slot INTEGER NOT NULL CHECK(slot >= 0 AND slot < 3),
        item_id INTEGER NOT NULL,
        uses_remaining INTEGER NOT NULL,
        PRIMARY KEY (chat_id, user_id, slot)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_player_items_unique_item
        ON player_items(chat_id, user_id, item_id);
    `);
  }

  getPlayerItemSlots(
    chatId: string,
    userId: string,
  ): { slot: number; item_id: number; uses_remaining: number }[] {
    return this.db
      .prepare(
        `SELECT slot, item_id, uses_remaining FROM player_items
         WHERE chat_id = ? AND user_id = ?
         ORDER BY slot`,
      )
      .all(chatId, userId) as {
      slot: number;
      item_id: number;
      uses_remaining: number;
    }[];
  }

  countFilledItemSlots(chatId: string, userId: string): number {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS c FROM player_items WHERE chat_id = ? AND user_id = ?`,
      )
      .get(chatId, userId) as { c: number };
    return row.c;
  }

  findFirstEmptyItemSlot(chatId: string, userId: string): number | null {
    const used = new Set(
      this.getPlayerItemSlots(chatId, userId).map((r) => r.slot),
    );
    for (let slot = 0; slot < 3; slot++) {
      if (!used.has(slot)) return slot;
    }
    return null;
  }

  ownsItem(chatId: string, userId: string, itemId: number): boolean {
    const row = this.db
      .prepare(
        `SELECT 1 FROM player_items
         WHERE chat_id = ? AND user_id = ? AND item_id = ?`,
      )
      .get(chatId, userId, itemId);
    return !!row;
  }

  setPlayerItemSlot(
    chatId: string,
    userId: string,
    slot: number,
    itemId: number,
    usesRemaining: number,
  ): void {
    this.db
      .prepare(
        `INSERT INTO player_items (chat_id, user_id, slot, item_id, uses_remaining)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(chatId, userId, slot, itemId, usesRemaining);
  }

  removePlayerItemSlot(
    chatId: string,
    userId: string,
    itemId: number,
  ): void {
    this.db
      .prepare(
        `DELETE FROM player_items
         WHERE chat_id = ? AND user_id = ? AND item_id = ?`,
      )
      .run(chatId, userId, itemId);
  }

  updateItemUses(
    chatId: string,
    userId: string,
    itemId: number,
    usesRemaining: number,
  ): void {
    if (usesRemaining <= 0) {
      this.removePlayerItemSlot(chatId, userId, itemId);
      return;
    }
    this.db
      .prepare(
        `UPDATE player_items SET uses_remaining = ?
         WHERE chat_id = ? AND user_id = ? AND item_id = ?`,
      )
      .run(usesRemaining, chatId, userId, itemId);
  }

  createBattle(
    chatId: string,
    challengerId: string,
    defenderId: string,
    state: string,
    stateJson: string,
  ): BattleRow {
    const now = Date.now();
    const result = this.db
      .prepare(
        `INSERT INTO battles (chat_id, challenger_id, defender_id, state, state_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(chatId, challengerId, defenderId, state, stateJson, now);
    return this.getBattle(Number(result.lastInsertRowid))!;
  }

  getBattle(id: number): BattleRow | undefined {
    return this.db
      .prepare(`SELECT * FROM battles WHERE id = ?`)
      .get(id) as BattleRow | undefined;
  }

  getBattleByChat(chatId: string): BattleRow | undefined {
    return this.db
      .prepare(`SELECT * FROM battles WHERE chat_id = ?`)
      .get(chatId) as BattleRow | undefined;
  }

  updateBattle(
    id: number,
    patch: Partial<
      Pick<
        BattleRow,
        | "message_id"
        | "message_chat_id"
        | "state"
        | "turn"
        | "state_json"
        | "winner_id"
      >
    >,
  ): void {
    const fields: string[] = [];
    const values: unknown[] = [];
    for (const [key, val] of Object.entries(patch)) {
      if (val !== undefined) {
        fields.push(`${key} = ?`);
        values.push(val);
      }
    }
    if (fields.length === 0) return;
    values.push(id);
    this.db
      .prepare(`UPDATE battles SET ${fields.join(", ")} WHERE id = ?`)
      .run(...values);
  }

  deleteBattle(chatId: string): void {
    this.db.prepare(`DELETE FROM battles WHERE chat_id = ?`).run(chatId);
  }

  close(): void {
    this.db.close();
  }
}
