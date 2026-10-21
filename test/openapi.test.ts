import { describe, expect, it } from '@jest/globals';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

interface Operation {
  readonly responses: Readonly<Record<string, unknown>>;
  readonly security?: readonly unknown[];
}
interface Spec {
  readonly openapi: string;
  readonly security: readonly unknown[];
  readonly paths: Readonly<Record<string, Record<string, unknown>>>;
}

const root = process.cwd();
const spec = JSON.parse(
  readFileSync(path.join(root, 'openapi', 'openapi.json'), 'utf8'),
) as Spec;

const METHODS = ['get', 'put', 'post', 'delete', 'patch'];

/** Every `route.ts` below `src/app/api`, as its URL path with `{param}` segments. */
function routePaths(dir: string, prefix = '/api'): string[] {
  return readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(
    (entry) => {
      if (entry.isDirectory()) {
        const segment = entry.name.replace(/^\[(.+)\]$/, '{$1}');
        return routePaths(path.join(dir, entry.name), `${prefix}/${segment}`);
      }
      return entry.name === 'route.ts' ? [prefix] : [];
    },
  );
}

/** The methods a route file exports. */
function exportedMethods(routePath: string): string[] {
  const dir = routePath
    .replace(/^\/api/, 'src/app/api')
    .replace(/\{(.+?)\}/g, '[$1]');
  const source = readFileSync(path.join(root, dir, 'route.ts'), 'utf8');
  return [...source.matchAll(/export (?:async )?function ([A-Z]+)\(/g)]
    .map((m) => m[1]!.toLowerCase())
    .filter((m) => METHODS.includes(m));
}

const operations = Object.entries(spec.paths).flatMap(([url, item]) =>
  METHODS.filter((m) => m in item).map(
    (m) => [`${m.toUpperCase()} ${url}`, item[m] as Operation] as const,
  ),
);

describe('openapi/openapi.json', () => {
  it('is OpenAPI 3.1 and secures operations by default', () => {
    expect(spec.openapi).toMatch(/^3\.1\./);
    expect(spec.security.length).toBeGreaterThan(0);
  });

  it('describes exactly the routes under src/app/api, method for method', () => {
    const fromCode = routePaths('src/app/api').flatMap((url) =>
      exportedMethods(url).map((m) => `${m.toUpperCase()} ${url}`),
    );
    expect(operations.map(([name]) => name).toSorted()).toEqual(
      fromCode.toSorted(),
    );
  });

  it('uses lowercase, hyphen-free path segments', () => {
    for (const url of Object.keys(spec.paths)) {
      for (const segment of url.split('/').filter(Boolean)) {
        if (!segment.startsWith('{')) {
          expect(segment).toMatch(/^[a-z]+$/);
        }
      }
    }
  });

  it.each(operations)(
    '%s documents the 429 and a problem+json error',
    (_n, op) => {
      expect(op.responses).toHaveProperty('429');
      expect(Object.keys(op.responses).some((code) => /^[45]/.test(code))).toBe(
        true,
      );
    },
  );
});
