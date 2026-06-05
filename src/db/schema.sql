CREATE TABLE IF NOT EXISTS scores (
  chat_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  username TEXT,
  display_name TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  best_streak INTEGER NOT NULL DEFAULT 0,
  riddles_started INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (chat_id, user_id)
);

CREATE TABLE IF NOT EXISTS rounds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id TEXT NOT NULL UNIQUE,
  hero_id INTEGER NOT NULL,
  started_by TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  winner_user_id TEXT,
  riddle TEXT,
  answer_variants TEXT,
  hints_used INTEGER NOT NULL DEFAULT 0,
  round_mode TEXT NOT NULL DEFAULT 'text',
  emo_skills TEXT,
  hinted_skills TEXT NOT NULL DEFAULT '[]',
  wrong_guesses INTEGER NOT NULL DEFAULT 0,
  taunts_sent INTEGER NOT NULL DEFAULT 0
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

CREATE TABLE IF NOT EXISTS daily_nicks (
  user_id TEXT NOT NULL,
  nick_date TEXT NOT NULL,
  nickname TEXT NOT NULL,
  display_name TEXT,
  username TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, nick_date)
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
