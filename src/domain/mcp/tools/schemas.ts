/**
 * @packageDocumentation
 *
 * The pieces more than one tool is built from: the shapes of the structured
 * content the Views draw, the `_meta` that points a host at those Views, and
 * the argument fragments (a recipe reference, a query, an offset) that several
 * tools accept in the same words.
 *
 * They live beside the tools rather than inside one of them because a schema
 * two tools share must be the same schema: an assistant that learns what
 * `recipe` means from one tool should not meet a different rule in the next.
 */

import {
  CARD_RESOURCE_URI,
  LIST_RESOURCE_URI,
} from '@/domain/mcp/ui-resources';
import { NOT_BLANK } from '@/lib/mcp';

/** JSON Schema for the recipe-card `structuredContent` (a parsed recipe + extras). */
export const RECIPE_CARD_OUTPUT_SCHEMA = {
  type: 'object',
  required: [
    'id',
    'title',
    'uncurated',
    'metadata',
    'ingredients',
    'cookware',
    'steps',
    'logs',
  ],
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    uncurated: { type: 'boolean' },
    source: { type: 'string' },
    metadata: {
      type: 'array',
      items: { type: 'array', items: { type: 'string' } },
    },
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'quantity'],
        properties: { name: { type: 'string' }, quantity: { type: 'string' } },
      },
    },
    cookware: { type: 'array', items: { type: 'string' } },
    steps: {
      type: 'array',
      items: {
        type: 'array',
        items: {
          type: 'object',
          required: ['kind'],
          properties: { kind: { type: 'string' } },
        },
      },
    },
    logs: {
      type: 'array',
      items: {
        type: 'object',
        required: ['date', 'note'],
        properties: { date: { type: 'string' }, note: { type: 'string' } },
      },
    },
  },
} as const;

/**
 * The `_meta` that links a tool to the View that draws its result, and the
 * words a host shows while the call runs and when it is done (ChatGPT; kept to
 * 64 characters). The View's address is given three ways because hosts read
 * different ones: `ui.resourceUri` (the MCP Apps spec), the flat
 * `ui/resourceUri` (the older form, which the official SDK still writes "for
 * compatibility with older hosts") and `openai/outputTemplate` (ChatGPT).
 */
export function viewMeta<const Uri extends string>(
  uri: Uri,
  invoking: string,
  invoked: string,
) {
  return {
    ui: { resourceUri: uri },
    'ui/resourceUri': uri,
    'openai/outputTemplate': uri,
    'openai/toolInvocation/invoking': invoking,
    'openai/toolInvocation/invoked': invoked,
  } as const;
}

/**
 * Lets the View call the tool itself. ChatGPT only passes a widget's tool calls
 * through for tools that say so; MCP Apps hosts allow it by default (a tool's
 * `visibility` defaults to both the model and the app). Only the read tools the
 * Views call back into carry it, never one that writes.
 */
export const WIDGET_CALLABLE = { 'openai/widgetAccessible': true } as const;

/** The `_meta` for a tool that draws the recipe card, by what the tool is doing. */
export const cardMeta = (invoking: string, invoked: string) =>
  viewMeta(CARD_RESOURCE_URI, invoking, invoked);

/** The `_meta` for a tool that draws the recipe list, by what the tool is doing. */
export const listMeta = (invoking: string, invoked: string) =>
  viewMeta(LIST_RESOURCE_URI, invoking, invoked);

/** JSON Schema for the recipe-list `structuredContent`. */
export const RECIPE_LIST_OUTPUT_SCHEMA = {
  type: 'object',
  required: ['recipes'],
  properties: {
    query: { type: 'string' },
    recipes: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'title', 'uncurated'],
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          uncurated: { type: 'boolean' },
        },
      },
    },
  },
} as const;

/** The longest recipe name or id a tool accepts, in characters (Drive allows 255 in a file name). */
export const NAME_MAX = 300;

/** A reference to a saved recipe: its name or its id, never blank. */
export const RECIPE_REFERENCE = {
  type: 'string',
  minLength: 1,
  maxLength: NAME_MAX,
  pattern: NOT_BLANK,
} as const;

/** The most results a question-shaped tool (browse, pantry) may be asked for. */
export const LIMIT_MAX = 50;

/** How many recipes a plain listing returns when no `limit` is given. */
export const PAGE_DEFAULT = 50;

/** The most recipes one page of a plain listing (all recipes, a name search) may hold. */
export const PAGE_MAX = 200;

/** The furthest into a result an `offset` may reach. */
export const OFFSET_MAX = 100_000;

/** `offset`: how many results to skip, to read the next page of a long result. */
export const OFFSET = {
  type: 'integer',
  minimum: 0,
  maximum: OFFSET_MAX,
  description:
    'How many results to skip, to read the next page (default 0). A result that was cut short says which offset comes next.',
} as const;

/** A text filter such as a cuisine or a list of them. */
export const FACET_TEXT = { type: 'string', maxLength: 200 } as const;

/** A search query: some text with something in it. */
export const QUERY = {
  type: 'string',
  minLength: 1,
  maxLength: 500,
  pattern: NOT_BLANK,
} as const;

/** A web address a tool may record or fetch: http or https. */
export const WEB_URL = {
  type: 'string',
  maxLength: 2048,
  pattern: String.raw`^https?://\S+$`,
} as const;

/**
 * The largest block of page text or Cooklang a tool takes, in characters. The
 * whole call travels as one JSON body of at most a mebibyte, and JSON can spend
 * six bytes on a single character (`\u0000`), so this is kept to a sixth of
 * that: a call that is within the limit here is never refused by the transport
 * for size, which the assistant would see only as a failed request. (A test
 * checks the two numbers against each other.) It is also far more than a recipe
 * needs: the converter reads little past the first twelve thousand characters.
 */
export const CONTENT_MAX = 150_000;

/** The most image links a tool takes at once. */
export const IMAGES_MAX = 20;
