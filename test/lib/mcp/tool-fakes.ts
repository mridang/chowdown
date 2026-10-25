/**
 * Fakes for the MCP tools' collaborators, shared by the tool tests: a Drive
 * folder held in memory that remembers every write, and a set of services that
 * answer without a database, a model or the network.
 */

import { jest } from '@jest/globals';

import type { Recipe } from '@/domain/db/recipes';
import type { User } from '@/domain/db/users';
import type { DriveFile } from '@/lib/google';
import { callTool, type ToolContext } from '@/domain/mcp/tool-calls';
import type { ToolServices } from '@/domain/mcp/tool-services';

/** The signed-in user the tests act as. */
export const USER = { id: 7, units: null, recipes_folder_id: 'folder' } as User;

/** A small recipe. */
export const PANCAKES = [
  '>> servings: 4',
  '>> time: 20 min',
  '',
  'Mix @flour{200%g} with @eggs{2} in a #bowl{}.',
  '',
  'Fry for ~{3%minutes}.',
  '',
].join('\n');

/** Things a test can do to the fake folder while a tool is working in it. */
export interface FolderHooks {
  /**
   * Called after each read of a file, with the file's name, how many times it has
   * been read so far, and a way to change its text: a stand-in for someone else
   * editing the recipe in Drive while a tool is part way through.
   */
  readonly afterRead?: (
    name: string,
    reads: number,
    change: (text: string) => void,
  ) => void;
  /**
   * Called after each write of a file, with the file's name, how many times it has
   * been written so far, and a way to change its text: a stand-in for another save
   * landing right after ours and replacing it.
   */
  readonly afterUpdate?: (
    name: string,
    writes: number,
    change: (text: string) => void,
  ) => void;
}

/**
 * A fake Drive folder holding the given recipes, remembering every write. A
 * write replaces the file's text, as in Drive, so a later read sees it.
 */
export function folder(
  initial: Readonly<Record<string, string>> = {},
  hooks: FolderHooks = {},
) {
  const contents = new Map(Object.entries(initial));
  const reads = new Map<string, number>();
  const writes = new Map<string, number>();
  const created: DriveFile[] = [];
  const updates: [string, string][] = [];
  const indexed: [string, string, string][] = [];
  const nameOf = (id: string) => id.replace(/^id-/, '');
  const ctx: ToolContext = {
    user: USER,
    token: 'tok',
    system: undefined,
    files: {
      list: async () =>
        [...contents.keys()].map((name) => ({ id: `id-${name}`, name })),
      read: async (id) => {
        const name = nameOf(id);
        const text = contents.get(name) ?? '';
        const count = (reads.get(name) ?? 0) + 1;
        reads.set(name, count);
        hooks.afterRead?.(name, count, (changed) =>
          contents.set(name, changed),
        );
        return text;
      },
      create: async (name, content) => {
        const file = {
          id: `id-${name}`,
          name: name.endsWith('.cook') ? name : `${name}.cook`,
        };
        created.push(file);
        contents.set(file.name, content);
        return file;
      },
      update: async (id, content) => {
        updates.push([id, content]);
        const name = nameOf(id);
        contents.set(name, content);
        const count = (writes.get(name) ?? 0) + 1;
        writes.set(name, count);
        hooks.afterUpdate?.(name, count, (changed) =>
          contents.set(name, changed),
        );
      },
      index: async (id, name, source) => {
        indexed.push([id, name, source]);
      },
    },
  };
  return { ctx, created, updates, indexed, contents };
}

/** A cached recipe row for the scenario tools. */
export function row(name: string, source: string): Recipe {
  return {
    id: 1,
    user_id: USER.id,
    drive_file_id: `id-${name}`,
    name: `${name}.cook`,
    title: name,
    source,
    modified_time: null,
    parse_error: null,
    tags: null,
    source_url: null,
    first_opened_at: '2026-01-01',
    last_opened_at: '2026-01-01',
  };
}

/**
 * Services that answer without outside help. Every one can be replaced, and each
 * is a mock so a test can see what it was asked.
 */
export function fakeServices(overrides: Partial<ToolServices> = {}) {
  const services = {
    searchIndex: jest.fn<ToolServices['searchIndex']>(async (_user, files) => ({
      rows: files.map((f, index) => ({
        user_id: USER.id,
        drive_file_id: f.id,
        title: f.name,
        modified_time: null,
        vector: JSON.stringify([1, index]),
        similar: null,
      })),
      waiting: 0,
    })),
    embedQuery: jest.fn<ToolServices['embedQuery']>(async () => [1, 0]),
    findImported: jest.fn<ToolServices['findImported']>(async () => undefined),
    spendModelBudget: jest.fn<ToolServices['spendModelBudget']>(
      async () => undefined,
    ),
    convertImport: jest.fn<ToolServices['convertImport']>(
      async (content) =>
        `>> title: Imported\n\nMix @flour{100%g}.\n\n${content}\n`,
    ),
    tagBestEffort: jest.fn<ToolServices['tagBestEffort']>(
      async (source) => source,
    ),
    tag: jest.fn<ToolServices['tag']>(async (source) => ({
      source: `>> cuisine: Italian\n${source}`,
      tags: [['cuisine', 'Italian']],
    })),
    addCover: jest.fn<ToolServices['addCover']>(async (source) => source),
    setFavourite: jest.fn<ToolServices['setFavourite']>(async () => undefined),
    setUnits: jest.fn<ToolServices['setUnits']>(async () => undefined),
    scenario: jest.fn<ToolServices['scenario']>(() => ({
      rows: async () => [
        row('Pancakes', PANCAKES),
        row('Soup', '>> cuisine: French\n\nBoil @water{1%l}.\n'),
      ],
      favouriteIds: async () => [],
      sync: async () => 0,
      inBackground: () => undefined,
    })),
    ...overrides,
  } satisfies ToolServices;
  return services;
}

/** Call a tool against a fake folder and fake services. */
export function call(
  name: string,
  args: Record<string, unknown>,
  fake: ReturnType<typeof folder>,
  services: ToolServices = fakeServices(),
) {
  return callTool(
    USER,
    { name, arguments: args },
    async () => fake.ctx,
    services,
  );
}

/** The first text in a result. */
export function said(result: Awaited<ReturnType<typeof call>>): string {
  return result.content[0]?.text ?? '';
}
