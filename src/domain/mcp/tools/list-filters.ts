/**
 * @packageDocumentation
 *
 * `list_filters`. Everything the tool is lives here: what the catalogue says about
 * it, the arguments it accepts, and what it does when called.
 */

import { type ToolContent, type ToolContext } from '@/domain/mcp/tool-context';
import { runScenario } from '@/domain/mcp/tools/recipe-support';
import {
  McpTool,
  READS,
  type ToolAnnotations,
  type ToolArgs,
  type ToolResult,
} from '@/lib/mcp';
import { z } from 'zod';

export class ListFiltersTool extends McpTool<
  'list_filters',
  ToolContext,
  ToolContent
> {
  readonly name = 'list_filters';

  readonly title = 'List recipe filters';

  readonly description =
    "Lists the values the user's saved recipes hold for each filter (cuisine, eating style, protein, category, difficulty and so on), with counts. These are the values browse_recipes accepts.";

  readonly input = z.object({}).strict();

  readonly annotations: ToolAnnotations = READS;

  override async handle(
    args: ToolArgs,
    { user, services }: ToolContext,
  ): Promise<ToolResult<ToolContent>> {
    return runScenario(user, 'list_filters', args, services);
  }
}
