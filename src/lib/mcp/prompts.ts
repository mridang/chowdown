/**
 * @packageDocumentation
 *
 * The prompts the MCP server offers. Hosts show them as slash commands (or a
 * menu of starting points), so a person can begin with "What should I cook?"
 * instead of working out which tools to ask for. A prompt is only a message:
 * it tells the assistant what the person wants and which tools to reach for,
 * and the assistant does the rest with the same tools it always has.
 *
 * Prompt arguments are always strings (the protocol has no other type), so an
 * optional one that is left out, blank or sent as `null` (what some clients put
 * for a field the person skipped) is simply not mentioned.
 */

import { ERROR_INVALID_PARAMS, RpcError } from './protocol';

/** One argument a prompt accepts. */
export interface PromptArgument {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly required: boolean;
}

/** A prompt as `prompts/list` describes it. */
export interface PromptDefinition {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly arguments: readonly PromptArgument[];
}

/** A prompt as `prompts/get` returns it: the message that starts the conversation. */
export interface PromptResult {
  readonly description: string;
  readonly messages: readonly {
    readonly role: 'user';
    readonly content: { readonly type: 'text'; readonly text: string };
  }[];
}

/** What a prompt needs: its definition, and how it turns arguments into the opening message. */
interface Prompt {
  readonly definition: PromptDefinition;
  readonly text: (args: Readonly<Record<string, string>>) => string;
}

/** The text of an argument, or nothing when it was left out or is blank. */
function given(
  args: Readonly<Record<string, string>>,
  name: string,
): string | undefined {
  const value = args[name]?.trim();
  return value ? value : undefined;
}

/** How many dinners a plan covers when the person does not say. */
const DEFAULT_PLAN_DAYS = 5;

/** The most dinners a plan covers; more would not fit a message the assistant can act on. */
const MAX_PLAN_DAYS = 14;

/**
 * How many dinners to plan: the number the person typed if it is a whole number
 * from 1 to {@link MAX_PLAN_DAYS}, otherwise {@link DEFAULT_PLAN_DAYS}. The
 * text is the person's own, but it is dropped into a sentence, so only a plain
 * number goes in.
 */
function planDays(text: string | undefined): number {
  const days = text !== undefined && /^\d{1,3}$/.test(text) ? Number(text) : 0;
  return days >= 1 && days <= MAX_PLAN_DAYS ? days : DEFAULT_PLAN_DAYS;
}

/** Every prompt the server offers, in the order a host should list them. */
const PROMPTS: readonly Prompt[] = [
  {
    definition: {
      name: 'what-should-i-cook',
      title: 'What should I cook?',
      description:
        'Suggest something from my recipes that suits what I feel like eating.',
      arguments: [
        {
          name: 'mood',
          title: 'What you feel like',
          description:
            'For example "something quick and vegetarian" or "comfort food".',
          required: false,
        },
      ],
    },
    text: (args) => {
      const mood = given(args, 'mood');
      return [
        mood
          ? `I'd like to cook something from my chowdown recipes. What I feel like: ${mood}.`
          : "I'd like to cook something from my chowdown recipes, and I haven't decided what.",
        'Look through my collection (list_filters shows what it holds, browse_recipes narrows it down), then suggest two or three recipes and say why each fits.',
        'Show the one I pick with get_recipe.',
      ].join(' ');
    },
  },
  {
    definition: {
      name: 'use-up-ingredients',
      title: 'Use up my ingredients',
      description:
        'Find recipes I can make with what I already have, and say what each one lacks.',
      arguments: [
        {
          name: 'ingredients',
          title: 'What you have',
          description:
            'For example "3 tomatoes, 400 g of pasta and half a lemon".',
          required: true,
        },
      ],
    },
    text: (args) =>
      [
        `I have these ingredients: ${given(args, 'ingredients') ?? 'nothing yet'}.`,
        'Use recipes_from_ingredients to find what I can cook from my recipes, put the closest matches first, and tell me what each near miss still needs.',
      ].join(' '),
  },
  {
    definition: {
      name: 'plan-the-week',
      title: 'Plan my week',
      description:
        'Pick a varied set of dinners from my recipes for the coming days.',
      arguments: [
        {
          name: 'days',
          title: 'How many dinners',
          description: `A number of days from 1 to ${MAX_PLAN_DAYS}, such as 5. Defaults to ${DEFAULT_PLAN_DAYS}.`,
          required: false,
        },
        {
          name: 'preferences',
          title: 'Preferences',
          description:
            'For example "vegetarian, under 40 minutes, no mushrooms".',
          required: false,
        },
      ],
    },
    text: (args) => {
      const days = planDays(given(args, 'days'));
      const preferences = given(args, 'preferences');
      return [
        `Plan ${days} dinners for me from my chowdown recipes.`,
        preferences ? `What I want: ${preferences}.` : '',
        'Vary the cuisines and main ingredients, use browse_recipes to find candidates, and list the plan day by day with a line on why each recipe was chosen.',
        'Offer to put together the shopping list from the ingredients.',
      ]
        .filter((sentence) => sentence !== '')
        .join(' ');
    },
  },
];

/** What `prompts/list` returns: every prompt's definition. */
export const PROMPT_DEFINITIONS: readonly PromptDefinition[] = PROMPTS.map(
  (prompt) => prompt.definition,
);

/**
 * Build a prompt's opening message.
 *
 * @param name - Which prompt.
 * @param rawArguments - The arguments the caller gave, if any.
 * @throws {RpcError} `-32602` if the prompt does not exist, if the arguments
 *   are not an object of strings, or if a required one is missing or blank.
 */
export function getPrompt(name: unknown, rawArguments: unknown): PromptResult {
  const prompt = PROMPTS.find((p) => p.definition.name === name);
  if (!prompt) {
    throw new RpcError(
      ERROR_INVALID_PARAMS,
      `Unknown prompt: ${typeof name === 'string' ? name.slice(0, 120) : 'no name given'}. The prompts are ${PROMPT_DEFINITIONS.map((p) => p.name).join(', ')}.`,
    );
  }
  const args = stringArguments(rawArguments);
  const missing = prompt.definition.arguments.filter(
    (argument) => argument.required && given(args, argument.name) === undefined,
  );
  if (missing.length > 0) {
    throw new RpcError(
      ERROR_INVALID_PARAMS,
      `Prompt ${prompt.definition.name} needs ${missing.map((m) => `\`${m.name}\``).join(' and ')}.`,
      { prompt: prompt.definition.name, missing: missing.map((m) => m.name) },
    );
  }
  return {
    description: prompt.definition.description,
    messages: [
      { role: 'user', content: { type: 'text', text: prompt.text(args) } },
    ],
  };
}

/**
 * The arguments as a record of strings, or a refusal if they are anything else.
 * A `null` value counts as left out.
 */
function stringArguments(raw: unknown): Readonly<Record<string, string>> {
  if (raw === undefined || raw === null) {
    return {};
  }
  const entries =
    typeof raw === 'object' && !Array.isArray(raw)
      ? Object.entries(raw).filter(([, value]) => value !== null)
      : undefined;
  if (!entries || entries.some(([, value]) => typeof value !== 'string')) {
    throw new RpcError(
      ERROR_INVALID_PARAMS,
      'Prompt `arguments` must be an object whose values are strings.',
    );
  }
  return Object.fromEntries(entries);
}
