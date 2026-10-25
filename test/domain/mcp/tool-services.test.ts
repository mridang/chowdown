import { describe, expect, it, jest } from '@jest/globals';

import { DriveNotConnectedError } from '@/domain/auth/drive-access';
import type { EmbeddingRow } from '@/domain/db/embeddings';
import type { DriveFile } from '@/lib/google';
import type { FileOps } from '@/domain/mcp/tool-calls';
import { BackendFailure } from '@/lib/mcp/tool-errors';
import {
  EMBEDDINGS_PER_CALL,
  guardFileOps,
  guarded,
  planBackfill,
} from '@/domain/mcp/tool-services';

describe('guarded', () => {
  it('returns what the call returns', async () => {
    await expect(guarded('Google Drive', async () => 5)).resolves.toBe(5);
  });

  it('names the service that failed and keeps the cause for the logs', async () => {
    const cause = new Error('503 from Google');
    const failure = await guarded('Google Drive', async () => {
      throw cause;
    }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(BackendFailure);
    expect(failure).toMatchObject({ service: 'Google Drive', cause });
  });

  it('counts a network failure (a TypeError from fetch) as the service failing', async () => {
    await expect(
      guarded('Google Drive', async () => {
        throw new TypeError('fetch failed');
      }),
    ).rejects.toBeInstanceOf(BackendFailure);
  });

  it('lets a Drive that is not connected through, to be explained in its own words', async () => {
    await expect(
      guarded('Google Drive', async () => {
        throw new DriveNotConnectedError();
      }),
    ).rejects.toBeInstanceOf(DriveNotConnectedError);
  });

  it('does not rename a failure that is already named', async () => {
    await expect(
      guarded('the recipe database', async () => {
        throw new BackendFailure('Google Drive', new Error('x'));
      }),
    ).rejects.toMatchObject({ service: 'Google Drive' });
  });
});

describe('guardFileOps', () => {
  const ops = (overrides: Partial<FileOps> = {}): FileOps => ({
    list: async () => [{ id: 'a', name: 'A.cook' }],
    read: async () => 'text',
    create: async (name) => ({ id: 'n', name }),
    update: async () => undefined,
    index: async () => undefined,
    ...overrides,
  });
  const boom = async (): Promise<never> => {
    throw new Error('boom');
  };

  it('passes the operations through when Drive works', async () => {
    const files = guardFileOps(ops());
    await expect(files.list()).resolves.toEqual([{ id: 'a', name: 'A.cook' }]);
    await expect(files.read('a')).resolves.toBe('text');
    await expect(files.create('B.cook', 'x')).resolves.toEqual({
      id: 'n',
      name: 'B.cook',
    });
    await expect(files.update('a', 'x')).resolves.toBeUndefined();
  });

  it.each([
    ['list', (f: FileOps) => f.list()],
    ['read', (f: FileOps) => f.read('a')],
    ['create', (f: FileOps) => f.create('B.cook', 'x')],
    ['update', (f: FileOps) => f.update('a', 'x')],
  ])('turns a failing %s into a Google Drive failure', async (name, run) => {
    const files = guardFileOps(ops({ [name]: boom }));
    await expect(run(files)).rejects.toMatchObject({ service: 'Google Drive' });
  });

  it('does not fail the tool when only the cache refresh after a save fails', async () => {
    const quiet = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const files = guardFileOps(ops({ index: boom }));
    await expect(files.index('a', 'A.cook', 'x')).resolves.toBeUndefined();
    expect(quiet).toHaveBeenCalledTimes(1);
    quiet.mockRestore();
  });

  it('still reports a Drive that is not connected during the refresh', async () => {
    const files = guardFileOps(
      ops({
        index: async () => {
          throw new DriveNotConnectedError();
        },
      }),
    );
    await expect(files.index('a', 'A.cook', 'x')).rejects.toBeInstanceOf(
      DriveNotConnectedError,
    );
  });
});

describe('planBackfill', () => {
  const file = (n: number, modifiedTime?: string): DriveFile => ({
    id: `f${n}`,
    name: `R${n}.cook`,
    modifiedTime,
  });
  const row = (n: number, modified_time: string | null): EmbeddingRow => ({
    user_id: 1,
    drive_file_id: `f${n}`,
    title: `R${n}`,
    modified_time,
    vector: '[1]',
    similar: null,
  });
  const ids = (files: readonly DriveFile[]) => files.map((f) => f.id);

  it('hands over a fully indexed folder untouched', () => {
    const files = [file(1, 't1'), file(2, 't2')];
    const plan = planBackfill(files, [row(1, 't1'), row(2, 't2')], 25);
    expect(plan).toEqual({ files, waiting: 0 });
  });

  it('indexes everything when little is missing, as before', () => {
    const files = [file(1, 't1'), file(2, 't2'), file(3, 't3')];
    const plan = planBackfill(files, [row(1, 't1')], 25);
    expect(ids(plan.files)).toEqual(['f1', 'f2', 'f3']);
    expect(plan.waiting).toBe(0);
  });

  it('lets at most the limit of new recipes through and counts the rest as waiting', () => {
    const files = Array.from({ length: 10 }, (_, i) => file(i, `t${i}`));
    const plan = planBackfill(files, [], 4);
    expect(ids(plan.files)).toEqual(['f0', 'f1', 'f2', 'f3']);
    expect(plan.waiting).toBe(6);
  });

  it('puts the recipe asked about first in line', () => {
    const files = Array.from({ length: 10 }, (_, i) => file(i, `t${i}`));
    const plan = planBackfill(files, [], 2, 'f7');
    expect(ids(plan.files)).toEqual(['f0', 'f7']);
  });

  it('keeps serving the old vector of an edited recipe that has to wait', () => {
    const files = [file(1, 't1-new'), file(2, 't2-new'), file(3, 't3')];
    const plan = planBackfill(
      files,
      [row(1, 't1'), row(2, 't2'), row(3, 't3')],
      1,
    );
    expect(plan.waiting).toBe(1);
    // f1 is re-embedded; f2 is handed over with its old stamp, which reads as current.
    expect(plan.files).toEqual([
      file(1, 't1-new'),
      file(2, 't2'),
      file(3, 't3'),
    ]);
  });

  it('does not count a vector made at write time as needing work', () => {
    const files = [file(1, 't1')];
    expect(planBackfill(files, [row(1, null)], 0)).toEqual({
      files,
      waiting: 0,
    });
  });

  it('does not count an unstamped file that has an unstamped vector as needing work', () => {
    const files = [file(1)];
    expect(planBackfill(files, [row(1, null)], 0).waiting).toBe(0);
  });

  it('allows 25 new recipes per call', () => {
    expect(EMBEDDINGS_PER_CALL).toBe(25);
  });
});
