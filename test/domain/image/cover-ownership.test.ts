import { beforeEach, describe, expect, it } from '@jest/globals';

import { userHasCover } from '@/domain/image/cover-ownership';
import { APP_MIGRATIONS } from '../../lib/db/migrations';
import { sqliteDatabase, type SqliteDatabase } from '../../lib/db/sqlite-db';

const PHOTO = 'https://photos.example.org/soup.jpg?w=440,400';
const OTHER = 'https://photos.example.org/stew.jpg';

let database: SqliteDatabase;

/** Store a recipe for a user. */
function recipe(userId: number, fileId: string, source: string): void {
  database.raw
    .prepare(
      `INSERT INTO recipes (user_id, drive_file_id, name, source, first_opened_at, last_opened_at)
       VALUES (?, ?, ?, ?, 't', 't')`,
    )
    .run(userId, fileId, `${fileId}.cook`, source);
}

beforeEach(() => {
  database = sqliteDatabase(...APP_MIGRATIONS);
  [1, 2].forEach((id) =>
    database.raw
      .prepare(
        "INSERT INTO users (id, google_sub, email, created_at, updated_at) VALUES (?, ?, ?, 't', 't')",
      )
      .run(id, `sub-${id}`, `user${id}@example.com`),
  );
});

describe('userHasCover', () => {
  it('is true for a photo the person has listed as the cover', async () => {
    recipe(1, 'a', `>> title: Soup\n>> images: ${PHOTO} ${OTHER}\n\nBoil.`);
    expect(await userHasCover(database.db, 1, PHOTO)).toBe(true);
  });

  it('is true for a photo further down the list', async () => {
    recipe(1, 'a', `>> title: Soup\n>> images: ${OTHER} ${PHOTO}\n\nBoil.`);
    expect(await userHasCover(database.db, 1, PHOTO)).toBe(true);
  });

  it('is false for a photo nobody listed', async () => {
    recipe(1, 'a', `>> title: Soup\n>> images: ${OTHER}\n\nBoil.`);
    expect(await userHasCover(database.db, 1, PHOTO)).toBe(false);
  });

  it("is false for a photo only another person's recipe lists", async () => {
    recipe(2, 'a', `>> title: Soup\n>> images: ${PHOTO}\n\nBoil.`);
    expect(await userHasCover(database.db, 1, PHOTO)).toBe(false);
  });

  it('is false when the address only appears in the text, not in the image list', async () => {
    recipe(
      1,
      'a',
      `>> title: Soup\n>> source: ${PHOTO}\n\nSee ${PHOTO} for how it looks.`,
    );
    expect(await userHasCover(database.db, 1, PHOTO)).toBe(false);
  });

  it('is false for a longer address that merely contains the one asked for', async () => {
    recipe(1, 'a', `>> title: Soup\n>> images: ${PHOTO}&x=1\n\nBoil.`);
    expect(await userHasCover(database.db, 1, PHOTO)).toBe(false);
  });

  it('is false for a person with no recipes', async () => {
    expect(await userHasCover(database.db, 1, PHOTO)).toBe(false);
  });

  it('finds the right recipe among several that mention the address', async () => {
    recipe(1, 'a', `>> title: A\n\n${PHOTO}`);
    recipe(1, 'b', `>> title: B\n>> source: ${PHOTO}`);
    recipe(1, 'c', `>> title: C\n>> images: ${PHOTO}`);
    expect(await userHasCover(database.db, 1, PHOTO)).toBe(true);
  });

  it('treats characters that are special in patterns as plain text', async () => {
    const odd = 'https://a.com/100%_done[1].jpg';
    recipe(1, 'a', `>> title: A\n>> images: ${odd}`);
    expect(await userHasCover(database.db, 1, odd)).toBe(true);
    expect(await userHasCover(database.db, 1, 'https://a.com/100%')).toBe(
      false,
    );
  });
});
