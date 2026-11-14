/**
 * @packageDocumentation
 *
 * What this app's connector has of its own, read by the shared OAuth and MCP
 * code (`lib/oauth/`, `lib/mcp/`): the names of its two scopes and what they
 * allow in words, which tools only read, the name its protected resource goes
 * by, which scopes it offers and what its own failures mean. Everything in
 * those libraries is the same in every app.
 *
 * What a single tool forgives or advertises is not here: a tool carries that
 * itself, in `tools/<tool>.ts`.
 */

import { DriveNotConnectedError } from '@/domain/auth/drive-access';
import { SITE_URL } from '@/utils/site';

/** May browse, search and view recipes. */
export const SCOPE_READ = 'recipes:read';
/** May change recipes, the user's settings and their notes (implies read). */
export const SCOPE_WRITE = 'recipes:write';

/** What each scope lets the app do, in plain words, for the approval screen. */
export const SCOPE_TEXT: Readonly<Record<string, string>> = {
  [SCOPE_READ]: 'See your recipes, search them and find similar ones',
  [SCOPE_WRITE]:
    'Add, edit, tag, favourite and annotate recipes, and change your settings',
};

/**
 * What a read-only connection may still do, in a few words, for the approval
 * screen's choice to allow less than the app asked for ("Read only: …, but
 * change nothing").
 */
export const READ_ONLY_TEXT = 'see and search recipes';

/**
 * Tools that only read. Anything not listed here is treated as a write, so a
 * newly added tool is protected by default until someone classifies it.
 */
export const READ_ONLY_TOOLS: ReadonlySet<string> = new Set([
  'list_recipes',
  'search_recipes',
  'find_recipes',
  'find_similar',
  'get_recipe',
  'browse_recipes',
  'recipes_from_ingredients',
  'list_filters',
]);

/** The name of the protected resource, in its RFC 9728 metadata. */
export const RESOURCE_NAME = 'Chowdown recipes';

/**
 * The scopes this app offers. A scope that is named above but left out here is
 * understood and never granted, so a call that needs it is refused: that is how
 * an app names a scope before it has a tool that needs one.
 */
export const SUPPORTED_SCOPES = [SCOPE_READ, SCOPE_WRITE] as const;

/**
 * The failures of this app's own making that an assistant can act on, as the
 * words to tell it, or undefined when the failure is not one of them and should
 * be handled as a backend failure or thrown.
 *
 * It lives here rather than in the call path because what can go wrong is the
 * app's own business: every app's `tool-calls.ts` is the same file.
 */
export function explainFailure(error: unknown): string | undefined {
  return error instanceof DriveNotConnectedError
    ? `Google Drive isn't connected to Chowdown yet, so there are no recipes to reach. Ask the user to open ${SITE_URL}/app, choose "Connect Google Drive", and then try again.`
    : undefined;
}
