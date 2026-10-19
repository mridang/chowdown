/**
 * @packageDocumentation
 *
 * The requests behind "Find the author" and what to tell the person about how
 * they went. There are two: finding the author of one recipe (the button on
 * the recipe page) and sweeping every saved recipe that has a source page but
 * no author (the bulk action in the account menu). Both call the server's
 * `/rpc/find-author` and never throw: every way they can end, including the
 * person giving up, is a value the screen can show. The functions are pure
 * apart from the `fetch` they are handed, so each can be checked without a
 * browser.
 */

import { problemMessage } from '@/lib/problem-message';

/** The one thing these requests need from the network, so a test can supply its own. */
export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

/** The browser's own `fetch`, wrapped so it is never called on the wrong `this`. */
const browserFetch: Fetcher = (input, init) => fetch(input, init);

/** Where the server finds authors. */
const ENDPOINT = '/rpc/find-author';

/** How many recipes one bulk request asks the server to look at. */
const BATCH_SIZE = 3;

/**
 * The most bulk requests one run will make, however the server answers. At
 * three recipes each this is far more than anyone has; it is a stop for a
 * server that never says it is finished, not a limit anyone should meet.
 */
const MAX_BATCHES = 1000;

/** The problem type the server answers with when Google Drive is not connected. */
const DRIVE_NOT_CONNECTED = '/problems/drive-not-connected';

/** Whether a value is an object whose members can be looked up by name. */
function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null;
}

/** A number the server sent, if it is a whole number of zero or more. */
function countOf(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : undefined;
}

/** The sentence for a response that is not a success, and whether it means "connect Drive". */
async function refusal(
  res: Response,
): Promise<Readonly<{ message: string; driveNotConnected: boolean }>> {
  if (res.status === 409) {
    // Read a copy: the body can only be read once, and `problemMessage` wants it too.
    const body: unknown = await res
      .clone()
      .json()
      .catch(() => undefined);
    const type = isRecord(body) ? body['type'] : undefined;
    if (typeof type === 'string' && type.endsWith(DRIVE_NOT_CONNECTED)) {
      return {
        message: 'Google Drive is not connected.',
        driveNotConnected: true,
      };
    }
  }
  const message =
    res.status === 401
      ? 'Sign in again to find authors.'
      : res.status === 429
        ? 'Too many requests. Try again later.'
        : res.status === 502
          ? 'A recipe’s source page could not be reached. Try again later.'
          : await problemMessage(res);
  return { message, driveNotConnected: false };
}

/** How asking for one recipe's author ended. */
export type FindAuthorOutcome =
  | Readonly<{ kind: 'found'; author: string }>
  | Readonly<{ kind: 'none' }>
  | Readonly<{ kind: 'drive-not-connected' }>
  | Readonly<{ kind: 'failed'; message: string }>;

/**
 * Ask the server to find and save the author of one recipe from its source
 * page (`POST /rpc/find-author`). `found` means an author was saved; `none`
 * means nothing credible was found (or the recipe already had one), which is an
 * answer and not an error.
 *
 * @param recipeId The recipe's Drive file id.
 * @param fetcher How to make the request; the browser's `fetch` by default.
 */
export async function findAuthor(
  recipeId: string,
  fetcher: Fetcher = browserFetch,
): Promise<FindAuthorOutcome> {
  try {
    const res = await fetcher(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipe_id: recipeId }),
    });
    if (!res.ok) {
      const { message, driveNotConnected } = await refusal(res);
      return driveNotConnected
        ? { kind: 'drive-not-connected' }
        : { kind: 'failed', message };
    }
    const body: unknown = await res.json();
    const author = isRecord(body) ? body['author'] : undefined;
    const saved = isRecord(body) && body['saved'] === true;
    return saved && typeof author === 'string' && author.trim() !== ''
      ? { kind: 'found', author }
      : { kind: 'none' };
  } catch {
    // Not the server's words: a network failure's "Failed to fetch" helps nobody.
    return { kind: 'failed', message: 'Could not look for the author.' };
  }
}

/** How far a bulk run has got: recipes looked at, authors found, and recipes still to do. */
export type BatchTotals = Readonly<{
  processed: number;
  found: number;
  remaining: number;
}>;

/** How a bulk run ended, with its totals: finished, cancelled by the person, or stopped for a reason. */
export type BatchRun = BatchTotals &
  (
    | Readonly<{ status: 'done' }>
    | Readonly<{ status: 'cancelled' }>
    | Readonly<{ status: 'stopped'; reason: string }>
  );

/** One answer from the batch endpoint, checked. */
type Batch = BatchTotals & Readonly<{ next: string | null }>;

/** A batch answer read from untrusted JSON, or nothing when it is not the shape promised. */
function readBatch(body: unknown): Batch | undefined {
  if (!isRecord(body)) {
    return undefined;
  }
  const processed = countOf(body['processed']);
  const found = countOf(body['found']);
  const remaining = countOf(body['remaining']);
  const next = body['next'];
  return processed !== undefined &&
    found !== undefined &&
    remaining !== undefined &&
    (next === null || typeof next === 'string')
    ? { processed, found, remaining, next }
    : undefined;
}

/** What asking for one batch came to. */
type BatchResponse =
  | Readonly<{ kind: 'batch'; batch: Batch }>
  | Readonly<{ kind: 'cancelled' }>
  | Readonly<{ kind: 'refused'; reason: string }>;

/** Ask for the next batch after `after` (empty to start), turning every failure into a value. */
async function requestBatch(
  after: string,
  fetcher: Fetcher,
  signal: AbortSignal,
): Promise<BatchResponse> {
  const query = new URLSearchParams({
    after,
    limit: String(BATCH_SIZE),
  }).toString();
  try {
    const res = await fetcher(`${ENDPOINT}?${query}`, { signal });
    if (!res.ok) {
      return { kind: 'refused', reason: (await refusal(res)).message };
    }
    const batch = readBatch(await res.json());
    return batch
      ? { kind: 'batch', batch }
      : {
          kind: 'refused',
          reason: 'The server sent an answer we could not read.',
        };
  } catch {
    // `signal.aborted`, not the error's name: a cancel can surface as an
    // AbortError from the request or as a failure reading the answer.
    return signal.aborted
      ? { kind: 'cancelled' }
      : { kind: 'refused', reason: 'The connection failed.' };
  }
}

/**
 * Look for the author of every saved recipe that has a source page but no
 * author, a few at a time (`GET /rpc/find-author`), until the server says there
 * is nothing left. It stops on the first answer that is not a success and says
 * why; it never retries on its own, because a refusal such as "too many
 * requests" is exactly when to leave the server alone.
 *
 * @param options.signal Aborted when the person cancels; the run then ends as `cancelled`.
 * @param options.onProgress Told the running totals after each batch.
 * @param options.fetcher How to make requests; the browser's `fetch` by default.
 */
export async function findMissingAuthors({
  signal,
  onProgress,
  fetcher = browserFetch,
}: Readonly<{
  signal: AbortSignal;
  onProgress: (totals: BatchTotals) => void;
  fetcher?: Fetcher;
}>): Promise<BatchRun> {
  // Recursion, not a loop, so the totals are values handed on and never a
  // variable that is added to.
  const step = async (
    after: string,
    totals: BatchTotals,
    batches: number,
  ): Promise<BatchRun> => {
    if (signal.aborted) {
      return { ...totals, status: 'cancelled' };
    }
    if (batches >= MAX_BATCHES) {
      return {
        ...totals,
        status: 'stopped',
        reason: 'That is more batches than expected.',
      };
    }
    const response = await requestBatch(after, fetcher, signal);
    if (response.kind === 'cancelled') {
      return { ...totals, status: 'cancelled' };
    }
    if (response.kind === 'refused') {
      return { ...totals, status: 'stopped', reason: response.reason };
    }
    const { batch } = response;
    const next: BatchTotals = {
      processed: totals.processed + batch.processed,
      found: totals.found + batch.found,
      remaining: batch.remaining,
    };
    onProgress(next);
    if (batch.next === null) {
      return { ...next, status: 'done' };
    }
    // A server that hands back the same place twice would otherwise be asked
    // the same question for ever.
    return batch.next === after
      ? { ...next, status: 'stopped', reason: 'The server did not move on.' }
      : step(batch.next, next, batches + 1);
  };
  return step('', { processed: 0, found: 0, remaining: 0 }, 0);
}

/** "1 recipe", "3 recipes". */
function recipes(count: number): string {
  return `${count} ${count === 1 ? 'recipe' : 'recipes'}`;
}

/** The running line: "Found 2 so far, 41 left". */
export function progressText({
  found,
  remaining,
}: Pick<BatchTotals, 'found' | 'remaining'>): string {
  return `Found ${found} so far, ${remaining} left`;
}

/**
 * The closing sentence for a bulk run, whichever way it ended. A run that
 * stops early gives its reason first and then how far it got, so the person
 * knows both what went wrong and that what was found is kept.
 */
export function summaryText(run: BatchRun): string {
  switch (run.status) {
    case 'done':
      return run.processed === 0
        ? 'Every recipe with a source page already has an author.'
        : `Done. Found an author for ${run.found} of ${recipes(run.processed)}.`;
    case 'cancelled':
      return `Cancelled. ${progressText(run)}.`;
    case 'stopped':
      return `${run.reason} ${progressText(run)}.`;
  }
}

/** What the "Find the author" button area is showing: nothing yet, working, or how it ended. */
export type FindAuthorState =
  | Readonly<{ kind: 'idle' }>
  | Readonly<{ kind: 'busy' }>
  | FindAuthorOutcome;

/**
 * The sentence for the status line beside "Find the author", read out by
 * screen readers as it changes. Empty before anything has happened, so the line
 * takes no room. "No author found" is deliberately quiet: not finding one is
 * ordinary, not an error.
 */
export function findAuthorMessage(state: FindAuthorState): string {
  switch (state.kind) {
    case 'idle':
      return '';
    case 'busy':
      return 'Looking for the author…';
    case 'found':
      return `Found the author: ${state.author}.`;
    case 'none':
      return 'No author found';
    case 'drive-not-connected':
      return 'Connect Google Drive to find the author.';
    case 'failed':
      return state.message;
  }
}
