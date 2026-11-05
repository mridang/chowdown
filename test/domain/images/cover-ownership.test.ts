import { beforeEach, describe, expect, it } from '@jest/globals';

import { indexUnindexedRecipes } from '@/domain/db/recipe-images';
import { upsertRecipe } from '@/domain/db/recipes';
import { userHasCover } from '@/domain/images/cover-ownership';
import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import {
  sqliteDatabase,
  type SqliteDatabase,
} from '../../lib/core/db/sqlite-db';

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

describe('userHasCover with the recipe_images index', () => {
  /** Every statement sent to the database while `work` runs. */
  async function sentWhile(work: () => Promise<unknown>): Promise<string[]> {
    const sent: string[] = [];
    const prepare = database.raw.prepare.bind(database.raw);
    database.raw.prepare = (sql: string) => {
      sent.push(sql);
      return prepare(sql);
    };
    await work();
    database.raw.prepare = prepare;
    return sent;
  }

  /** Cache a recipe the way a sync does, so it is indexed. */
  const save = (userId: number, fileId: string, source: string) =>
    upsertRecipe(database.db, {
      user_id: userId,
      drive_file_id: fileId,
      name: `${fileId}.cook`,
      source,
    });

  it('answers from the index without reading any recipe text', async () => {
    await save(1, 'a', `>> images: ${PHOTO}\n`);
    const sent = await sentWhile(async () => {
      expect(await userHasCover(database.db, 1, PHOTO)).toBe(true);
    });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toContain('recipe_images');
    expect(sent[0]).not.toContain('source');
  });

  it('refuses an address no indexed recipe lists with only the probe and an empty look for unindexed recipes', async () => {
    await save(1, 'a', `>> images: ${OTHER}\n`);
    const sent = await sentWhile(async () => {
      expect(await userHasCover(database.db, 1, PHOTO)).toBe(false);
    });
    expect(sent).toHaveLength(2);
  });

  it('indexes recipes written before the table existed, then answers from the index', async () => {
    recipe(1, 'old', `>> title: Soup\n>> images: ${PHOTO}\n`);
    expect(await userHasCover(database.db, 1, PHOTO)).toBe(true);
    expect(
      database.raw
        .prepare(
          'SELECT images_indexed AS i FROM recipes WHERE drive_file_id = ?',
        )
        .get('old'),
    ).toEqual({ i: 1 });
    const sent = await sentWhile(async () => {
      expect(await userHasCover(database.db, 1, PHOTO)).toBe(true);
    });
    expect(sent).toHaveLength(1);
  });

  it("indexes only the asking person's recipes", async () => {
    recipe(2, 'theirs', `>> images: ${PHOTO}\n`);
    expect(await userHasCover(database.db, 1, PHOTO)).toBe(false);
    expect(
      database.raw.prepare('SELECT images_indexed AS i FROM recipes').get(),
    ).toEqual({ i: 0 });
  });

  it('stops allowing a photo once the recipe that listed it is rewritten without it', async () => {
    await save(1, 'a', `>> images: ${PHOTO}\n`);
    await save(1, 'a', `>> images: ${OTHER}\n`);
    expect(await userHasCover(database.db, 1, PHOTO)).toBe(false);
    expect(await userHasCover(database.db, 1, OTHER)).toBe(true);
  });

  it('does not overwrite a recipe that was indexed from newer text while the old text was being read', async () => {
    recipe(1, 'a', `>> images: ${PHOTO}\n`);
    // Rewrite the recipe after the text was read but before the batch runs.
    const original = database.db.batch.bind(database.db);
    let rewritten = false;
    (database.db as { batch: unknown }).batch = async (
      statements: Parameters<typeof original>[0],
    ) => {
      if (!rewritten) {
        rewritten = true;
        await save(1, 'a', `>> images: ${OTHER}\n`);
      }
      return original(statements);
    };
    await indexUnindexedRecipes(database.db, 1);
    expect(await userHasCover(database.db, 1, OTHER)).toBe(true);
    expect(await userHasCover(database.db, 1, PHOTO)).toBe(false);
  });
});
