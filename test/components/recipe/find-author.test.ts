import { describe, expect, it, jest } from '@jest/globals';

import {
  findAuthor,
  findAuthorMessage,
  findMissingAuthors,
  progressText,
  summaryText,
  type BatchTotals,
  type Fetcher,
} from '../../../src/components/recipe/find-author';

/** A JSON response, as the server sends them. */
function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

/** A problem+json refusal. */
function problem(status: number, type: string, detail?: string): Response {
  return json({ type, title: 'Refused', detail }, { status });
}

/** A fetcher that answers each call from the list in turn, and remembers what it was asked. */
function scripted(answers: readonly (Response | Error)[]) {
  const calls: { readonly input: string; readonly init?: RequestInit }[] = [];
  const fetcher: Fetcher = async (input, init) => {
    const answer = answers[calls.length];
    calls.push({ input, init });
    if (answer === undefined) {
      throw new Error('asked more often than expected');
    }
    if (answer instanceof Error) {
      throw answer;
    }
    return answer;
  };
  return { fetcher, calls };
}

describe('findAuthor', () => {
  it('posts the recipe id as JSON and reports the author it saved', async () => {
    const { fetcher, calls } = scripted([
      json({ author: 'Maunika Gowardhan', saved: true }),
    ]);
    await expect(findAuthor('abc123', fetcher)).resolves.toEqual({
      kind: 'found',
      author: 'Maunika Gowardhan',
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.input).toBe('/rpc/find-author');
    expect(calls[0]?.init?.method).toBe('POST');
    expect(calls[0]?.init?.headers).toEqual({
      'Content-Type': 'application/json',
    });
    expect(calls[0]?.init?.body).toBe(JSON.stringify({ recipe_id: 'abc123' }));
  });

  it('says "none" when nothing credible was found, which is an answer and not an error', async () => {
    const { fetcher } = scripted([json({ author: null, saved: false })]);
    await expect(findAuthor('abc', fetcher)).resolves.toEqual({ kind: 'none' });
  });

  it('says "none" when an author came back but was not saved (the recipe already had one)', async () => {
    const { fetcher } = scripted([json({ author: 'Someone', saved: false })]);
    await expect(findAuthor('abc', fetcher)).resolves.toEqual({ kind: 'none' });
  });

  it('does not trust an answer of the wrong shape', async () => {
    const { fetcher } = scripted([json({ author: 7, saved: true })]);
    await expect(findAuthor('abc', fetcher)).resolves.toEqual({ kind: 'none' });
    const blank = scripted([json({ author: '  ', saved: true })]);
    await expect(findAuthor('abc', blank.fetcher)).resolves.toEqual({
      kind: 'none',
    });
    const odd = scripted([json('nope')]);
    await expect(findAuthor('abc', odd.fetcher)).resolves.toEqual({
      kind: 'none',
    });
  });

  it('recognises Drive not being connected, so the screen can offer to connect it', async () => {
    const { fetcher } = scripted([
      problem(409, 'https://chowdown.test/problems/drive-not-connected'),
    ]);
    await expect(findAuthor('abc', fetcher)).resolves.toEqual({
      kind: 'drive-not-connected',
    });
  });

  it('treats any other conflict as a failure in the server’s own words', async () => {
    const { fetcher } = scripted([
      problem(409, '/problems/other', 'The recipe changed.'),
    ]);
    await expect(findAuthor('abc', fetcher)).resolves.toEqual({
      kind: 'failed',
      message: 'The recipe changed.',
    });
  });

  it('explains each refusal in a sentence', async () => {
    const ask = async (status: number) =>
      findAuthor('abc', scripted([json({}, { status })]).fetcher);
    await expect(ask(401)).resolves.toEqual({
      kind: 'failed',
      message: 'Sign in again to find authors.',
    });
    await expect(ask(429)).resolves.toEqual({
      kind: 'failed',
      message: 'Too many requests. Try again later.',
    });
    await expect(ask(502)).resolves.toEqual({
      kind: 'failed',
      message: 'A recipe’s source page could not be reached. Try again later.',
    });
    await expect(ask(500)).resolves.toEqual({
      kind: 'failed',
      message: 'Request failed (500).',
    });
  });

  it('never throws: a network failure is a failure with a fixed sentence', async () => {
    const { fetcher } = scripted([new TypeError('Failed to fetch')]);
    await expect(findAuthor('abc', fetcher)).resolves.toEqual({
      kind: 'failed',
      message: 'Could not look for the author.',
    });
  });
});

/** A batch answer. */
const batch = (
  processed: number,
  found: number,
  remaining: number,
  next: string | null,
) => json({ processed, found, remaining, next });

describe('findMissingAuthors', () => {
  const run = (
    answers: readonly (Response | Error)[],
    signal?: AbortSignal,
  ) => {
    const progress: BatchTotals[] = [];
    const { fetcher, calls } = scripted(answers);
    const done = findMissingAuthors({
      fetcher,
      signal: signal ?? new AbortController().signal,
      onProgress: (totals) => progress.push(totals),
    });
    return { done, progress, calls };
  };

  it('asks batch after batch, passing back where the last one ended, until the server says it is done', async () => {
    const { done, progress, calls } = run([
      batch(3, 2, 5, 'r3'),
      batch(3, 1, 2, 'r6'),
      batch(2, 0, 0, null),
    ]);
    await expect(done).resolves.toEqual({
      status: 'done',
      processed: 8,
      found: 3,
      remaining: 0,
    });
    expect(calls.map((call) => call.input)).toEqual([
      '/rpc/find-author?after=&limit=3',
      '/rpc/find-author?after=r3&limit=3',
      '/rpc/find-author?after=r6&limit=3',
    ]);
    expect(progress).toEqual([
      { processed: 3, found: 2, remaining: 5 },
      { processed: 6, found: 3, remaining: 2 },
      { processed: 8, found: 3, remaining: 0 },
    ]);
  });

  it('is done at once when nothing is missing', async () => {
    const { done } = run([batch(0, 0, 0, null)]);
    await expect(done).resolves.toEqual({
      status: 'done',
      processed: 0,
      found: 0,
      remaining: 0,
    });
  });

  it('encodes the place it resumes from', async () => {
    const { calls, done } = run([
      batch(3, 0, 1, 'a b&c'),
      batch(1, 0, 0, null),
    ]);
    await done;
    expect(calls[1]?.input).toBe('/rpc/find-author?after=a+b%26c&limit=3');
  });

  it('stops on the first refusal and keeps what it had found', async () => {
    const { done, calls } = run([
      batch(3, 2, 9, 'r3'),
      json({}, { status: 429, headers: { 'Retry-After': '30' } }),
      batch(3, 3, 0, null),
    ]);
    await expect(done).resolves.toEqual({
      status: 'stopped',
      reason: 'Too many requests. Try again later.',
      processed: 3,
      found: 2,
      remaining: 9,
    });
    expect(calls).toHaveLength(2);
  });

  it('says why when Drive is not connected', async () => {
    const { done } = run([problem(409, '/problems/drive-not-connected')]);
    await expect(done).resolves.toMatchObject({
      status: 'stopped',
      reason: 'Google Drive is not connected.',
    });
  });

  it('stops, and says so, when the connection fails', async () => {
    const { done } = run([new TypeError('Failed to fetch')]);
    await expect(done).resolves.toMatchObject({
      status: 'stopped',
      reason: 'The connection failed.',
    });
  });

  it('stops on an answer it cannot read', async () => {
    const { done } = run([json({ processed: 'three' })]);
    await expect(done).resolves.toMatchObject({
      status: 'stopped',
      reason: 'The server sent an answer we could not read.',
    });
  });

  it('stops when the server keeps handing back the same place', async () => {
    const { done, calls } = run([
      batch(3, 0, 9, 'r3'),
      batch(3, 0, 6, 'r3'),
      batch(3, 0, 3, 'r3'),
    ]);
    await expect(done).resolves.toMatchObject({
      status: 'stopped',
      reason: 'The server did not move on.',
      processed: 6,
    });
    expect(calls).toHaveLength(2);
  });

  it('ends as cancelled, not failed, when the person cancels mid-request', async () => {
    const controller = new AbortController();
    const fetcher: Fetcher = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError')),
        );
      });
    const pending = findMissingAuthors({
      fetcher,
      signal: controller.signal,
      onProgress: () => undefined,
    });
    controller.abort();
    await expect(pending).resolves.toEqual({
      status: 'cancelled',
      processed: 0,
      found: 0,
      remaining: 0,
    });
  });

  it('does not ask again once cancelled between batches', async () => {
    const controller = new AbortController();
    const { fetcher, calls } = scripted([
      batch(3, 1, 5, 'r3'),
      batch(3, 1, 2, 'r6'),
    ]);
    const result = await findMissingAuthors({
      fetcher,
      signal: controller.signal,
      onProgress: () => controller.abort(),
    });
    expect(result).toEqual({
      status: 'cancelled',
      processed: 3,
      found: 1,
      remaining: 5,
    });
    expect(calls).toHaveLength(1);
  });

  it('gives up after an absurd number of batches instead of running for ever', async () => {
    // Each answer moves on to a new place, so only the cap can end this.
    const fetcher = jest.fn<Fetcher>();
    fetcher.mockImplementation(async () =>
      batch(0, 0, 1, `r${fetcher.mock.calls.length}`),
    );
    const result = await findMissingAuthors({
      fetcher,
      signal: new AbortController().signal,
      onProgress: () => undefined,
    });
    expect(result).toMatchObject({
      status: 'stopped',
      reason: 'That is more batches than expected.',
    });
    expect(fetcher).toHaveBeenCalledTimes(1000);
  });
});

describe('progressText and summaryText', () => {
  it('reads "Found N so far, M left"', () => {
    expect(progressText({ found: 2, remaining: 41 })).toBe(
      'Found 2 so far, 41 left',
    );
  });

  it('summarises a finished run', () => {
    expect(
      summaryText({ status: 'done', processed: 8, found: 3, remaining: 0 }),
    ).toBe('Done. Found an author for 3 of 8 recipes.');
    expect(
      summaryText({ status: 'done', processed: 1, found: 1, remaining: 0 }),
    ).toBe('Done. Found an author for 1 of 1 recipe.');
  });

  it('says when there was nothing to do', () => {
    expect(
      summaryText({ status: 'done', processed: 0, found: 0, remaining: 0 }),
    ).toBe('Every recipe with a source page already has an author.');
  });

  it('says a cancelled run stopped, and how far it got', () => {
    expect(
      summaryText({
        status: 'cancelled',
        processed: 3,
        found: 1,
        remaining: 5,
      }),
    ).toBe('Cancelled. Found 1 so far, 5 left.');
  });

  it('gives the reason first for a run that was stopped', () => {
    expect(
      summaryText({
        status: 'stopped',
        reason: 'Too many requests. Try again later.',
        processed: 3,
        found: 1,
        remaining: 5,
      }),
    ).toBe('Too many requests. Try again later. Found 1 so far, 5 left.');
  });
});

describe('findAuthorMessage', () => {
  it('is empty until something happens, so the status line takes no room', () => {
    expect(findAuthorMessage({ kind: 'idle' })).toBe('');
  });

  it('says what is happening and how it ended', () => {
    expect(findAuthorMessage({ kind: 'busy' })).toBe('Looking for the author…');
    expect(findAuthorMessage({ kind: 'found', author: 'Ada' })).toBe(
      'Found the author: Ada.',
    );
    expect(findAuthorMessage({ kind: 'none' })).toBe('No author found');
    expect(findAuthorMessage({ kind: 'drive-not-connected' })).toBe(
      'Connect Google Drive to find the author.',
    );
    expect(findAuthorMessage({ kind: 'failed', message: 'Nope.' })).toBe(
      'Nope.',
    );
  });
});
