/**
 * @packageDocumentation
 *
 * The `structuredContent` contracts shared between the MCP server (which builds
 * them) and the MCP Apps Views (React components that render them). Keeping one
 * typed shape means the server and the iframe can't drift, and the recipe card
 * reuses {@link ParsedRecipe} directly so the same {@link RecipeView} component
 * renders in the app and in the ChatGPT/Claude card.
 *
 * These types ARE the tool `outputSchema` payloads: a tool returns
 * `structuredContent` matching one of these, and the View reads it via the
 * ext-apps `App.ontoolresult` handler (`params.structuredContent`).
 */

import type { ParsedRecipe } from '@/lib/cooklang/cooklang';

/** One dated cooking-log entry surfaced in the card/fullscreen view. */
export interface RecipeLogEntry {
  readonly date: string;
  readonly note: string;
}

/**
 * The payload a single-recipe render-tool (`get_recipe`, `add_recipe`,
 * `import_recipe`, `capture_idea`, `log_cooking`) returns as `structuredContent`.
 * Extends the parsed recipe so the View can hand it straight to `RecipeView`,
 * plus the Drive id (for follow-up tool calls), the uncurated flag, the source,
 * and any cooking log.
 */
export interface RecipeCardData extends ParsedRecipe {
  /** Drive file id — lets the View call tools (e.g. log_cooking) for this recipe. */
  readonly id: string;
  /** True when this is an uncurated idea stub (shows an "idea" badge). */
  readonly uncurated: boolean;
  /** Source URL, when the recipe was imported from one. */
  readonly source?: string;
  /** Dated cooking-log entries parsed from the `.cook` file. */
  readonly logs: readonly RecipeLogEntry[];
}

/** A single entry in the recipe-list view. */
export interface RecipeListItem {
  readonly id: string;
  readonly title: string;
  readonly uncurated: boolean;
}

/**
 * The payload the list render-tools (`list_recipes`, `search_recipes`) return
 * as `structuredContent` for the list/grid View.
 */
export interface RecipeListData {
  readonly recipes: readonly RecipeListItem[];
  /** The search query, when this came from `search_recipes`. */
  readonly query?: string;
}
