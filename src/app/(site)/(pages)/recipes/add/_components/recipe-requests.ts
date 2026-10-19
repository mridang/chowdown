/**
 * @packageDocumentation
 *
 * The requests the "Add recipes" flow makes, and the reading of their answers.
 * Both ways of adding a recipe (writing one, importing several) save through
 * the same `POST /api/recipes`, so that request lives here once; what comes
 * back is read as `unknown` and checked, rather than trusted to be the shape
 * the server is expected to send.
 */

/** A prepared, not-yet-saved recipe, from an item of POST /api/recipe-imports. */
export interface ImportDraft {
  /** The recipe's name, to be edited before saving. */
  readonly title: string;
  /** Its Cooklang source; empty when the page could not be converted. */
  readonly cook: string;
  /** The address it was fetched from, when it came from a link. */
  readonly source?: string;
  /** Why this one could not be prepared, when it could not. */
  readonly error?: string;
}

/** An import that has been prepared: its id, and one draft for each recipe found. */
export interface PreparedImport {
  readonly id: string;
  readonly drafts: readonly ImportDraft[];
}

/** Whether a value is a plain object whose members can be looked up by name. */
function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null;
}

/** The value if it is text, otherwise nothing. */
function textOf(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/** Ask the server to save a recipe to the person's Drive. The name is trimmed. */
export function postRecipe(name: string, cooklang: string): Promise<Response> {
  return fetch('/api/recipes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name.trim(), cooklang }),
  });
}

/** The id of the recipe a successful save answered with, or nothing if the answer has none. */
export function createdRecipeId(body: unknown): string | undefined {
  return isRecord(body) ? textOf(body['id']) : undefined;
}

/**
 * Ask the server to fetch and convert whatever the person pasted (links,
 * markdown, text). Preparing can take minutes, so `signal` lets the person
 * give up: aborting it ends the wait (the server may still finish; nothing is
 * saved until they review it).
 */
export function postImport(
  input: string,
  signal?: AbortSignal,
): Promise<Response> {
  return fetch('/api/recipe-imports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input }),
    signal,
  });
}

/**
 * Tell the server an import's drafts have all been dealt with, so it can tidy
 * the import away. Nothing waits on this and nothing can be done if it fails.
 */
export function discardImport(id: string): void {
  void fetch(`/api/recipe-imports/${id}`, { method: 'DELETE' }).catch(
    () => undefined,
  );
}

/**
 * Read the answer to {@link postImport}: the import's id and a draft for each
 * item. Items the server could not read are left out; `undefined` means the
 * answer was not an import at all.
 */
export function readImport(body: unknown): PreparedImport | undefined {
  if (!isRecord(body)) {
    return undefined;
  }
  const id = textOf(body['id']);
  const items = body['items'];
  if (id === undefined || !Array.isArray(items)) {
    return undefined;
  }
  return {
    id,
    drafts: items.filter(isRecord).map((item) => ({
      title: textOf(item['title']) ?? '',
      cook: textOf(item['cooklang']) ?? '',
      source: textOf(item['source_url']),
      error: textOf(item['problem']),
    })),
  };
}
