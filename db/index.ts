// db/index.ts
import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;
let readyPromise: Promise<void> | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (!db) throw new Error('DB not initialized. Call initDb() first.');
  return db;
}

// Idempotent init that runs once and reuses the same DB handle
export function initDb(): Promise<void> {
  if (readyPromise) return readyPromise;

  readyPromise = (async () => {
    try {
      db = await SQLite.openDatabaseAsync('remindmeplus.db');

      // Create tables if they don't exist (including photo URI for people)
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS reminders (
          id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          icon TEXT,
          schedule_json TEXT,
          person_id TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS people (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          relation TEXT,
          notes TEXT,
          photo_uri TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // try to add photo_uri if older DB existed (ignore errors)
      try {
        await db.execAsync(`ALTER TABLE people ADD COLUMN photo_uri TEXT;`);
      } catch (e) {
        // ignore if column already exists
      }

      console.log('✅ DB ready');
    } catch (err) {
      console.error('DB init failed', err);
      readyPromise = null; // reset so retry works
      throw err;
    }
  })();

  return readyPromise;
}
