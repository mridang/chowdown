import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import Ajv2020 from 'ajv/dist/2020.js';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { createRecipeImport } from '@/domain/db/recipe-imports';
import { getDatabase } from '@/domain/db/client';
import { SCOPE_READ } from '@/domain/mcp/app';
import type { ImportUnit } from '@/domain/recipe/import-blob';
import type { ImportItem } from '@/domain/recipe/prepare-import';
import { appendNote } from '@/lib/cooklang';
import { fakeCookies } from './domain/auth/session-fixture';
import {
  addRecipe,
  fakeGoogle,
  fromApp,
  openWorld,
  signIn,
  type World,
} from './app/api/world';

jest.unstable_mockModule('next/headers', () => ({ cookies: fakeCookies }));
// Importing fetches web pages and calls a model; the contract is about the API.
jest.unstable_mockModule('@/domain/recipe/prepare-import', () => ({
  prepareImport: async (
    units: readonly ImportUnit[],
  ): Promise<readonly ImportItem[]> =>
    units.map((unit): ImportItem => ({
      title: unit.kind === 'url' ? unit.url : 'Pasted recipe',
      status: 'DRAFT',
      cooklang: '>> title: T\n',
    })),
}));

type Json = Readonly<Record<string, unknown>>;

/** A schema, a parameter, a response or a request body, or a `$ref` to one. */
interface Described extends Json {
  readonly $ref?: string;
  readonly name?: string;
  readonly in?: string;
  readonly schema?: Described;
  readonly content?: Readonly<Record<string, { readonly schema?: Described }>>;
  readonly headers?: Readonly<Record<string, unknown>>;
  readonly required?: readonly string[];
  readonly properties?: Readonly<Record<string, unknown>>;
  readonly additionalProperties?: boolean;
}

interface Operation {
  readonly operationId: string;
  readonly tags: readonly string[];
  readonly summary: string;
  readonly security?: readonly Json[];
  readonly parameters?: readonly Described[];
  readonly requestBody?: Described;
  readonly responses: Readonly<Record<string, Described>>;
}

interface Spec {
  readonly openapi: string;
  readonly info: { readonly description: string };
  readonly paths: Readonly<Record<string, Readonly<Record<string, Operation>>>>;
  readonly components: Json;
}

const ROOT = process.cwd();
const spec = JSON.parse(
  readFileSync(path.join(ROOT, 'openapi.json'), 'utf8'),
) as Spec;

const METHODS = ['get', 'put', 'post', 'patch', 'delete'] as const;

/** Every operation in the document, as `METHOD /path`. */
const operations: readonly (readonly [string, Operation])[] = Object.entries(
  spec.paths,
).flatMap(([url, item]) =>
  METHODS.flatMap((method): readonly (readonly [string, Operation])[] => {
    const operation = item[method];
    return operation ? [[`${method.toUpperCase()} ${url}`, operation]] : [];
  }),
);

/** What a `$ref` such as `#/components/responses/NotFound` points at; anything else as it is. */
function deref(node: Described): Described {
  if (!node.$ref) {
    return node;
  }
  const found = node.$ref
    .replace(/^#\//, '')
    .split('/')
    .reduce<unknown>((at, key) => (at as Json | undefined)?.[key], spec);
  if (!found) {
    throw new Error(`Unresolved reference ${node.$ref}`);
  }
  return found as Described;
}

/** The `$ref`s anywhere inside a node. */
function refsIn(node: unknown): readonly string[] {
  if (Array.isArray(node)) {
    return node.flatMap(refsIn);
  }
  if (node && typeof node === 'object') {
    return Object.entries(node).flatMap(([key, value]) =>
      key === '$ref' && typeof value === 'string' ? [value] : refsIn(value),
    );
  }
  return [];
}

// ---------------------------------------------------------------- the routes

const API_DIR = path.join(ROOT, 'src', 'app', 'api');

/** Every `route.ts` below `dir`. */
function routeFiles(dir: string): readonly string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? routeFiles(path.join(dir, entry.name))
      : entry.name === 'route.ts'
        ? [path.join(dir, entry.name)]
        : [],
  );
}

/** Every `METHOD /path` the route files export, with `[x]` written `{x}`. */
function registered(): readonly string[] {
  return routeFiles(API_DIR).flatMap((file) => {
    const url = `/api${path
      .relative(API_DIR, path.dirname(file))
      .split(path.sep)
      .filter(Boolean)
      .map((segment) => `/${segment}`)
      .join('')
      .replace(/\[([a-z_]+)\]/g, '{$1}')}`;
    const text = readFileSync(file, 'utf8');
    return METHODS.map((method) => method.toUpperCase())
      .filter((method) =>
        new RegExp(
          `export (async function ${method}\\b|const \\{[^}]*\\b${method}\\b[^}]*\\} =)`,
        ).test(text),
      )
      .map((method) => `${method} ${url}`);
  });
}

// ------------------------------------------------------------ the validation

const ajv = new Ajv2020({ strict: false, allowUnionTypes: true });
ajv.addFormat('uri', (value) => URL.canParse(value));
ajv.addFormat('date-time', (value) => !Number.isNaN(Date.parse(value)));

/** What is wrong with a value against a schema of the document; empty when it fits. */
function misfit(schema: Described, value: unknown): string {
  const validate = ajv.compile({ ...schema, components: spec.components });
  return validate(value)
    ? ''
    : ajv.errorsText(validate.errors, { dataVar: 'body' });
}

/** The media type of a response, without its parameters. */
function mediaType(response: Response): string {
  return (response.headers.get('content-type') ?? '')
    .split(';')[0]!
    .trim()
    .toLowerCase();
}

// --------------------------------------------------------------- the fixture

const SOURCE = '>> title: Curry\n\nCook @onion{1} in a #pan.\n';
const WITH_NOTE = appendNote(SOURCE, {
  scope: 'general',
  key: '',
  text: 'Lovely',
});

let world: World;

beforeEach(() => {
  world = openWorld();
});

afterEach(() => world.close());

/** Sign in with Drive, and give the person a recipe with a note, a favourite, an import and a connected app. */
async function arrange(): Promise<void> {
  const uid = await signIn(world, { drive: true });
  addRecipe(world, uid, 'r1', WITH_NOTE, 'Curry.cook');
  fakeGoogle({ r1: { name: 'Curry.cook', content: WITH_NOTE } });
  world.raw
    .prepare(
      "INSERT INTO favourites (user_id, drive_file_id, created_at) VALUES (?, 'r1', 'n')",
    )
    .run(uid);
  world.raw
    .prepare(
      "INSERT INTO embeddings (user_id, drive_file_id, title, vector, similar) VALUES (?, 'r1', 'Curry', '[]', ?)",
    )
    .run(uid, JSON.stringify([{ id: 'x', title: 'Ex' }]));
  await createRecipeImport(getDatabase(), uid, [
    { title: 'A', status: 'DRAFT', cooklang: '>> title: A\n' },
  ]);
  world.raw
    .prepare(
      'INSERT INTO oauth_clients (client_id, kind, client_name, redirect_uris, created_at) VALUES (?, ?, ?, ?, ?)',
    )
    .run('c1', 'dcr', 'Claude', '[]', '2026-01-01T00:00:00.000Z');
  world.raw
    .prepare(
      `INSERT INTO oauth_grants (id, user_id, client_id, scope, resource, created_at) VALUES ('g1', ?, 'c1', '${SCOPE_READ}', 'r', '2026-01-01T00:00:00.000Z')`,
    )
    .run(uid);
}

/** What a request carries beyond the path of its operation. */
interface Call {
  readonly params?: Readonly<Record<string, string>>;
  readonly query?: string;
  readonly json?: unknown;
  readonly body?: string;
  readonly type?: string;
  readonly headers?: Readonly<Record<string, string>>;
}

/** A call that works for each operation, by operation id, and the status it answers. */
const GOOD: Readonly<Record<string, Call & { readonly status: number }>> = {
  listRecipes: { status: 200 },
  createRecipe: {
    status: 201,
    json: { name: 'Soup', cooklang: '>> title: Soup\n\nBoil @water{1}.\n' },
  },
  getRecipe: { status: 200, params: { id: 'r1' } },
  replaceRecipe: {
    status: 200,
    params: { id: 'r1' },
    json: { cooklang: SOURCE },
  },
  updateRecipe: {
    status: 200,
    params: { id: 'r1' },
    json: { title: 'Better curry' },
    type: 'application/merge-patch+json',
  },
  deleteRecipe: { status: 204, params: { id: 'r1' } },
  listRecipeNotes: { status: 200, params: { id: 'r1' } },
  createRecipeNote: {
    status: 201,
    params: { id: 'r1' },
    json: { text: 'Less salt' },
  },
  getRecipeNote: { status: 200, params: { id: 'r1', note_id: '1' } },
  replaceRecipeNote: {
    status: 200,
    params: { id: 'r1', note_id: '1' },
    json: { text: 'Lovelier' },
  },
  deleteRecipeNote: { status: 204, params: { id: 'r1', note_id: '1' } },
  listSimilarRecipes: { status: 200, params: { id: 'r1' } },
  listRecipeSuggestions: { status: 200, query: 'q=soup' },
  listRecipeImports: { status: 200 },
  createRecipeImport: {
    status: 201,
    json: { input: 'https://example.com/recipe' },
  },
  getRecipeImport: { status: 200, params: { id: 'IMPORT' } },
  deleteRecipeImport: { status: 204, params: { id: 'IMPORT' } },
  getCurrentUser: { status: 200 },
  updateCurrentUser: { status: 200, json: { measurement_system: 'METRIC' } },
  deleteCurrentUser: { status: 204 },
  listFavourites: { status: 200 },
  getFavourite: { status: 200, params: { recipe_id: 'r1' } },
  addFavourite: { status: 204, params: { recipe_id: 'r1' } },
  removeFavourite: { status: 204, params: { recipe_id: 'r1' } },
  listConnections: { status: 200 },
  deleteConnection: { status: 204, params: { grant_id: 'g1' } },
  deleteSessions: { status: 204 },
  deleteCurrentSession: { status: 204 },
};

/** The id of the import `arrange` made (it is generated). */
function importId(): string {
  const row = world.raw.prepare('SELECT id FROM recipe_imports').get() as
    { id: string } | undefined;
  return row?.id ?? 'none';
}

/** A route handler, as Next calls it. */
type Handler = (
  request: Request,
  context: { params: Promise<Record<string, string>> },
) => Promise<Response>;

/** The module of each route, by its path in the document. */
const ROUTES: Readonly<
  Record<string, () => Promise<Readonly<Record<string, Handler>>>>
> = {
  '/api/recipes': () => import('@/app/api/recipes/route'),
  '/api/recipes/{id}': () => import('@/app/api/recipes/[id]/route'),
  '/api/recipes/{id}/notes': () => import('@/app/api/recipes/[id]/notes/route'),
  '/api/recipes/{id}/notes/{note_id}': () =>
    import('@/app/api/recipes/[id]/notes/[note_id]/route'),
  '/api/recipes/{id}/similar': () =>
    import('@/app/api/recipes/[id]/similar/route'),
  '/api/recipes/suggestions': () =>
    import('@/app/api/recipes/suggestions/route'),
  '/api/recipes/imports': () => import('@/app/api/recipes/imports/route'),
  '/api/recipes/imports/{id}': () =>
    import('@/app/api/recipes/imports/[id]/route'),
  '/api/users/self': () => import('@/app/api/users/self/route'),
  '/api/users/self/favourites': () =>
    import('@/app/api/users/self/favourites/route'),
  '/api/users/self/favourites/{recipe_id}': () =>
    import('@/app/api/users/self/favourites/[recipe_id]/route'),
  '/api/users/self/connections': () =>
    import('@/app/api/users/self/connections/route'),
  '/api/users/self/connections/{grant_id}': () =>
    import('@/app/api/users/self/connections/[grant_id]/route'),
  '/api/sessions': () => import('@/app/api/sessions/route'),
  '/api/sessions/self': () => import('@/app/api/sessions/self/route'),
};

/** The concrete path of an operation with its parameters filled in. */
function fill(url: string, params: Readonly<Record<string, string>>): string {
  return url.replace(/\{([a-z_]+)\}/g, (_, name: string) =>
    encodeURIComponent(params[name] ?? 'x'),
  );
}

/** Call the route of an operation the way Next would, and return the answer. */
async function call(
  key: string,
  good: Call,
  override: Call = {},
): Promise<Response> {
  const [method = '', url = ''] = key.split(' ');
  const merged = { ...good, ...override };
  const params = Object.fromEntries(
    Object.entries(merged.params ?? {}).map(([name, value]) => [
      name,
      value === 'IMPORT' ? importId() : value,
    ]),
  );
  const target = `${fill(url, params)}${merged.query === undefined ? '' : `?${merged.query}`}`;
  const load = ROUTES[url];
  if (!load) {
    throw new Error(`${key} has no route module in ROUTES`);
  }
  const routeModule = await load();
  const handler = routeModule[method];
  if (!handler) {
    throw new Error(`${key} is documented but its route does not export it`);
  }
  return handler(
    fromApp(method, target, {
      json: merged.json,
      body: merged.body,
      type: merged.type,
      headers: merged.headers,
    }),
    { params: Promise.resolve(params) },
  );
}

/** The status codes an operation documents. */
function documented(operation: Operation): readonly number[] {
  return Object.keys(operation.responses).map(Number);
}

/** What every refusal must be: a documented status, and a problem document of that status. */
async function expectProblem(
  response: Response,
  operation: Operation,
): Promise<void> {
  expect(documented(operation)).toContain(response.status);
  expect(mediaType(response)).toBe('application/problem+json');
  const body: unknown = await response.json();
  expect(misfit({ $ref: '#/components/schemas/Problem' }, body)).toBe('');
  expect((body as { status: number }).status).toBe(response.status);
}

// ------------------------------------------------------------------- tests

describe('openapi.json', () => {
  it('is OpenAPI 3.1 and says what is outside /api', () => {
    expect(spec.openapi).toMatch(/^3\.1\./);
    for (const outside of ['/auth/', '/oauth/', '/mcp', '/health']) {
      expect(spec.info.description).toContain(outside);
    }
  });

  it('describes exactly the methods the routes under src/app/api export', () => {
    const real = registered();
    expect(real.length).toBeGreaterThan(0);
    expect(operations.map(([key]) => key).toSorted()).toEqual(real.toSorted());
  });

  it('has a route module to call for every path it describes', () => {
    expect(Object.keys(ROUTES).toSorted()).toEqual(
      Object.keys(spec.paths).toSorted(),
    );
  });

  it('describes nothing outside /api', () => {
    expect(Object.keys(spec.paths).every((p) => p.startsWith('/api/'))).toBe(
      true,
    );
  });

  it('resolves every $ref', () => {
    for (const reference of refsIn(spec)) {
      expect(() => deref({ $ref: reference })).not.toThrow();
    }
  });

  it('has an operation id for every operation, no two alike, each with a prepared call', () => {
    const ids = operations.map(([, operation]) => operation.operationId);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.toSorted()).toEqual(Object.keys(GOOD).toSorted());
  });

  it('uses lowercase, hyphen-free path segments', () => {
    for (const url of Object.keys(spec.paths)) {
      for (const segment of url.split('/').filter(Boolean)) {
        expect(segment).toMatch(/^([a-z]+|\{[a-z_]+\})$/);
      }
    }
  });
});

describe.each(operations)('%s', (key, operation) => {
  const good = GOOD[operation.operationId] ?? { status: 0 };
  const open = (operation.security ?? []).length === 0;
  const parameters = (operation.parameters ?? []).map(deref);
  const inQuery = parameters.filter((p) => p.in === 'query').map((p) => p.name);
  const inPath = parameters.filter((p) => p.in === 'path').map((p) => p.name);

  it('is tagged and summarised, declares its security, and documents a success and a 429', () => {
    expect(operation.tags.length).toBeGreaterThan(0);
    expect(operation.summary).toBeTruthy();
    expect(Array.isArray(operation.security)).toBe(true);
    expect(documented(operation).some((c) => c >= 200 && c < 300)).toBe(true);
    expect(documented(operation)).toContain(429);
  });

  it('documents every error as a problem document', () => {
    for (const [code, response] of Object.entries(operation.responses)) {
      if (Number(code) >= 400) {
        expect(Object.keys(deref(response).content ?? {})).toEqual([
          'application/problem+json',
        ]);
      }
    }
  });

  it(
    open
      ? 'is public: it answers without a session'
      : 'is secured: it answers 401 without a session',
    async () => {
      const response = await call(key, good);
      if (open) {
        expect(response.status).toBe(good.status);
      } else {
        expect(response.status).toBe(401);
        await expectProblem(response, operation);
      }
    },
  );

  it('answers a good call with a documented success that fits its schema', async () => {
    await arrange();
    const response = await call(key, good);
    expect(response.status).toBe(good.status);
    const described = deref(operation.responses[String(response.status)] ?? {});
    for (const header of Object.keys(described.headers ?? {})) {
      expect(response.headers.get(header)).not.toBeNull();
    }
    const media = Object.keys(described.content ?? {});
    if (media.length === 0) {
      expect(await response.text()).toBe('');
      return;
    }
    expect(media).toContain(mediaType(response));
    const body: unknown =
      mediaType(response) === 'text/x-cooklang'
        ? await response.text()
        : await response.json();
    expect(
      misfit(described.content?.[mediaType(response)]?.schema ?? {}, body),
    ).toBe('');
  });

  if (operation.requestBody) {
    const [type = 'application/json', media] = Object.entries(
      deref(operation.requestBody).content ?? {},
    )[0] ?? ['application/json'];
    const body = deref(media?.schema ?? {});

    it('refuses a body in another media type with 415', async () => {
      await arrange();
      const response = await call(key, good, {
        json: undefined,
        body: 'text',
        type: 'text/plain',
      });
      expect(response.status).toBe(415);
      await expectProblem(response, operation);
    });

    it.each([
      ['that is not JSON', { body: '{' }],
      ['that is not an object', { json: ['x'] }],
      ...((body.required ?? []).length > 0
        ? [['without its required members', { json: {} }] as const]
        : []),
    ])('refuses a body %s with 400', async (_what, override) => {
      await arrange();
      const response = await call(key, good, {
        json: undefined,
        ...override,
        type,
      });
      expect(response.status).toBe(400);
      await expectProblem(response, operation);
    });

    it.each(Object.keys(body.properties ?? {}))(
      'refuses %s of the wrong type with 400',
      async (name) => {
        await arrange();
        const response = await call(key, good, {
          json: { ...(good.json as Json), [name]: { wrong: 'type' } },
          type,
        });
        expect(response.status).toBe(400);
        await expectProblem(response, operation);
      },
    );

    it(
      body.additionalProperties === false
        ? 'refuses a member it does not know with 400, as the schema says'
        : 'ignores a member it does not know, as the schema says',
      async () => {
        await arrange();
        const response = await call(key, good, {
          json: { ...(good.json as Json), not_a_member: 1 },
          type,
        });
        if (body.additionalProperties === false) {
          expect(response.status).toBe(400);
          await expectProblem(response, operation);
        } else {
          expect(response.status).toBe(good.status);
        }
      },
    );
  }

  if (inQuery.includes('limit') && inQuery.includes('cursor')) {
    it.each(['limit=0', 'limit=101', 'limit=x', 'cursor=not-a-cursor'])(
      'refuses the query %s with 400',
      async (query) => {
        await arrange();
        const response = await call(key, good, { query });
        expect(response.status).toBe(400);
        await expectProblem(response, operation);
      },
    );
  }

  if (inQuery.includes('sort')) {
    it('refuses a sort it does not know with 400', async () => {
      await arrange();
      const response = await call(key, good, { query: 'sort=colour' });
      expect(response.status).toBe(400);
      await expectProblem(response, operation);
    });
  }

  if (operation.operationId === 'listRecipeSuggestions') {
    it.each(['', 'q=', `q=${'x'.repeat(301)}`, 'q=a&limit=0'])(
      'refuses the query %j with 400',
      async (query) => {
        await arrange();
        const response = await call(key, good, { query });
        expect(response.status).toBe(400);
        await expectProblem(response, operation);
      },
    );
  }

  if (inPath.length > 0 && documented(operation).includes(404)) {
    it('answers 404 for something that is not there', async () => {
      await arrange();
      const response = await call(key, good, {
        params: Object.fromEntries(
          inPath.map((name) => [
            String(name),
            name === 'note_id' ? '99' : 'nothing',
          ]),
        ),
      });
      expect(response.status).toBe(404);
      await expectProblem(response, operation);
    });
  }

  if (inPath.includes('note_id')) {
    it('answers 404 for a note id that is not a position', async () => {
      await arrange();
      const response = await call(key, good, {
        params: { ...good.params, note_id: 'abc' },
      });
      expect(response.status).toBe(404);
      await expectProblem(response, operation);
    });
  }

  if (!key.startsWith('GET ')) {
    it('refuses a request from another site with 403', async () => {
      await arrange();
      const response = await call(key, good, {
        headers: { 'sec-fetch-site': 'cross-site' },
      });
      expect(response.status).toBe(403);
      await expectProblem(response, operation);
    });
  }
});
