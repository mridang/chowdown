/**
 * @packageDocumentation
 *
 * Running a `tools/call`. A call arrives as a tool name and untrusted JSON
 * arguments. This module finds the tool, checks the call against that tool's
 * own input schema before anything runs, and hands the checked arguments to it.
 * A call that names no such tool, or whose envelope is malformed, is a protocol
 * error; a call whose arguments do not fit the schema is a mistake the
 * assistant can fix and is answered as an `isError` result that says how (the
 * MCP spec files input validation under tool execution errors, so that a host
 * shows the model what to correct).
 *
 * Nothing here knows what any single tool does — each tool is a class in
 * `tools/`, and this module is the same whatever the tool set is. The things
 * tools reach for (the repositories, the database) are a {@link ToolServices}.
 * In production they are real; a test hands in fakes.
 *
 * A failing database and similar problems the assistant can act on are answered
 * as `isError` results with a message it can relay. Only a mistake in this code
 * escapes as an exception.
 */

import type { User } from '@/domain/db/users';
import { explainFailure } from '@/domain/mcp/app';
import {
  BackendFailureError,
  InvalidToolArgumentsError,
  UnknownToolError,
  canonicalArguments,
  describeArguments,
  isJsonObject,
  type JsonSchema,
  validateJson,
} from '@/lib/mcp';
import { errorResult, type ToolResult } from '@/domain/mcp/tool-results';
import {
  liveToolServices,
  type ToolServices,
} from '@/domain/mcp/tool-services';
import { toolByName, type ToolArgs } from '@/domain/mcp/tools';
import { errorMessage, logError } from '@/utils/logging';

/** What checking a call's arguments needs of the tool it names. */
type ToolSchema = Readonly<{
  name: string;
  inputSchema: JsonSchema;
  aliases?: Readonly<Record<string, string>>;
  listsOfText?: readonly string[];
}>;

/** The arguments of a call that passed the check, or the answer to give when they did not. */
type Checked = { readonly args: ToolArgs } | { readonly refusal: ToolResult };

/**
 * The arguments of a call, checked against the tool's input schema.
 *
 * Arguments that fit are returned (with the alias and list spellings that
 * {@link canonicalArguments} corrects). Arguments that do not fit are a mistake
 * the assistant can correct, so they come back as an `isError` result naming
 * each problem and the arguments the tool takes (the spec lists input validation
 * among tool execution errors, which a host always shows the model).
 * @throws {InvalidToolArgumentsError} If `arguments` is not an object at all: that is
 *   a malformed request, not a mistaken call.
 */
function checkedArguments(tool: ToolSchema, rawArgs: unknown): Checked {
  // Omitted arguments count as none, so the schema can say what is required.
  const given = rawArgs === undefined ? {} : rawArgs;
  if (!isJsonObject(given)) {
    throw new InvalidToolArgumentsError(['`arguments` must be an object.']);
  }
  const args = canonicalArguments(given, tool);
  const problems = validateJson(tool.inputSchema, args, 'The arguments');
  return problems.length > 0
    ? {
        refusal: errorResult(
          `Invalid arguments for ${tool.name}: ${problems.join(' ')} ${describeArguments(tool.inputSchema)}`,
        ),
      }
    : { args };
}

/**
 * Execute a `tools/call` for `user`.
 * @param services - The repositories and database; tests pass fakes.
 * @returns The tool's result; for arguments that do not fit the tool's schema,
 * an `isError` result saying what to change. Nothing is read for those.
 * @throws {UnknownToolError} If no such tool exists.
 * @throws {InvalidToolArgumentsError} If the request has no tool name, or its
 *   `arguments` is not an object (both are malformed requests).
 * @throws {BackendFailureError} If the database failed mid-call.
 */
export async function callTool(
  user: Readonly<User>,
  params: ToolArgs | undefined,
  services: ToolServices = liveToolServices,
): Promise<ToolResult> {
  const name: unknown = params?.['name'];
  if (typeof name !== 'string' || name === '') {
    throw new InvalidToolArgumentsError(['`name` must be the name of a tool.']);
  }
  const tool = toolByName(name);
  if (!tool) {
    throw new UnknownToolError(name);
  }
  const checked = checkedArguments(tool, params?.['arguments']);
  if ('refusal' in checked) {
    return checked.refusal;
  }
  // Before anything is opened, so a refused call costs only the check.
  const refusal = await tool.precheck(user, services);
  return refusal ?? tool.handle(checked.args, user, services);
}

/**
 * Run a `tools/call`. The database can fail mid-call; that is explained in
 * words the assistant can pass on, as a tool error, instead of a protocol error.
 * An unknown tool or a malformed request is still thrown for the router to
 * answer as a protocol error.
 * @param services - The repositories and database; leave out for the real ones.
 */
export async function callToolOrExplain(
  user: Readonly<User>,
  params: ToolArgs | undefined,
  services?: ToolServices,
): Promise<ToolResult> {
  try {
    return await callTool(user, params, services);
  } catch (error) {
    // What this app itself could not do, in words the assistant can act on.
    const explained = explainFailure(error);
    if (explained !== undefined) {
      return errorResult(explained);
    }
    if (error instanceof BackendFailureError) {
      // What actually failed stays in our logs; it can hold database details
      // that should not travel on to an assistant.
      logError({
        event: 'mcp.backend_failed',
        service: error.service,
        error: errorMessage(error.cause),
      });
      return errorResult(
        `Something went wrong with ${error.service}, so that did not work. Try again in a minute; if it keeps failing, tell the user.`,
      );
    }
    throw error;
  }
}
