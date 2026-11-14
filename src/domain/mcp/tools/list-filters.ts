/**
 * @packageDocumentation
 *
 * `list_filters`. Everything the tool is lives here: what the catalogue says about
 * it, the arguments it accepts, and what it does when called.
 */

import { type User } from '@/domain/db/users';
import { type ToolResult } from '@/domain/mcp/tool-results';
import { type ToolServices } from '@/domain/mcp/tool-services';
import { runScenario } from '@/domain/mcp/tools/recipe-support';
import {
  McpTool,
  READS,
  type ToolAnnotations,
  type ToolArgs,
} from '@/domain/mcp/tools/tool';
import { type JsonSchema } from '@/lib/mcp';

export class ListFiltersTool extends McpTool<'list_filters'> {
  readonly name = 'list_filters';

  readonly title = 'List recipe filters';

  readonly description =
    "Lists the values the user's saved recipes hold for each filter (cuisine, eating style, protein, category, difficulty and so on), with counts. These are the values browse_recipes accepts.";

  readonly inputSchema: JsonSchema = {
    type: 'object',
    additionalProperties: false,
  };

  readonly annotations: ToolAnnotations = READS;

  override async handle(
    args: ToolArgs,
    user: Readonly<User>,
    services: ToolServices,
  ): Promise<ToolResult> {
    return runScenario(user, 'list_filters', args, services);
  }
}
