import { afterEach, describe, expect, it, jest } from '@jest/globals';

import {
  ANNOUNCEMENTS,
  missingFieldErrors,
  prepareImport,
} from '../../../../../../../src/app/(site)/(pages)/recipes/add/_components/import-flow';

afterEach(() => {
  jest.restoreAllMocks();
});

/** Replaces `fetch` with one that answers with `respond`. */
function answerWith(respond: (init?: RequestInit) => Promise<Response>) {
  return jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation((_url, init) => respond(init));
}

/** A fetch that never answers until its request is aborted, like a slow import. */
function hangUntilAborted() {
  return answerWith(
    (init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError')),
        );
      }),
  );
}

describe('prepareImport', () => {
  it('hands back the prepared drafts', async () => {
    answerWith(async () =>
      Response.json({ id: 'imp1', items: [{ title: 'Dal', cooklang: 'x' }] }),
    );
    const outcome = await prepareImport(
      'https://x.test',
      new AbortController().signal,
    );
    expect(outcome).toEqual({
      kind: 'prepared',
      prepared: {
        id: 'imp1',
        drafts: [
          { title: 'Dal', cook: 'x', source: undefined, error: undefined },
        ],
      },
    });
  });

  it('passes the abort signal to the request, so Cancel can end the wait', async () => {
    const fetcher = answerWith(async () =>
      Response.json({ id: 'imp1', items: [] }),
    );
    const controller = new AbortController();
    await prepareImport('text', controller.signal);
    expect(fetcher.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
  });

  it('ends as cancelled, not as an error, when the person cancels', async () => {
    hangUntilAborted();
    const controller = new AbortController();
    const pending = prepareImport('text', controller.signal);
    controller.abort();
    await expect(pending).resolves.toEqual({ kind: 'cancelled' });
  });

  it('says why when the server refuses', async () => {
    answerWith(async () =>
      Response.json({ detail: 'Too many links.' }, { status: 400 }),
    );
    await expect(
      prepareImport('text', new AbortController().signal),
    ).resolves.toEqual({ kind: 'failed', message: 'Too many links.' });
  });

  it('says so when the answer is not an import', async () => {
    answerWith(async () => Response.json({ nope: true }));
    await expect(
      prepareImport('text', new AbortController().signal),
    ).resolves.toEqual({
      kind: 'failed',
      message: 'Could not prepare those recipes.',
    });
  });

  it('reports a network failure with the failure’s own message', async () => {
    answerWith(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(
      prepareImport('text', new AbortController().signal),
    ).resolves.toEqual({ kind: 'failed', message: 'Failed to fetch' });
  });
});

describe('ANNOUNCEMENTS', () => {
  it('tell the person that preparing is slow, so a long wait is expected', () => {
    expect(ANNOUNCEMENTS.preparing).toContain('a minute or two');
  });

  it('say that cancelling prepared nothing', () => {
    expect(ANNOUNCEMENTS.cancelled).toContain('Nothing was prepared');
  });

  it('say which draft is showing after a save', () => {
    expect(ANNOUNCEMENTS.savedNext(2, 5)).toBe(
      'Saved. Now showing recipe 2 of 5.',
    );
  });
});

describe('missingFieldErrors', () => {
  it('has no errors for a complete draft', () => {
    expect(missingFieldErrors('Dal', '@lentils{}')).toEqual({});
  });

  it('names each empty field separately, so each can be tied to its own box', () => {
    expect(missingFieldErrors('', '@lentils{}')).toEqual({
      name: 'Give the recipe a name.',
    });
    expect(missingFieldErrors('Dal', '')).toEqual({
      cook: 'The recipe needs some Cooklang.',
    });
    expect(Object.keys(missingFieldErrors('', ''))).toEqual(['name', 'cook']);
  });

  it('treats blank space as empty', () => {
    expect(Object.keys(missingFieldErrors('  ', '\n'))).toEqual([
      'name',
      'cook',
    ]);
  });
});
