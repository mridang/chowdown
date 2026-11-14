/**
 * @packageDocumentation
 *
 * What an MCP tool is. Each tool is one class in this directory extending
 * {@link McpTool}, and it carries everything about itself in one place: the
 * name an assistant calls, what the catalogue says about it, the schema its
 * arguments are checked against, the looser spellings it forgives, and what it
 * does when called.
 *
 * It is one class rather than a row in several tables because the tables could
 * disagree. A tool used to need a definition, a presentation entry and a
 * handler, each in a different module, and nothing but a hand-written
 * `Record<ToolName, …>` and a runtime throw kept them in step. Here a tool that
 * forgets any part of itself does not compile, and "advertised but not
 * implemented" cannot be written down at all.
 *
 * This file is the same in every app. What differs between them is each app's
 * own {@link ToolServices}, which is where anything an app's tools reach for
 * lives, and the tools themselves.
 *
 * Anything slow or costly a tool needs — a Drive connection, a database, a
 * model — is opened through `services` when the tool asks for it, never before.
 * That is what keeps this base and the call path free of per-tool special cases:
 * a tool that never asks never pays, so there is no list of tools to skip and no
 * flag saying what to open.
 */

import type { JsonSchema } from '@/lib/mcp';
import type { User } from '@/domain/db/users';
import type { ToolResult } from '@/domain/mcp/tool-results';
import type { ToolServices } from '@/domain/mcp/tool-services';

/** The arguments of a tool call, before they are checked against the schema. */
export type ToolArgs = Readonly<Record<string, unknown>>;

/**
 * What a tool tells hosts about its effects (the MCP spec's `ToolAnnotations`).
 * Hosts use these to decide when to ask the person before a call, so each is
 * set from what the tool's code really does, not from what its name suggests.
 */
export interface ToolAnnotations {
  readonly readOnlyHint: boolean;
  readonly destructiveHint: boolean;
  readonly idempotentHint: boolean;
  readonly openWorldHint: boolean;
}

/**
 * The hints of a tool that only reads from the app's own records. The
 * open-world hint is false because those records are a closed world.
 */
export const READS: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

/** Like {@link READS}, for a tool that reads the open web as well. */
export const READS_THE_WEB: ToolAnnotations = { ...READS, openWorldHint: true };

/**
 * The hints of a tool that changes something.
 * @param effects - `destructive` when it may remove or overwrite something the
 *   person cannot get back, `idempotent` when calling it twice with the same
 *   arguments leaves the same state as calling it once, and `openWorld` when it
 *   reaches the open web. All three default to false, which describes a tool
 *   that adds something new to the app's own records.
 */
export function writes(
  effects: {
    readonly destructive?: boolean;
    readonly idempotent?: boolean;
    readonly openWorld?: boolean;
  } = {},
): ToolAnnotations {
  return {
    readOnlyHint: false,
    destructiveHint: effects.destructive === true,
    idempotentHint: effects.idempotent === true,
    openWorldHint: effects.openWorld === true,
  };
}

/**
 * One tool: what it is called, what it says about itself and what it does.
 *
 * `Name` is the tool's own name as a literal type, so the union of every tool's
 * name can be read back off the registry and a misspelled name is a compile
 * error rather than a call that finds no tool.
 */
export abstract class McpTool<Name extends string = string> {
  /** The name an assistant calls, in `snake_case`. */
  abstract readonly name: Name;

  /** The name shown in a host's interface. */
  abstract readonly title: string;

  /**
   * What the tool does and returns. Advice on *when* to use which tool belongs
   * in the server's instructions, not here.
   */
  abstract readonly description: string;

  /**
   * The arguments the tool accepts. This is a promise, not documentation: every
   * call is checked against it before anything runs. Written in JSON Schema
   * 2020-12 using only the keywords the checker understands.
   */
  abstract readonly inputSchema: JsonSchema;

  /** The shape of the `structuredContent` this tool returns, where it has one. */
  readonly outputSchema?: JsonSchema;

  /** What the tool tells hosts about its effects. */
  abstract readonly annotations: ToolAnnotations;

  /**
   * Anything this tool adds to its catalogue entry's `_meta`, such as the
   * widget a host should show its result in. The sign-in a call needs is added
   * for every tool and does not belong here.
   */
  readonly meta?: Readonly<Record<string, unknown>>;

  /**
   * Older or looser spellings of this tool's arguments, and the canonical name
   * each one stands for. The catalogue lists only the canonical names, so a
   * model sees one way to say each thing and the input schema stays closed; a
   * connector that cached an earlier catalogue, or a model carrying an argument
   * over from a similar tool, is corrected rather than refused.
   */
  readonly aliases?: Readonly<Record<string, string>>;

  /**
   * Arguments this tool declares as a list of text but that models often send
   * as one piece of text ("3 tomatoes and 400 g pasta"). Such a value is
   * wrapped into a one-item list before the arguments are checked.
   */
  readonly listsOfText?: readonly string[];

  /**
   * Run before anything is opened and before {@link handle}, once the arguments
   * have been checked. A result refuses the call, so a refusal costs nothing
   * but the check itself. Undefined means carry on.
   *
   * This is for a limit that applies to the call rather than to its arguments,
   * such as a daily allowance. Checks on the arguments belong in
   * {@link inputSchema}, and anything that needs the person's data belongs in
   * {@link handle}.
   */
  async precheck(
    _user: Readonly<User>,
    _services: ToolServices,
  ): Promise<ToolResult | undefined> {
    return undefined;
  }

  /**
   * Run the call. The arguments have already been checked against
   * {@link inputSchema} and corrected for {@link aliases} and
   * {@link listsOfText}, so this does not revalidate them.
   *
   * Problems the assistant can act on (a failing database, a missing
   * connection) are raised as the errors `lib/mcp` and the app define, and
   * answered as `isError` results further up; only a mistake in this code
   * escapes as an exception.
   * @param args - The checked arguments of the call.
   * @param user - Who is calling.
   * @param services - What this app's tools reach for; tests pass fakes.
   */
  abstract handle(
    args: ToolArgs,
    user: Readonly<User>,
    services: ToolServices,
  ): Promise<ToolResult>;
}
