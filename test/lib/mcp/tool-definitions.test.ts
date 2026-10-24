import { describe, expect, it } from '@jest/globals';
import Ajv2020 from 'ajv/dist/2020.js';

import { validateJson, unsupportedKeywords } from '@/lib/mcp/json-schema';
import { MAX_BODY_BYTES } from '@/domain/mcp/request-limits';
import {
  CONTENT_MAX,
  PAGE_DEFAULT,
  TOOLS,
  toolNamed,
} from '@/domain/mcp/tool-definitions';
import { APP_RESOURCES } from '@/domain/mcp/ui-resources';
import { SCOPE_READ, scopeForTool } from '@/lib/oauth/scopes';
import { PANCAKES, call, fakeServices, folder } from './tool-fakes';

/** A JSON Schema 2020-12 validator that rejects schemas with unknown keywords. */
function newAjv(): Ajv2020 {
  return new Ajv2020({ strict: true, allowUnionTypes: true });
}

/** Arguments that every tool accepts, one set per tool. */
const GOOD_ARGUMENTS: Readonly<Record<string, Record<string, unknown>>> = {
  list_recipes: { limit: 20, offset: 0 },
  browse_recipes: {
    cuisine: 'French',
    limit: 5,
    offset: 5,
    max_minutes: 30,
    difficulty: 'easy',
    dietary_needs: 'Gluten-free',
  },
  recipes_from_ingredients: {
    ingredients: ['200 g flour', '2 eggs'],
    offset: 10,
  },
  list_filters: {},
  search_recipes: { query: 'pan', limit: 10, offset: 10 },
  find_recipes: { query: 'something quick' },
  find_similar: { recipe: 'pancakes' },
  get_recipe: { recipe: 'pancakes' },
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
    const withViews = TOOLS.filter((tool) => 'ui' in tool._meta);
    expect(withViews.length).toBeGreaterThan(8);
    for (const tool of withViews) {
      const meta: Readonly<Record<string, unknown>> = tool._meta;
      const uri = (meta['ui'] as { resourceUri: string }).resourceUri;
      expect(uris).toContain(uri);
      expect(meta['openai/outputTemplate']).toBe(uri);
      expect(meta['ui/resourceUri']).toBe(uri);
      for (const words of [
        meta['openai/toolInvocation/invoking'],
        meta['openai/toolInvocation/invoked'],
      ]) {
        expect(String(words).length).toBeGreaterThan(3);
        expect(String(words).length).toBeLessThanOrEqual(64);
      }
      expect(tool).toHaveProperty('outputSchema');
    }
  });
});

describe('how the tools name what they take', () => {
  /** The tools that act on a recipe that is already saved. */
  const EXISTING = [
    'find_similar',
    'get_recipe',
    'log_cooking',
    'favourite_recipe',
    'tag_recipe',
    'set_recipe_images',
    'annotate_recipe',
  ] as const;

  /** The properties of a tool's input schema. */
  const propertiesOf = (name: string): Record<string, unknown> => {
    const schema = toolNamed(name)?.inputSchema;
    return schema && 'properties' in schema ? schema.properties : {};
  };

  it.each(EXISTING)(
    '%s takes the saved recipe as `recipe`, and requires it',
    (name) => {
      const schema = toolNamed(name)?.inputSchema;
      expect(Object.keys(propertiesOf(name))).toContain('recipe');
      expect(schema && 'required' in schema ? schema.required : []).toContain(
        'recipe',
      );
    },
  );

  it('keeps `name` for the tools that make a new recipe, and nowhere else', () => {
    const withName = TOOLS.filter((t) =>
      Object.keys(propertiesOf(t.name)).includes('name'),
    ).map((t) => t.name);
    expect(withName.toSorted()).toEqual(
      ['add_recipe', 'capture_idea', 'import_recipe'].toSorted(),
    );
  });

  it('asks for dietary needs as `dietary_needs`, not as a near twin of `diet_type`', () => {
    const browse = Object.keys(propertiesOf('browse_recipes'));
    expect(browse).toContain('dietary_needs');
    expect(browse).not.toContain('diet');
  });

  it('lists only the canonical names: the older spellings are accepted but not advertised', () => {
    for (const [tool, old] of [
      ['get_recipe', 'name'],
      ['find_similar', 'name'],
      ['browse_recipes', 'diet'],
    ] as const) {
      expect(Object.keys(propertiesOf(tool))).not.toContain(old);
    }
  });
});

describe('long results', () => {
  it('lets every tool that can return more than a page ask for the next one', () => {
    for (const name of [
      'list_recipes',
      'search_recipes',
      'browse_recipes',
      'recipes_from_ingredients',
    ]) {
      const schema = toolNamed(name)?.inputSchema;
      const properties =
        schema && 'properties' in schema ? schema.properties : {};
      expect(Object.keys(properties)).toContain('offset');
    }
  });

  it('says in the description how many a listing returns at a time', () => {
    expect(toolNamed('list_recipes')?.description).toContain(
      `${PAGE_DEFAULT} at a time`,
    );
  });
});

describe('what the tools accept as text', () => {
  /** Every required text property of every tool, with the good arguments around it. */
  const REQUIRED_TEXT = TOOLS.flatMap((tool) => {
    const schema = tool.inputSchema;
    const properties: Record<string, Record<string, unknown>> = 'properties' in
    schema
      ? schema.properties
      : {};
    const required: readonly string[] =
      'required' in schema ? schema.required : [];
    return required
      .filter((key) => properties[key]?.['type'] === 'string')
      .map((key) => [tool.name, key] as const);
  });

  it('has required text to try', () => {
    expect(REQUIRED_TEXT.length).toBeGreaterThan(8);
  });

  it.each(REQUIRED_TEXT)(
    '%s refuses a blank `%s`, so nothing empty is ever written to a recipe',
    (name, key) => {
      const tool = toolNamed(name);
      const good = GOOD_ARGUMENTS[name] ?? {};
      const problems = validateJson(
        tool?.inputSchema ?? {},
        { ...good, [key]: '   ' },
        'The arguments',
      );
      expect(problems).not.toEqual([]);
    },
  );

  it('refuses a blank note, and a blank request for an idea, by name', () => {
    for (const [name, key] of [
      ['log_cooking', 'note'],
      ['annotate_recipe', 'note'],
      ['capture_idea', 'prompt'],
    ] as const) {
      expect(REQUIRED_TEXT).toContainEqual([name, key]);
    }
  });

  it('keeps the largest block of text a tool takes within what one request can carry, even if every character needs six bytes of JSON', () => {
    expect(CONTENT_MAX * 6).toBeLessThan(MAX_BODY_BYTES);
    for (const tool of TOOLS) {
      const properties: Record<
        string,
        Record<string, unknown>
      > = 'properties' in tool.inputSchema ? tool.inputSchema.properties : {};
      for (const [key, schema] of Object.entries(properties)) {
        const longest = Number(schema['maxLength'] ?? 0);
        expect({ tool: tool.name, key, fits: longest <= CONTENT_MAX }).toEqual({
          tool: tool.name,
          key,
          fits: true,
        });
      }
    }
  });
});

describe('what the model has to read', () => {
  /**
   * The most characters the tools' names, descriptions and input schemas may add
   * up to (about four thousand tokens). A host puts all of them in the model's
   * context on every turn, so a new tool or a longer description has to earn its
   * place against this number.
   */
  const BUDGET = 16_000;

  it('stays within a budget for names, descriptions and input schemas', () => {
    const size = JSON.stringify(
      TOOLS.map(({ name, title, description, inputSchema }) => ({
        name,
        title,
        description,
        inputSchema,
      })),
    ).length;
    expect(size).toBeLessThan(BUDGET);
  });

  it('leads the two search tools with what tells them apart', () => {
    expect(toolNamed('search_recipes')?.description).toMatch(/^By name only:/);
    expect(toolNamed('find_recipes')?.description).toMatch(
      /^By meaning, not name:/,
    );
  });
});

describe('the _meta of a tool', () => {
  const LABEL = '[A-Za-z](?:[A-Za-z0-9-]*[A-Za-z0-9])?';
  const NAME = '[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?';
  const GRAMMAR = new RegExp(`^(?:${LABEL}(?:\\.${LABEL})*/)?${NAME}$`);

  /** The keys ChatGPT documents, which have a second `/` and so break the spec's grammar. */
  const OPENAI_STATUS_KEYS = [
    'openai/toolInvocation/invoking',
    'openai/toolInvocation/invoked',
  ];

  it('uses keys the MCP spec allows, apart from the two ChatGPT status keys', () => {
    const keys = [...new Set(TOOLS.flatMap((t) => Object.keys(t._meta)))];
    expect(keys.length).toBeGreaterThan(4);
    const offenders = keys.filter(
      (key) => !GRAMMAR.test(key) && !OPENAI_STATUS_KEYS.includes(key),
    );
    expect(offenders).toEqual([]);
    // The exception is exactly these two: if the grammar ever accepts them,
    // the allowance should go.
    for (const key of OPENAI_STATUS_KEYS) {
      expect(GRAMMAR.test(key)).toBe(false);
      expect(keys).toContain(key);
    }
  });

  it('lets a View call back only the two read tools it reads from', () => {
    expect(
      TOOLS.filter((t) => 'openai/widgetAccessible' in t._meta).map(
        (t) => t.name,
      ),
    ).toEqual(['list_recipes', 'get_recipe']);
    for (const tool of TOOLS.filter(
      (t) => 'openai/widgetAccessible' in t._meta,
    )) {
      expect(tool.annotations.readOnlyHint).toBe(true);
    }
  });
});

describe('what each tool says about signing in', () => {
  it.each(TOOLS.map((t) => [t.name, t] as const))(
    '%s asks for the scope the server will check for it',
    (name, tool) => {
      const expected = [{ type: 'oauth2', scopes: [scopeForTool(name)] }];
      expect(tool.securitySchemes).toEqual(expected);
      expect(tool._meta.securitySchemes).toEqual(expected);
    },
  );
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
      ['get_recipe', { recipe: 'pizza' }],
      ['find_similar', { recipe: 'pizza' }],
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
