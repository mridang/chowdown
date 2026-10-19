import { describe, expect, it } from '@jest/globals';
import Ajv2020 from 'ajv/dist/2020.js';

import {
  validateJson,
  unsupportedKeywords,
} from '../../../src/lib/mcp/json-schema';
import { TOOLS, toolNamed } from '../../../src/lib/mcp/tool-definitions';
import { APP_RESOURCES } from '../../../src/lib/mcp/ui-resources';
import { SCOPE_READ, scopeForTool } from '../../../src/lib/oauth/scopes';
import { PANCAKES, call, fakeServices, folder } from './tool-fakes';

/** A JSON Schema 2020-12 validator that rejects schemas with unknown keywords. */
function newAjv(): Ajv2020 {
  return new Ajv2020({ strict: true, allowUnionTypes: true });
}

/** Arguments that every tool accepts, one set per tool. */
const GOOD_ARGUMENTS: Readonly<Record<string, Record<string, unknown>>> = {
  list_recipes: {},
  browse_recipes: { cuisine: 'French', limit: 5, max_minutes: 30 },
  recipes_from_ingredients: { ingredients: ['200 g flour', '2 eggs'] },
  list_filters: {},
  search_recipes: { query: 'pan' },
  find_recipes: { query: 'something quick' },
  find_similar: { name: 'pancakes' },
  get_recipe: { name: 'pancakes' },
  import_recipe: {
    content: 'A page about bread',
    url: 'https://example.com/bread',
    name: 'Bread',
    images: ['https://example.com/a.jpg'],
  },
  add_recipe: { name: 'Green curry', content: 'Simmer @milk{1%l}.' },
  capture_idea: { name: 'paneer ki sabji', prompt: 'make it', draft: 'x' },
  log_cooking: { recipe: 'pancakes', note: 'Added vanilla' },
  set_measurement_system: { system: 'us' },
  favourite_recipe: { recipe: 'pancakes' },
  tag_recipe: { recipe: 'pancakes' },
  set_recipe_images: {
    recipe: 'pancakes',
    images: ['https://example.com/a.jpg'],
  },
  annotate_recipe: { recipe: 'pancakes', note: 'rest it', step: 1 },
};

/** A fresh Drive folder with two recipes. */
const kitchen = () =>
  folder({
    'Pancakes.cook': PANCAKES,
    'Soup.cook': '>> cuisine: French\n\nBoil @water{1%l}.\n',
  });

describe('the tool catalogue', () => {
  it('has a unique, valid name for every tool', () => {
    const names = TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) {
      expect(name).toMatch(/^[A-Za-z0-9_.-]{1,128}$/);
    }
  });

  it('has a set of good arguments for every tool, and for no other', () => {
    expect(Object.keys(GOOD_ARGUMENTS).toSorted()).toEqual(
      TOOLS.map((t) => t.name).toSorted(),
    );
  });

  it('finds a tool by name', () => {
    expect(toolNamed('get_recipe')?.name).toBe('get_recipe');
    expect(toolNamed('make_coffee')).toBeUndefined();
    expect(toolNamed('constructor')).toBeUndefined();
  });

  it('describes what each tool does without telling the model how to behave', () => {
    for (const tool of TOOLS) {
      expect(tool.description.length).toBeGreaterThan(20);
      expect(tool.description).not.toMatch(
        /YOURSELF|do NOT|Call this when|Use this when|Use it|prefer /,
      );
    }
  });

  it('gives each UI tool a View that exists and a matching output schema', () => {
    const uris = APP_RESOURCES.map((r) => r.uri) as readonly string[];
    for (const tool of TOOLS) {
      if ('_meta' in tool) {
        expect(uris).toContain(tool._meta.ui.resourceUri);
        expect(tool._meta['openai/outputTemplate']).toBe(
          tool._meta.ui.resourceUri,
        );
        expect(tool._meta['ui/resourceUri']).toBe(tool._meta.ui.resourceUri);
        for (const words of [
          tool._meta['openai/toolInvocation/invoking'],
          tool._meta['openai/toolInvocation/invoked'],
        ]) {
          expect(words.length).toBeGreaterThan(3);
          expect(words.length).toBeLessThanOrEqual(64);
        }
        expect(tool).toHaveProperty('outputSchema');
      }
    }
  });
});

describe('titles and annotations', () => {
  it('gives every tool a title and all four hints as booleans', () => {
    for (const tool of TOOLS) {
      expect(tool.title.length).toBeGreaterThan(3);
      expect(tool.annotations.title).toBe(tool.title);
      for (const hint of [
        'readOnlyHint',
        'destructiveHint',
        'idempotentHint',
        'openWorldHint',
      ] as const) {
        expect(typeof tool.annotations[hint]).toBe('boolean');
      }
    }
  });

  it('marks a tool read-only exactly when its token scope is read-only', () => {
    for (const tool of TOOLS) {
      expect({
        tool: tool.name,
        readOnly: tool.annotations.readOnlyHint,
      }).toEqual({
        tool: tool.name,
        readOnly: scopeForTool(tool.name) === SCOPE_READ,
      });
    }
  });

  it('never calls a read-only tool destructive, or a tool that writes idempotent by accident', () => {
    for (const tool of TOOLS.filter((t) => t.annotations.readOnlyHint)) {
      expect(tool.annotations).toMatchObject({
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      });
    }
  });

  it('flags exactly the tools that overwrite a recipe as destructive', () => {
    expect(
      TOOLS.filter((t) => t.annotations.destructiveHint).map((t) => t.name),
    ).toEqual(['tag_recipe', 'set_recipe_images']);
  });

  it('flags exactly the tools that fetch web addresses as open-world', () => {
    expect(
      TOOLS.filter((t) => t.annotations.openWorldHint).map((t) => t.name),
    ).toEqual(['import_recipe', 'tag_recipe']);
  });

  it('flags as idempotent only the tools that repeat harmlessly', () => {
    expect(
      TOOLS.filter(
        (t) => !t.annotations.readOnlyHint && t.annotations.idempotentHint,
      ).map((t) => t.name),
    ).toEqual([
      'set_measurement_system',
      'favourite_recipe',
      'set_recipe_images',
    ]);
  });
});

describe('the input schemas', () => {
  it.each(TOOLS.map((t) => [t.name, t] as const))(
    '%s is a valid, closed JSON Schema 2020-12 object',
    (_name, tool) => {
      expect(newAjv().validateSchema(tool.inputSchema)).toBe(true);
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.inputSchema.additionalProperties).toBe(false);
      const properties = Object.keys(
        'properties' in tool.inputSchema ? tool.inputSchema.properties : {},
      );
      const required =
        'required' in tool.inputSchema ? tool.inputSchema.required : [];
      for (const key of required) {
        expect(properties).toContain(key);
      }
    },
  );

  it('uses only keywords the server checks, so none is silently ignored', () => {
    for (const tool of TOOLS) {
      expect({
        tool: tool.name,
        unchecked: unsupportedKeywords(tool.inputSchema),
      }).toEqual({
        tool: tool.name,
        unchecked: [],
      });
    }
  });

  it('bounds every string, list and number an assistant can send', () => {
    for (const tool of TOOLS) {
      const properties: Record<
        string,
        Record<string, unknown>
      > = 'properties' in tool.inputSchema ? tool.inputSchema.properties : {};
      for (const [key, schema] of Object.entries(properties)) {
        const bounded =
          schema['type'] === 'boolean' ||
          schema['enum'] !== undefined ||
          (schema['type'] === 'string' && schema['maxLength'] !== undefined) ||
          (schema['type'] === 'array' && schema['maxItems'] !== undefined) ||
          (['integer', 'number'].includes(String(schema['type'])) &&
            schema['minimum'] !== undefined);
        expect({ tool: tool.name, key, bounded }).toEqual({
          tool: tool.name,
          key,
          bounded: true,
        });
      }
    }
  });
});

describe('the output schemas', () => {
  it('are valid JSON Schema 2020-12', () => {
    for (const tool of TOOLS) {
      if ('outputSchema' in tool) {
        expect(newAjv().validateSchema(tool.outputSchema)).toBe(true);
      }
    }
  });
});

describe('the input checker agrees with ajv', () => {
  /** Values of every JSON type and size, tried in place of each property. */
  const long = 'x'.repeat(1_200_000);
  const ODD_VALUES: readonly unknown[] = [
    null,
    true,
    false,
    0,
    1,
    -1,
    2.5,
    51,
    1001,
    '',
    '   ',
    'x',
    'Easy',
    'easy',
    'metric',
    'https://example.com/a.jpg',
    'ftp://example.com/a.jpg',
    long,
    [],
    ['x'],
    [1],
    Array.from({ length: 101 }, () => 'x'),
    {},
    { name: 'x' },
  ];

  it.each(TOOLS.map((t) => [t.name, t] as const))(
    '%s: on its good arguments and every single-edit variation of them',
    (_name, tool) => {
      const ajvValid = newAjv().compile(tool.inputSchema);
      const good = GOOD_ARGUMENTS[tool.name] ?? {};
      const properties =
        'properties' in tool.inputSchema
          ? Object.keys(tool.inputSchema.properties)
          : [];
      const variants: readonly unknown[] = [
        good,
        undefined,
        null,
        [],
        'text',
        5,
        { ...good, extra: 1 },
        ...Object.keys(good).map((key) =>
          Object.fromEntries(Object.entries(good).filter(([k]) => k !== key)),
        ),
        ...properties.flatMap((key) =>
          ODD_VALUES.map((value) => ({ ...good, [key]: value })),
        ),
      ];
      expect(variants.length).toBeGreaterThan(6);
      for (const variant of variants) {
        const ours = validateJson(tool.inputSchema, variant).length === 0;
        expect({
          tool: tool.name,
          variant: JSON.stringify(variant)?.slice(0, 120),
          valid: ours,
        }).toEqual({
          tool: tool.name,
          variant: JSON.stringify(variant)?.slice(0, 120),
          valid: ajvValid(variant),
        });
      }
      expect(ajvValid(good)).toBe(true);
    },
  );
});

describe('every result conforms to the tool that returned it', () => {
  const OUTPUT_TOOLS = TOOLS.filter((t) => 'outputSchema' in t);

  it('has an output schema for the tools that draw a card or a list', () => {
    expect(OUTPUT_TOOLS.map((t) => t.name).toSorted()).toEqual([
      'add_recipe',
      'annotate_recipe',
      'browse_recipes',
      'capture_idea',
      'find_recipes',
      'find_similar',
      'get_recipe',
      'import_recipe',
      'list_recipes',
      'log_cooking',
      'recipes_from_ingredients',
      'search_recipes',
      'set_recipe_images',
      'tag_recipe',
    ]);
  });

  it.each(TOOLS.map((t) => [t.name, t] as const))(
    '%s: a good call gives a result its schema accepts, with readable text',
    async (_name, tool) => {
      const result = await call(
        tool.name,
        GOOD_ARGUMENTS[tool.name] ?? {},
        kitchen(),
        fakeServices(),
      );
      expect(result.isError).toBeUndefined();
      expect(result.content[0]?.text.length).toBeGreaterThan(10);
      if ('outputSchema' in tool) {
        const accepts = newAjv().compile(tool.outputSchema);
        expect({
          tool: tool.name,
          errors: accepts(result.structuredContent) ? [] : accepts.errors,
        }).toEqual({ tool: tool.name, errors: [] });
      } else {
        expect(result.structuredContent).toBeUndefined();
      }
    },
  );

  /** Calls that fail for a reason the assistant can fix, per tool with an output schema. */
  const FAILING_CALLS: readonly (readonly [string, Record<string, unknown>])[] =
    [
      ['get_recipe', { name: 'pizza' }],
      ['find_similar', { name: 'pizza' }],
      ['log_cooking', { recipe: 'pizza', note: 'x' }],
      ['tag_recipe', { recipe: 'pizza' }],
      [
        'set_recipe_images',
        { recipe: 'pizza', images: ['https://example.com/a.jpg'] },
      ],
      ['set_recipe_images', { recipe: 'pancakes', images: ['nope'] }],
      ['annotate_recipe', { recipe: 'pizza', note: 'x' }],
      ['annotate_recipe', { recipe: 'pancakes', note: '   ' }],
      ['favourite_recipe', { recipe: 'pizza' }],
      ['browse_recipes', { cuisine: 'Martian' }],
      ['recipes_from_ingredients', { ingredients: ['  '] }],
    ];

  it.each(FAILING_CALLS)(
    '%s with %j is an error with an explanation and nothing structured',
    async (name, args) => {
      const result = await call(name, args, kitchen(), fakeServices());
      expect(result.isError).toBe(true);
      expect(result.structuredContent).toBeUndefined();
      expect(result.content[0]?.text.length).toBeGreaterThan(10);
    },
  );

  it('answers a search with nothing found as an empty list that the schema accepts', async () => {
    const tool = toolNamed('search_recipes');
    const accepts = newAjv().compile(
      tool && 'outputSchema' in tool ? tool.outputSchema : {},
    );
    const result = await call('search_recipes', { query: 'zzz' }, kitchen());
    expect(result.isError).toBeUndefined();
    expect(accepts(result.structuredContent)).toBe(true);
    expect(result.structuredContent).toEqual({ recipes: [], query: 'zzz' });
  });
});
