<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

## Shared files

Shared files are byte-identical with plumbline, chowdown, broadsheet, scenery and marshall wherever the app has them. A change to one goes to all, in the same week; the per-app files are listed in plumbline's AGENTS.md. A lint fix in a shared file is made once and copied, never per repo.

The shared set in chowdown is `src/lib/core/` (except `http/site.ts`, `http/extras.ts`, `http/headers.ts` and `worker-extras.ts`), `src/lib/{http,mcp,oauth,web-security,google}`, `src/lib/safe-fetch.ts`, `src/lib/crypto.ts`, `src/utils` (except `site.ts`), `src/components/api`, `src/components/ui/{button,callout,cn,layout,popover,copy-field}`, `src/components/site/{ios-install,use-install-prompt,bare-page,install-ios-hint,theme-script,centered-card}`, the shell files of `src/app` (`_metadata.ts`, `_security-txt.ts`, `manifest.ts`, `robots.ts`, `sitemap.ts`, `error.tsx`, `global-error.tsx`, `layout.tsx`, `not-found.tsx`, `.well-known/security.txt`, `csp/reports`, `health`), `src/domain/mcp/{auth,env,http,request-limits,tool-calls,tool-definitions}.ts`, `src/domain/auth/sign-in.ts` and their mirrors under `test/`. What is chowdown's own: `src/app/_brand.ts`, `src/utils/site.ts`, `src/domain/**/app.ts`, the pages, `src/components/{icons,landing}` and the site shell, header, footer, logo and account menu, and the test fixtures `test/fixtures/insecure-urls.json` and `ips.json` together with the tests that read them.

## MCP registry listing

`server.json` is the listing of the MCP server in the official MCP Registry (`io.github.mridang/chowdown`). It is published once, by hand, with `mcp-publisher` (the official binary from the `modelcontextprotocol/registry` GitHub releases; the `mcp-publisher` package on npm is an unrelated tool). It is not published on deploy: the registry only stores where the server is, clients read the tools from `/mcp` itself, and a published version can never be changed.

Keep it in step with the server. Its `version` must equal `version` in `package.json` and `SERVER_VERSION` in `src/lib/mcp/server-info.ts`, and its title, website, icons and endpoint must match `src/lib/site.ts` and `server-info.ts`. Its description may not be longer than 100 characters. `test/lib/mcp/server-info.test.ts` fails when any of these drift.

Run `mcp-publisher validate` after editing it. Publish again only when the listing itself changes (the description, title, icons or endpoint), and give that publication a new version, for example the prerelease `0.1.0-1` when the app's version has not moved. A prerelease would fail the version check above, so change the check in the same commit.

## Tailwind

Tailwind 4 no longer gives `<button>` the pointer cursor, so the base layer of the app's stylesheet carries one rule that does (buttons, `summary`, `select`, `[role='button']` and button-like inputs, never disabled ones). Keep it, and keep it identical across the apps. Do not add `cursor-pointer` to individual buttons to work around its absence, and do not restyle a link or a button to fake the other: use `<a>` or `<Link>` when the click goes to a URL, and `<button>` when it acts on the current page.

## HTTP API

`openapi.json` at the repository root describes exactly the REST contract under `/api` and nothing else (OAuth, sign-in, `/mcp`, `/health`, `/img` and `/csp/reports` stay outside it). It is written by hand. `test/openapi.test.ts` fails when it drifts from the route files, so a new or changed route, body, query parameter or status code changes `openapi.json` in the same commit. Everything that is not a resource lives at the root, never under `/api`; errors under `/api` are always `application/problem+json` built with `problems`.
