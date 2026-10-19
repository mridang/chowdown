/**
 * @packageDocumentation
 *
 * How a tile or button in a View gets the assistant to do something. There is
 * more than one route and they are not equally available: ChatGPT's own
 * follow-up message, the MCP Apps `ui/message` request (which standard hosts
 * such as Claude and VS Code accept). The Views try them in order until one
 * works, so a tap never silently does nothing; a View that has neither can still
 * call a tool directly through the host and draw the answer itself.
 */

/** A route for a View to act on the person's behalf. */
export type FollowUpChannel =
  /** ChatGPT's `window.openai.sendFollowUpMessage`. */
  | 'openai'
  /** The standard `ui/message` request to the host. */
  | 'mcp-message';

/** What the View knows about its surroundings when it picks a route. */
export interface FollowUpEnvironment {
  /** Whether the handshake with the host has finished. */
  readonly connected: boolean;
  /** Whether ChatGPT's `window.openai` bridge can send a follow-up. */
  readonly openAiFollowUp: boolean;
}

/**
 * The routes to try, best first. Inside ChatGPT its own bridge goes first, since
 * it is what has always worked there. `ui/message` is tried whenever there is a
 * connection even though hosts do not all advertise a `message` capability (the
 * stable spec does not define one), and a host that refuses it simply falls
 * through to the next route.
 */
export function followUpChannels(
  environment: FollowUpEnvironment,
): readonly FollowUpChannel[] {
  return [
    ...(environment.openAiFollowUp ? (['openai'] as const) : []),
    ...(environment.connected ? (['mcp-message'] as const) : []),
  ];
}

/**
 * Try each route in turn with `attempt` until one reports success.
 *
 * @param channels - Routes to try, best first.
 * @param attempt - Runs one route; resolves true when it worked, and may throw.
 * @returns The route that worked, or undefined when none did.
 */
export async function firstThatWorks(
  channels: readonly FollowUpChannel[],
  attempt: (channel: FollowUpChannel) => Promise<boolean>,
): Promise<FollowUpChannel | undefined> {
  const [channel, ...rest] = channels;
  if (channel === undefined) {
    return undefined;
  }
  const worked = await attempt(channel).catch(() => false);
  return worked ? channel : firstThatWorks(rest, attempt);
}

/** The sentence a tile sends to ask the assistant to open a recipe. */
export function openRecipePrompt(title: string): string {
  return `Open the "${title}" recipe`;
}

/**
 * The address to hand to the host's `ui/open-link`, or undefined when the text
 * is not a plain http(s) link. Recipe sources come from user data, so anything
 * else (`javascript:`, `data:`, relative paths) is refused.
 */
export function safeHttpUrl(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
      ? parsed.href
      : undefined;
  } catch {
    return undefined;
  }
}
