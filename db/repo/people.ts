// db/repo/people.ts
import { nanoid } from 'nanoid/non-secure';
import { getDb, initDb } from '../index';

export interface Person {
  id: string;
  name: string;
  relation?: string | null;
  notes?: string | null;
  photo_uri?: string | null; // must match DB column
  created_at?: string;
}

export async function listPeople(): Promise<Person[]> {
  await initDb();
  const db = getDb();
  try {
    const rows = await db.getAllAsync('SELECT * FROM people ORDER BY created_at DESC;');
    return rows as Person[];
  } catch (err) {
    console.error('listPeople err', err);
    return [];
  }
}

export async function addPerson(p: {
  name: string;
  relation?: string;
  notes?: string;
  photoUri?: string | null; // accept camelCase from app
}) {
  await initDb();
  const db = getDb();
  try {
    const id = nanoid();
    const photoUri = p.photoUri || null;
    await db.runAsync(
      `INSERT INTO people (id, name, relation, notes, photo_uri) VALUES (?, ?, ?, ?, ?);`,
      [id, p.name, p.relation || '', p.notes || '', photoUri]
    );
    console.log('✅ Added person', p.name);
    return id;
  } catch (err) {
    console.error('addPerson err', err);
    throw err;
  }
}

export async function deletePerson(id: string) {
  await initDb();
  const db = getDb();
  try {
    await db.runAsync('DELETE FROM people WHERE id = ?;', [id]);
    console.log('🗑️ Deleted person', id);
  } catch (err) {
    console.error('deletePerson err', err);
    throw err;
  }
}
