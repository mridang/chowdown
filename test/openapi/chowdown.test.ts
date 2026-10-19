import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from '@jest/globals';
import { parse } from 'yaml';

/** The parts of the document these tests look at. */
interface Document {
  readonly paths: Readonly<
    Record<
      string,
      Readonly<
        Record<
          string,
          {
            readonly requestBody?: unknown;
            readonly responses?: Readonly<Record<string, unknown>>;
          }
        >
      >
    >
  >;
  readonly components: {
    readonly responses: Readonly<Record<string, unknown>>;
    readonly schemas: Readonly<Record<string, unknown>>;
  };
}

const document = parse(
  readFileSync(path.join(process.cwd(), 'openapi/chowdown.yaml'), 'utf8'),
) as Document;

const METHODS = new Set(['get', 'put', 'post', 'patch', 'delete']);

/** Every operation as `METHOD /path` with its responses. */
const operations = Object.entries(document.paths).flatMap(([route, item]) =>
  Object.entries(item)
    .filter(([method]) => METHODS.has(method))
    .map(([method, operation]) => ({
      name: `${method.toUpperCase()} ${route}`,
      takesBody: operation.requestBody !== undefined,
      responses: operation.responses ?? {},
    })),
);

/** Every `$ref` string anywhere in the document. */
function refsIn(value: unknown): readonly string[] {
  if (Array.isArray(value)) {
    return value.flatMap(refsIn);
  }
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([key, inner]) =>
      key === '$ref' && typeof inner === 'string' ? [inner] : refsIn(inner),
    );
  }
  return [];
}

describe('openapi/chowdown.yaml', () => {
  it('has operations', () => {
    expect(operations.length).toBeGreaterThan(20);
  });

  it('resolves every local $ref', () => {
    for (const ref of refsIn(document)) {
      const found = ref
        .replace(/^#\//, '')
        .split('/')
        .reduce<unknown>(
          (node, key) =>
            typeof node === 'object' && node !== null
              ? Reflect.get(node, key)
              : undefined,
          document,
        );
      expect([ref, found !== undefined]).toEqual([ref, true]);
    }
  });

  it('documents the rate limit on every operation that needs a session', () => {
    const missing = operations
      .filter(({ responses }) => '401' in responses && !('429' in responses))
      .map(({ name }) => name);
    expect(missing).toEqual([]);
  });

  it('documents Retry-After on the 429 response', () => {
    expect(document.components.responses['TooManyRequests']).toMatchObject({
      headers: { 'Retry-After': { schema: { type: 'integer' } } },
    });
  });

  it('documents the body size limit on every operation that takes a body and needs a session', () => {
    const missing = operations
      .filter(
        ({ takesBody, responses }) =>
          takesBody && '401' in responses && !('413' in responses),
      )
      .map(({ name }) => name);
    expect(missing).toEqual([]);
  });
});
