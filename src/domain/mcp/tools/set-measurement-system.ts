/**
 * @packageDocumentation
 *
 * `set_measurement_system`. Everything the tool is lives here: what the catalogue says about
 * it, the arguments it accepts, and what it does when called.
 */

import { type ToolContent, type ToolContext } from '@/domain/mcp/tool-context';
import { isUnitSystem } from '@/lib/cooklang';
import {
  errorResult,
  McpTool,
  textArg,
  textResult,
  type ToolAnnotations,
  type ToolArgs,
  type ToolResult,
  writes,
} from '@/lib/mcp';
import { z } from 'zod';

export class SetMeasurementSystemTool extends McpTool<
  'set_measurement_system',
  ToolContext,
  ToolContent
> {
  readonly name = 'set_measurement_system';

  readonly title = 'Set measurement system';

  readonly description =
    "Stores the user's preferred measurement system (metric, us or imperial); recipes are shown in it from then on.";

  readonly input = z
    .object({
      system: z
        .enum(['metric', 'us', 'imperial'])
        .describe('metric, us, or imperial'),
    })
    .strict();

  readonly annotations: ToolAnnotations = writes({ idempotent: true });

  override async handle(
    args: ToolArgs,
    { user, services }: ToolContext,
  ): Promise<ToolResult<ToolContent>> {
    const system = textArg(args['system']).toLowerCase();
    if (!isUnitSystem(system)) {
      return errorResult('Please choose metric, us, or imperial.');
    }
    await services.setUnits(user.id, system);
    return textResult(
      `Done — I'll show recipes in ${system} units from now on.`,
    );
  }
}
