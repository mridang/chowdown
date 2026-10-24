import { readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it, jest } from '@jest/globals';

import { DriveNotConnectedError } from '@/domain/auth/drive-access';
import type { User } from '@/domain/db/users';
import { RpcError } from '@/lib/mcp/protocol';
import { BackendFailure } from '@/lib/mcp/tool-errors';
import {
  RECIPE_TEMPLATE,
  cachedRecipeLister,
  isRecipeUri,
  readRecipeResource,
  recipeResource,
  recipeUri,
} from '@/domain/mcp/recipe-resources';
import type { ToolContext } from '@/domain/mcp/tool-calls';
import { sqliteDatabase } from '../../lib/db/sqlite-db';

const someone = { id: 1 } as User;

/** A Drive holding two recipes, as the tools see it. */
function driveWith(): (user: Readonly<User>) => Promise<ToolContext> {
  const read = jest.fn(
    async (id: string) => `>> source: ${id}\nBoil @eggs{2}.`,
  );
  return async () =>
    ({
      user: someone,
      token: 't',
      system: undefined,
      files: {
        list: async () => [
          { id: 'abc123', name: 'Omelette.cook' },
          { id: 'def_456', name: 'Soup.cook' },
          { id: 'AbC_789', name: 'Mixed case.cook' },
          { id: 'Same1', name: 'Twin one.cook' },
          { id: 'sAME1', name: 'Twin two.cook' },
        ],
        read,
      },
    }) as unknown as ToolContext;
}

/** The error `readRecipeResource` was refused with. */
async function refusal(uri: string, open = driveWith()): Promise<RpcError> {
  try {
    await readRecipeResource(someone, uri, open);
  } catch (error) {
    return error as RpcError;
  }
  throw new Error('expected a refusal');
}

describe('isRecipeUri', () => {
  it('tells recipe addresses from view addresses', () => {
    expect(isRecipeUri('recipe:///abc')).toBe(true);
    expect(isRecipeUri('recipe://abc')).toBe(true);
    expect(isRecipeUri('ui://chowdown/recipe-card.html')).toBe(false);
  });
});

describe('RECIPE_TEMPLATE', () => {
  it('puts the id in the path, not in the case-insensitive host part of the address', () => {
    expect(RECIPE_TEMPLATE.uriTemplate).toBe('recipe:///{id}');
  });

  it('expands (RFC 6570, simple expansion) to the address recipeUri builds and the reader accepts', async () => {
    const expanded = RECIPE_TEMPLATE.uriTemplate.replace('{id}', 'AbC_789');
    expect(expanded).toBe(recipeUri('AbC_789'));
    expect(new URL(expanded).pathname).toBe('/AbC_789');
    expect(
      (await readRecipeResource(someone, expanded, driveWith())).contents,
    ).toHaveLength(1);
  });
});

describe('recipeResource', () => {
  it('lists a recipe by its address and its plain name', () => {
    expect(
      recipeResource({ id: 'abc', name: 'Apple pie [uncurated].cook' }),
    ).toEqual({
      uri: 'recipe:///abc',
      name: 'Apple pie',
      mimeType: 'text/plain',
    });
  });

  it('flattens a name with a line break', () => {
    expect(recipeResource({ id: 'abc', name: 'a\nb.cook' })).toMatchObject({
      name: 'a b',
    });
  });
});

describe('readRecipeResource', () => {
  it("returns the recipe's source from the user's Drive", async () => {
    expect(
      await readRecipeResource(someone, 'recipe:///def_456', driveWith()),
    ).toEqual({
      contents: [
        {
          uri: 'recipe:///def_456',
          mimeType: 'text/plain',
          text: '>> source: def_456\nBoil @eggs{2}.',
        },
      ],
    });
  });

  it('reads an id that has capital letters, from the path of the address', async () => {
    expect(
      await readRecipeResource(someone, 'recipe:///AbC_789', driveWith()),
    ).toMatchObject({
      contents: [
        {
          uri: 'recipe:///AbC_789',
          text: '>> source: AbC_789\nBoil @eggs{2}.',
        },
      ],
    });
  });

  it('still reads the earlier form of the address, which has the id where a host name goes', async () => {
    expect(
      await readRecipeResource(someone, 'recipe://def_456', driveWith()),
    ).toMatchObject({ contents: [{ uri: 'recipe://def_456' }] });
  });

  it('finds the one recipe an id fits when a client lower-cased it on the way', async () => {
    expect(
      await readRecipeResource(someone, 'recipe://abc_789', driveWith()),
    ).toMatchObject({
      contents: [
        { uri: 'recipe://abc_789', text: '>> source: AbC_789\nBoil @eggs{2}.' },
      ],
    });
  });

  it('does not guess between two recipes whose ids differ only in case', async () => {
    expect((await refusal('recipe:///SAME1')).code).toBe(-32602);
    expect(
      await readRecipeResource(someone, 'recipe:///sAME1', driveWith()),
    ).toMatchObject({
      contents: [{ text: '>> source: sAME1\nBoil @eggs{2}.' }],
    });
  });

  it('repeats only the start of an absurdly long address in the refusal', async () => {
    const error = await refusal(`recipe:///${'a'.repeat(5000)}!`);
    expect(String((error.data as { uri: string }).uri).length).toBe(200);
  });

  it('refuses an id the user has no recipe for, with the address in the detail', async () => {
    const error = await refusal('recipe://zzz');
    expect(error.code).toBe(-32602);
    expect(error.data).toEqual({ uri: 'recipe://zzz' });
  });

  it.each([
    'recipe://',
    'recipe:///',
    'recipe://a/b',
    'recipe:///a/b',
    'recipe://a b',
    'recipe:///a b',
    'recipe://../x',
    'recipe:///..%2fx',
    'recipe:////abc',
  ])(
    'refuses %s as not a recipe address, without opening Drive',
    async (uri) => {
      const open = jest.fn(driveWith());
      expect((await refusal(uri, open)).code).toBe(-32602);
      expect(open).not.toHaveBeenCalled();
    },
  );

  it('says how to connect Drive when it is not connected', async () => {
    const error = await refusal('recipe:///abc123', async () => {
      throw new DriveNotConnectedError();
    });
    expect(error.code).toBe(-32603);
    expect(error.message).toMatch(/Google Drive isn't connected/);
  });

  it('lets any other failure through for the server to log', async () => {
    const boom = new Error('boom');
    await expect(
      readRecipeResource(someone, 'recipe:///abc123', async () => {
        throw boom;
      }),
    ).rejects.toBe(boom);
  });
});

describe('cachedRecipeLister', () => {
  /** A real database with every migration applied and a few cached recipes. */
  function seeded() {
    const migrations = readdirSync(path.join(process.cwd(), 'migrations'))
      .filter((file) => file.endsWith('.sql'))
      .toSorted();
    const database = sqliteDatabase(...migrations);
    const now = '2026-01-01T00:00:00.000Z';
    database.raw.exec(
      `INSERT INTO users (id, google_sub, email, created_at, updated_at) VALUES
         (1, 'a', 'a@example.com', '${now}', '${now}'),
         (2, 'b', 'b@example.com', '${now}', '${now}')`,
    );
    const names = ['Soup', 'Apple pie', 'Naan', 'Curry', 'Bread'];
    names.forEach((name, index) =>
      database.raw.exec(
        `INSERT INTO recipes (user_id, drive_file_id, name, source, first_opened_at, last_opened_at)
         VALUES (1, 'id${index}', '${name}.cook', 'SOURCE OF ${name}', '${now}', '${now}')`,
      ),
    );
    database.raw.exec(
      `INSERT INTO recipes (user_id, drive_file_id, name, source, first_opened_at, last_opened_at)
       VALUES (2, 'other', 'Someone else.cook', 'x', '${now}', '${now}')`,
    );
    return database;
  }

  it("lists one person's recipes in name order, and nobody else's", async () => {
    const list = cachedRecipeLister(() => seeded().db);
    expect(await list(someone, 0, 10)).toEqual([
      { id: 'id1', name: 'Apple pie.cook' },
      { id: 'id4', name: 'Bread.cook' },
      { id: 'id3', name: 'Curry.cook' },
      { id: 'id2', name: 'Naan.cook' },
      { id: 'id0', name: 'Soup.cook' },
    ]);
  });

  it('pages without gaps or repeats', async () => {
    const database = seeded();
    const list = cachedRecipeLister(() => database.db);
    const pages = await Promise.all([
      list(someone, 0, 2),
      list(someone, 2, 2),
      list(someone, 4, 2),
      list(someone, 6, 2),
    ]);
    expect(pages.map((page) => page.length)).toEqual([2, 2, 1, 0]);
    expect(pages.flat().map((entry) => entry.id)).toEqual([
      'id1',
      'id4',
      'id3',
      'id2',
      'id0',
    ]);
  });

  it('reads only the id and the name, never a recipe’s text', async () => {
    const list = cachedRecipeLister(() => seeded().db);
    const [first] = await list(someone, 0, 1);
    expect(Object.keys(first ?? {}).toSorted()).toEqual(['id', 'name']);
  });

  it('turns a database failure into a named backend failure', async () => {
    const list = cachedRecipeLister(() => {
      throw new Error('D1 is down');
    });
    await expect(list(someone, 0, 1)).rejects.toBeInstanceOf(BackendFailure);
  });
});
