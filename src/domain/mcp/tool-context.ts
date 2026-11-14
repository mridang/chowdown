/**
 * @packageDocumentation
 *
 * What this app hands its tools, and how it answers the two questions the MCP
 * library asks of every app: which scopes it offers, and which of its own
 * failures are worth explaining to an assistant.
 */

import { ReadWriteScopes, type FailureExplainer } from '@/lib/mcp';
import type { RecipeCardData, RecipeListData } from '@/domain/mcp/ui-types';
import type { User } from '@/domain/db/users';
import { SCOPE_READ, SCOPE_WRITE, explainFailure } from '@/domain/mcp/app';
import {
  liveToolServices,
  type ToolServices,
} from '@/domain/mcp/tool-services';

/**
 * What every tool in this app is given: who is calling, and the outside things
 * the tools reach for. Drive, the database and the models are opened through
 * `services` when a tool asks for them, so a tool that needs none of them pays
 * for none of them.
 */
export interface ToolContext {
  readonly user: Readonly<User>;
  readonly services: ToolServices;
}

/**
 * The context for a real call.
 * @param user - Who is calling.
 * @param services - The database, Drive and models; a test passes fakes.
 */
export function toolContext(
  user: Readonly<User>,
  services: ToolServices = liveToolServices,
): ToolContext {
  return { user, services };
}

/**
 * What this app's tools return as structured content: whatever the card view or
 * the list view draws. A tool that answers in words alone returns none.
 */
export type ToolContent = RecipeCardData | RecipeListData;

/** Which sign-in a call needs, by what the tool says about its own effects. */
export const TOOL_SCOPES = new ReadWriteScopes(SCOPE_READ, SCOPE_WRITE);

/** The failures of this app's own making that an assistant can act on. */
export const TOOL_FAILURES: FailureExplainer = { explain: explainFailure };
