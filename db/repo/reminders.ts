// db/repo/reminders.ts
import { nanoid } from 'nanoid/non-secure';
import { getDb, initDb } from '../index';

export interface ScheduleDaily { type: 'daily'; times: string[]; }
export interface Reminder {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  schedule_json?: string;
  person_id?: string | null;
  person_name?: string | null;   // joined from people
  person_photo?: string | null;  // joined from people (photo_uri)
  created_at?: string;
}

export async function listReminders(): Promise<Reminder[]> {
  await initDb();
  const db = getDb();
  try {
    // join to bring person info into the reminder rows
    const rows = await db.getAllAsync(`
      SELECT r.*, p.name AS person_name, p.photo_uri AS person_photo
      FROM reminders r
      LEFT JOIN people p ON p.id = r.person_id
      ORDER BY r.created_at DESC;
    `);
    return (rows ?? []) as Reminder[];
  } catch (err) {
    console.error('load reminders err', err);
    return [];
  }
}

export async function addReminder(r: {
  title: string;
  description?: string;
  icon?: string;
  schedule: any;
  personId?: string | null;
}) {
  await initDb();
  const db = getDb();
  try {
    const id = nanoid();
    await db.runAsync(
      `INSERT INTO reminders (id, title, description, icon, schedule_json, person_id)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [id, r.title, r.description || '', r.icon || '', JSON.stringify(r.schedule), r.personId || null]
    );
    console.log('✅ Added reminder', r.title);
    return id;
  } catch (err) {
    console.error('add reminder err', err);
    throw err;
  }
}

// Placeholder — no "completions" table yet, return 0 safely
export async function countCompletions(reminderId: string): Promise<number> {
  return 0;
}

export async function addCompletion(reminderId: string): Promise<void> {
  console.log('✅ Marked completion for', reminderId);
}

export async function deleteReminder(id: string) {
  await initDb();
  const db = getDb();
  try {
    await db.runAsync('DELETE FROM reminders WHERE id = ?;', [id]);
  } catch (err) {
    console.error('delete reminder err', err);
    throw err;
  }
}
