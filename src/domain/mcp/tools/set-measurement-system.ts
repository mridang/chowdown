/**
 * @packageDocumentation
 *
 * `set_measurement_system`. Everything the tool is lives here: what the catalogue says about
 * it, the arguments it accepts, and what it does when called.
 */

import { type User } from '@/domain/db/users';
import {
  errorResult,
  textResult,
  type ToolResult,
} from '@/domain/mcp/tool-results';
import { type ToolServices } from '@/domain/mcp/tool-services';
import {
  McpTool,
  type ToolAnnotations,
  type ToolArgs,
  writes,
} from '@/domain/mcp/tools/tool';
import { isUnitSystem } from '@/lib/cooklang';
import { type JsonSchema, textArg } from '@/lib/mcp';

export class SetMeasurementSystemTool extends McpTool<'set_measurement_system'> {
  readonly name = 'set_measurement_system';

  readonly title = 'Set measurement system';

  readonly description =
    "Stores the user's preferred measurement system (metric, us or imperial); recipes are shown in it from then on.";

  readonly inputSchema: JsonSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      system: {
        type: 'string',
        enum: ['metric', 'us', 'imperial'],
        description: 'metric, us, or imperial',
      },
    },
    required: ['system'],
  };

  readonly annotations: ToolAnnotations = writes({ idempotent: true });

  override async handle(
    args: ToolArgs,
    user: Readonly<User>,
    services: ToolServices,
  ): Promise<ToolResult> {
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
