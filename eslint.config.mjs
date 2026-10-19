import { includeIgnoreFile } from '@eslint/compat';
import { fileURLToPath } from 'node:url';
import mridang from '@mridang/eslint-defaults';
import drizzle from 'eslint-plugin-drizzle';

export default [
  includeIgnoreFile(fileURLToPath(new URL('.gitignore', import.meta.url))),
  {
    ignores: [
      'worker-configuration.d.ts',
      'migrations/**',
      // JSONC config — comments/trailing commas trip the strict JSON
      // language the eslint-defaults preset registers for it.
      'wrangler.jsonc',
      // The OpenAPI document is formatted by Prettier, whose flow-mapping style
      // conflicts with the YAML plugin's; Prettier owns this file.
      'openapi/**',
      // src/worker.ts is the wrangler entry. It imports from
      // `.open-next/worker.js` (generated post-build) and is excluded
      // from tsconfig — type-aware lint can't parse it.
      'src/worker.ts',
    ],
  },
  ...mridang.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      // `cloudflare:workers` is a Workers runtime built-in (like Node's
      // `node:` modules) — an ambient module with no file to resolve to.
      // Whitelist it globally so `import/no-unresolved` stays active for
      // everything else.
      'import/core-modules': ['cloudflare:workers'],
    },
  },
  {
    // Application code does not mutate. Values are built with expressions
    // (`map`, `filter`, `reduce`, spread, `toSorted`, `toSpliced`, `with`,
    // `Object.fromEntries`) rather than declared empty and filled in, and
    // nothing is reassigned, so a value never changes under a reader's feet.
    // React refs (`ref.current = …`) are the one deliberate exception: they are
    // React's own escape hatch for values that live outside rendering.
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    rules: {
      'prefer-const': 'error',
      'no-param-reassign': ['error', { props: true }],
      'no-restricted-syntax': [
        'error',
        {
          selector: "VariableDeclaration[kind='let']",
          message:
            'Use const. Compute the value with an expression, a helper function, map/reduce, or a ternary instead of reassigning a let.',
        },
        {
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.property.name=/^(push|pop|shift|unshift|splice|sort|reverse|fill|copyWithin)$/]:not([callee.object.name='router'])",
          // (`router.push(url)` is navigation, not an array method.)
          message:
            'This changes the array in place. Build a new one: spread, concat, filter, toSorted, toReversed, toSpliced, with.',
        },
        {
          selector:
            "AssignmentExpression[left.type='MemberExpression'][left.property.name!='current']",
          message:
            'Do not assign to a property or an index. Build a new object or array (spread, Object.fromEntries, with).',
        },
        {
          selector: "UnaryExpression[operator='delete']",
          message:
            'Do not delete a property. Build a new object without it (destructure the key out, or use Object.fromEntries).',
        },
        {
          selector:
            "CallExpression[callee.object.name='Object'][callee.property.name='assign']",
          message:
            'Object.assign changes its first argument. Spread into a new object instead.',
        },
      ],
    },
  },
  {
    // The Tailwind lint plugin shipped with the preset is built for Tailwind 3:
    // it reads a tailwind.config file, which this Tailwind 4 project does not
    // have (the theme lives in `@theme` blocks in globals.css). It cannot see
    // the project's colours, radii or type, so it mislabels them as unknown
    // classes, and it re-resolves its config for every file, which took lint
    // from 8 seconds and 1.8 GB to 55 seconds and 6 GB. On a 7 GB CI runner that
    // stalled for hours. Class order is left to Prettier. Turn these back on
    // when the preset moves to a Tailwind 4 build of the plugin.
    rules: {
      'tailwindcss/classnames-order': 'off',
      'tailwindcss/enforces-negative-arbitrary-values': 'off',
      'tailwindcss/enforces-shorthand': 'off',
      'tailwindcss/no-custom-classname': 'off',
      'tailwindcss/no-unnecessary-arbitrary-value': 'off',
    },
  },
  {
    // Tailwind v4 drives styling through at-rules (@theme, @apply,
    // @custom-variant, …) that the css plugin's at-rule validator doesn't
    // know about. Tailwind owns this syntax, so disable just that check
    // for CSS while keeping the rest of the css ruleset active.
    // Next.js font loaders inject custom properties (e.g. --font-geist-sans,
    // --font-geist-mono) at runtime that the property validator can't see,
    // so disable no-invalid-properties for the same reason.
    files: ['**/*.css'],
    rules: {
      'css/no-invalid-at-rules': 'off',
      'css/no-invalid-properties': 'off',
    },
  },
  {
    // Drizzle safety net: a bare .delete()/.update() on the db wipes or
    // rewrites the whole table. Require a .where() on every one. Our
    // drizzle instance is reached as `this.db` in the repositories.
    files: ['src/**/*.ts'],
    plugins: { drizzle },
    rules: {
      'drizzle/enforce-delete-with-where': [
        'error',
        { drizzleObjectName: ['db'] },
      ],
      'drizzle/enforce-update-with-where': [
        'error',
        { drizzleObjectName: ['db'] },
      ],
    },
  },
  {
    // TypeScript checks unresolved identifiers better than eslint's
    // core no-undef, and the latter doesn't see Cloudflare Workers
    // ambient globals (D1Database, Fetcher, CloudflareEnv).
    files: ['**/*.ts', '**/*.tsx', '**/*.mts'],
    rules: {
      'no-undef': 'off',
      // The next/* plugin shipped via mridang's config doesn't load
      // here. Disable the unresolved rule definition rather than wire
      // the plugin since the underlying check is already covered by
      // next-config-typescript's compiler-level rules.
      '@next/next/no-img-element': 'off',
    },
  },
];
