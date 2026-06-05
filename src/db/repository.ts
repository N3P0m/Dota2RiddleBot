import Database from "better-sqlite3";
import { heroes } from "../heroes/match.js";
import { todayKey } from "../game/nick-date.js";
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
  "id, chat_id, hero_id, started_by, started_at, winner_user_id, riddle, answer_variants, hints_used, round_mode, emo_skills, hinted_skills";

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
    `);

    const nickQueueCols = this.db
      .prepare(`PRAGMA table_info(nick_queues)`)
      .all() as { name: string }[];
    const nickQueueNames = new Set(nickQueueCols.map((c) => c.name));
    if (!nickQueueNames.has("bonus_rerolls")) {
      this.db.exec(
        `ALTER TABLE nick_queues ADD COLUMN bonus_rerolls INTEGER NOT NULL DEFAULT 0`,
      );
    }

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
        `INSERT INTO rounds (chat_id, hero_id, started_by, started_at, riddle, answer_variants, hints_used, winner_user_id, round_mode, emo_skills, hinted_skills)
         VALUES (?, ?, ?, ?, ?, ?, 0, NULL, ?, ?, '[]')
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
           hinted_skills = '[]'`,
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

  close(): void {
    this.db.close();
  }
}
