/**
 * @packageDocumentation
 *
 * What the MCP server advertises: the catalogue of tools an assistant may call.
 * This module no longer holds what a tool is — each tool carries that itself,
 * in `tools/<tool>.ts` — so there is nothing here to keep in step with a tool's
 * code. It only dresses the registry for the wire, adding the fields that are
 * the same for every tool and that only the catalogue cares about.
 */

import { scopeForTool } from '@/lib/oauth';
import { TOOL_REGISTRY } from '@/domain/mcp/tools';

export type { ToolName } from '@/domain/mcp/tools';

/**
 * The tool catalogue advertised to clients: each tool with its title (both as
 * the tool's own `title` and in `annotations.title`, which older clients read)
 * and the sign-in a call needs.
 */
export const TOOLS = TOOL_REGISTRY.map((tool) => {
  // What sign-in a call needs, tool by tool: ChatGPT asks for each tool to say
  // so even when the whole server asks the same of every caller. Written in
  // `_meta` as well because some MCP libraries drop unknown top-level fields.
  const securitySchemes = [
    { type: 'oauth2', scopes: [scopeForTool(tool.name)] },
  ] as const;
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    ...(tool.outputSchema === undefined
      ? {}
      : { outputSchema: tool.outputSchema }),
    title: tool.title,
    annotations: { title: tool.title, ...tool.annotations },
    securitySchemes,
    _meta: { ...tool.meta, securitySchemes },
  };
});

/** The advertised tool with this name, if there is one. */
export function toolNamed(name: string): (typeof TOOLS)[number] | undefined {
  return TOOLS.find((tool) => tool.name === name);
}
