import { describe, expect, it, jest } from '@jest/globals';

import { DriveNotConnectedError } from '../../../src/lib/auth/drive-access';
import type { User } from '../../../src/lib/db/users';
import { RpcError } from '../../../src/lib/mcp/protocol';
import {
  RECIPE_TEMPLATE,
  isRecipeUri,
  readRecipeResource,
} from '../../../src/lib/mcp/recipe-resources';
import type { ToolContext } from '../../../src/lib/mcp/tool-calls';

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
    expect(isRecipeUri('recipe://abc')).toBe(true);
    expect(isRecipeUri('ui://chowdown/recipe-card.html')).toBe(false);
  });
});

describe('RECIPE_TEMPLATE', () => {
  it('names the address a recipe is read at', () => {
    expect(RECIPE_TEMPLATE.uriTemplate).toBe('recipe://{id}');
  });
});

describe('readRecipeResource', () => {
  it("returns the recipe's source from the user's Drive", async () => {
    expect(
      await readRecipeResource(someone, 'recipe://def_456', driveWith()),
    ).toEqual({
      contents: [
        {
          uri: 'recipe://def_456',
          mimeType: 'text/plain',
          text: '>> source: def_456\nBoil @eggs{2}.',
        },
      ],
    });
  });

  it('refuses an id the user has no recipe for, with the address in the detail', async () => {
    const error = await refusal('recipe://zzz');
    expect(error.code).toBe(-32602);
    expect(error.data).toEqual({ uri: 'recipe://zzz' });
  });

  it.each(['recipe://', 'recipe://a/b', 'recipe://a b', 'recipe://../x'])(
    'refuses %s as not a recipe address, without opening Drive',
    async (uri) => {
      const open = jest.fn(driveWith());
      expect((await refusal(uri, open)).code).toBe(-32602);
      expect(open).not.toHaveBeenCalled();
    },
  );

  it('says how to connect Drive when it is not connected', async () => {
    const error = await refusal('recipe://abc123', async () => {
      throw new DriveNotConnectedError();
    });
    expect(error.code).toBe(-32603);
    expect(error.message).toMatch(/Google Drive isn't connected/);
  });

  it('lets any other failure through for the server to log', async () => {
    const boom = new Error('boom');
    await expect(
      readRecipeResource(someone, 'recipe://abc123', async () => {
        throw boom;
      }),
    ).rejects.toBe(boom);
  });
});
