import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

// Todo vive en un único archivo SQLite: no hay servidor de base de datos que mantener.
const DATA_DIR = path.resolve(process.env.DATA_DIR || 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(path.join(DATA_DIR, 'fino.db'));

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 3000;

  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY,
    username   TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name       TEXT NOT NULL,
    pass       TEXT NOT NULL,
    palette    TEXT NOT NULL DEFAULT 'bordo',
    mode       TEXT NOT NULL DEFAULT 'auto',
    carry      INTEGER NOT NULL DEFAULT 1,
    onboarded  INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    seen_at    INTEGER NOT NULL,
    agent      TEXT
  );

  CREATE TABLE IF NOT EXISTS categories (
    id      INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name    TEXT NOT NULL,
    color   INTEGER NOT NULL DEFAULT 0,
    sort    INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS months (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ym      TEXT NOT NULL,
    budget  INTEGER,
    PRIMARY KEY (user_id, ym)
  );

  CREATE TABLE IF NOT EXISTS movements (
    id          INTEGER PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        TEXT NOT NULL CHECK (type IN ('gasto', 'ingreso')),
    amount      INTEGER NOT NULL CHECK (amount > 0),
    description TEXT NOT NULL DEFAULT '',
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    date        TEXT NOT NULL,
    created_at  INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS movements_user_date ON movements(user_id, date);

  CREATE TABLE IF NOT EXISTS push_subs (
    endpoint   TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    p256dh     TEXT NOT NULL,
    auth       TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

export function tx(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export const meta = {
  get(key) {
    const row = db.prepare('SELECT value FROM meta WHERE key = ?').get(key);
    return row ? row.value : null;
  },
  set(key, value) {
    db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
  },
};
