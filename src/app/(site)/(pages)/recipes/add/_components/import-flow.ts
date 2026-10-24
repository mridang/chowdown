/**
 * @packageDocumentation
 *
 * The decisions behind the "Add recipes" wizard that do not need a screen:
 * what preparing an import ended in, what to tell a screen-reader user as it
 * goes, and which fields are missing. Kept out of the component so each can be
 * checked without a browser.
 */

import { problemMessage } from '@/lib/rest-json/problem-message';

import {
  postImport,
  readImport,
  type PreparedImport,
} from '@/app/(site)/(pages)/recipes/add/_components/recipe-requests';

/** Where the wizard is: pasting, stepping through the drafts, or finished. */
export type Phase = 'input' | 'review' | 'done';

/** How preparing an import ended: drafts ready, given up on, or a reason it failed. */
export type PrepareOutcome =
  | Readonly<{ kind: 'prepared'; prepared: PreparedImport }>
  | Readonly<{ kind: 'cancelled' }>
  | Readonly<{ kind: 'failed'; message: string }>;

/** What is shown when the server answers, but not with an import. */
const UNREADABLE_MESSAGE = 'Could not prepare those recipes.';

/**
 * Send the pasted text to be prepared and say how it ended. Never throws.
 *
 * Aborting `signal` is the person pressing Cancel, so it ends as `cancelled`
 * rather than as an error: nothing went wrong, and nothing should be shown as if
 * it had.
 *
 * @param input The links and text the person pasted.
 * @param signal Aborted when the person cancels.
 */
export async function prepareImport(
  input: string,
  signal: AbortSignal,
): Promise<PrepareOutcome> {
  try {
    const res = await postImport(input, signal);
    if (!res.ok) {
      return { kind: 'failed', message: await problemMessage(res) };
    }
    const prepared = readImport(await res.json());
    return prepared
      ? { kind: 'prepared', prepared }
      : { kind: 'failed', message: UNREADABLE_MESSAGE };
  } catch (error) {
    // `signal.aborted`, not the error's name: a cancel can surface as an
    // AbortError from the request or as a failure reading the answer.
    return signal.aborted
      ? { kind: 'cancelled' }
      : {
          kind: 'failed',
          message:
            error instanceof Error && error.message
              ? error.message
              : UNREADABLE_MESSAGE,
        };
  }
}

/**
 * The sentences read out to screen-reader users as the wizard works. They go in
 * a polite live region, which announces when its text changes and says nothing
 * of what was there before.
 */
export const ANNOUNCEMENTS = {
  /** Preparing can take minutes, with only a button label changing on screen. */
  preparing:
    'Preparing your recipes. Fetching links and converting them can take a minute or two.',
  /** The person pressed Cancel. */
  cancelled: 'Cancelled. Nothing was prepared.',
  /** A save is under way. */
  saving: 'Saving this recipe.',
  /**
   * A recipe was saved and the next draft is on screen. Focus stays on the Save
   * button, so without this nothing says the form below it has changed.
   *
   * @param next Which draft is showing now (1-based).
   * @param total How many drafts there are.
   */
  savedNext: (next: number, total: number): string =>
    `Saved. Now showing recipe ${next} of ${total}.`,
} as const;

/** The problems with a draft's fields, by field; a field that is fine is absent. */
export interface FieldErrors {
  readonly name?: string;
  readonly cook?: string;
}

/**
 * What is missing from a draft that is about to be saved. Each message is tied
 * to its own field in the form, so it is read out with that field rather than
 * as a loose line somewhere below.
 */
export function missingFieldErrors(name: string, cook: string): FieldErrors {
  return {
    ...(name.trim() ? {} : { name: 'Give the recipe a name.' }),
    ...(cook.trim() ? {} : { cook: 'The recipe needs some Cooklang.' }),
  };
}
