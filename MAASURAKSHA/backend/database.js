/**
 * MaaSuraksha — database.js
 * SQLite via sql.js (pure JS/WASM — no native build tools needed).
 *
 * The database is persisted to disk at DB_PATH and loaded on startup.
 * All writes call db.save() to flush back to disk.
 */

'use strict';

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const DB_PATH = path.resolve(__dirname, process.env.DB_PATH || './maasuraksha.db');

let db;       // sql.js Database instance (synchronous API)
let sqlJs;    // loaded module

/* ── Bootstrap (called once at startup) ───────────────────────── */
async function initDatabase() {
  sqlJs = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    db = new sqlJs.Database(buf);
    console.log('[DB] Loaded existing database →', DB_PATH);
  } else {
    db = new sqlJs.Database();
    console.log('[DB] Created new database →', DB_PATH);
  }

  // Pragmas
  db.run('PRAGMA foreign_keys = ON;');
  db.run('PRAGMA journal_mode = MEMORY;');

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT    NOT NULL,
      username      TEXT    UNIQUE,
      password_hash TEXT,
      role          TEXT    NOT NULL,
      phone         TEXT,
      village       TEXT,
      district      TEXT,
      state         TEXT    DEFAULT 'Bihar',
      language      TEXT    DEFAULT 'hi',
      created_at    TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS patients (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         INTEGER NOT NULL,
      weeks_pregnant  INTEGER NOT NULL DEFAULT 20,
      due_date        TEXT,
      doctor_id       INTEGER,
      asha_id         INTEGER,
      risk_level      TEXT    DEFAULT 'low',
      blood_group     TEXT,
      gravida         INTEGER DEFAULT 1,
      para            INTEGER DEFAULT 0,
      known_conditions TEXT   DEFAULT '[]',
      device_id       TEXT,
      created_at      TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS vitals (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id  INTEGER NOT NULL,
      recorded_at TEXT    NOT NULL DEFAULT (datetime('now')),
      hr          REAL,
      spo2        REAL,
      systolic    REAL,
      diastolic   REAL,
      temperature REAL,
      hrv         REAL,
      activity    TEXT    DEFAULT 'resting',
      synced      INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id   INTEGER NOT NULL,
      severity     TEXT NOT NULL,
      type         TEXT NOT NULL,
      message      TEXT NOT NULL,
      vitals_ref   INTEGER,
      triggered_at TEXT DEFAULT (datetime('now')),
      resolved     INTEGER DEFAULT 0,
      resolved_at  TEXT
    );

    CREATE TABLE IF NOT EXISTS checkins (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id      INTEGER NOT NULL,
      asha_id         INTEGER NOT NULL,
      checkin_date    TEXT    DEFAULT (date('now')),
      bp_done         INTEGER DEFAULT 0,
      weight_done     INTEGER DEFAULT 0,
      iron_taken      INTEGER DEFAULT 0,
      kick_count      INTEGER,
      edema_normal    INTEGER DEFAULT 1,
      diet_done       INTEGER DEFAULT 0,
      danger_screened INTEGER DEFAULT 0,
      app_synced      INTEGER DEFAULT 0,
      notes           TEXT    DEFAULT '',
      created_at      TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS medications (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id  INTEGER NOT NULL,
      name        TEXT    NOT NULL,
      dosage      TEXT,
      frequency   TEXT,
      start_date  TEXT    DEFAULT (date('now')),
      end_date    TEXT,
      active      INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id   INTEGER NOT NULL,
      doctor_id    INTEGER NOT NULL,
      scheduled_at TEXT    NOT NULL,
      type         TEXT    DEFAULT 'antenatal',
      status       TEXT    DEFAULT 'upcoming',
      notes        TEXT
    );
    CREATE TABLE IF NOT EXISTS user_input_data (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id   INTEGER NOT NULL,
      recorded_at  TEXT    DEFAULT (datetime('now')),
      headache     INTEGER DEFAULT 0,
      swelling     INTEGER DEFAULT 0,
      blurred_vision INTEGER DEFAULT 0,
      nausea       INTEGER DEFAULT 0,
      abdominal_pain INTEGER DEFAULT 0,
      fatigue      INTEGER DEFAULT 0,
      fever        INTEGER DEFAULT 0,
      reduced_fetal_movement INTEGER DEFAULT 0,
      notes        TEXT    DEFAULT '',
      severity     TEXT    DEFAULT 'mild'
    );

    CREATE TABLE IF NOT EXISTS nutrition_logs (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id   INTEGER NOT NULL,
      logged_at    TEXT    DEFAULT (datetime('now')),
      meal_type    TEXT    DEFAULT 'lunch',
      water_glasses INTEGER DEFAULT 0,
      iron_taken   INTEGER DEFAULT 0,
      folic_taken  INTEGER DEFAULT 0,
      calcium_taken INTEGER DEFAULT 0,
      fruits       INTEGER DEFAULT 0,
      vegetables   INTEGER DEFAULT 0,
      protein      INTEGER DEFAULT 0,
      dairy        INTEGER DEFAULT 0,
      notes        TEXT    DEFAULT ''
    );
  `);

  save();
  return db;
}

/* ── Persist to disk ─────────────────────────────────────────── */
function save() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

/* ── Query helpers (mirror better-sqlite3 API) ───────────────── */

/** Run a statement with no return rows, return lastInsertRowid */
function run(sql, params = []) {
  db.run(sql, params);
  const [[rowid]] = db.exec('SELECT last_insert_rowid()')[0]?.values || [[0]];
  save();
  return { lastInsertRowid: rowid };
}

/** Return all matching rows as plain objects */
function all(sql, params = []) {
  const result = db.exec(sql, params);
  if (!result.length) return [];
  const { columns, values } = result[0];
  return values.map(row => Object.fromEntries(columns.map((c, i) => [c, row[i]])));
}

/** Return first matching row or undefined */
function get(sql, params = []) {
  const rows = all(sql, params);
  return rows[0];
}

/** Run raw SQL (no return) */
function exec(sql) {
  db.run(sql);
  save();
}

module.exports = { initDatabase, run, all, get, exec, save };
