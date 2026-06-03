CREATE TABLE IF NOT EXISTS scores (
  chat_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  username TEXT,
  display_name TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
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
  hints_used INTEGER NOT NULL DEFAULT 0
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
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, nick_date)
);

CREATE TABLE IF NOT EXISTS chat_riddle_history (
  chat_id TEXT PRIMARY KEY,
  hero_ids TEXT NOT NULL DEFAULT '[]',
  updated_at INTEGER NOT NULL
);
