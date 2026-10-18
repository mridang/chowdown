# 🍳 chowdown

A recipe app for [Cooklang](https://cooklang.org) `.cook` files, kept in the
person's own Google Drive. Built as a Next.js app on Cloudflare (OpenNext) — the
same stack and conventions as [`scenery`](https://github.com/mridang/scenery).

The Cloudflare Worker does the real work: Google sign-in, a separate "Connect
Google Drive" step, syncing the Recipes folder into a D1 cache, the REST API,
the MCP server (with its OAuth 2.1 endpoints) and the model calls for tagging and
"find similar" (Workers AI). Drive stays the source of truth; D1 is a cache so
pages render in one round trip.

## Stack

- **Next.js 16** (App Router) + **React 19**, **Tailwind 4**
- **Cloudflare Workers** via **OpenNext** (`@opennextjs/cloudflare`), with the
  **D1** (+ **Drizzle**), **Workers AI** and **Images** bindings
- **devbox** (Node 24), **Jest**, **Cypress**, `@mridang/eslint-defaults`
- **[`@cooklang/cooklang-ts`](https://github.com/cooklang/cooklang-ts)** for parsing

## Develop

All commands go through devbox (pins Node 24):

```sh
devbox run login      # once: wrangler login (the AI binding is remote-only in dev)
devbox run migrate    # apply D1 migrations locally
npm run build:views   # once, and after changing src/views: the generated widget pages
devbox run dev        # next dev on http://localhost:3737
devbox run test       # jest
devbox run lint       # eslint
devbox run check      # test + build + lint
```

`npm run typecheck` runs the TypeScript compiler. Put the secrets listed under
[Google setup](#google-setup) in `.dev.vars` (gitignored) before signing in.

### Dev on the real domain (https://chowdown.dev.mrida.ng)

`chowdown.dev.mrida.ng` is a loopback domain (resolves to 127.0.0.1). To serve
the app there over HTTPS on port 443, with a self-signed cert (no mkcert, no CA
installed):

```sh
npm run cert:dev                              # once — generates certs/ (gitignored)
sudo env "PATH=$PATH" npm run dev:https        # binds 443 (privileged → sudo)
```

Then in Chrome: clear HSTS once at `chrome://net-internals/#hsts` (delete
`mrida.ng` — it inherits HSTS, which otherwise blocks the cert click-through),
open https://chowdown.dev.mrida.ng, and **Advanced → Proceed** past the
self-signed warning. Add `https://chowdown.dev.mrida.ng/api/auth/callback` to the
OAuth client's redirect URIs for sign-in to work there.

> Passing the cert explicitly is what stops `--experimental-https` from
> downloading mkcert and installing a CA.

### Dev on localhost (simplest)

`http://localhost:3737` needs no cert at all — Google OAuth allows http for
localhost. Just `devbox run dev` and add
`http://localhost:3737/api/auth/callback` to the OAuth client's redirect URIs.

## Google setup

Signing in and connecting Google Drive are two separate steps, each with its own
Google consent screen:

1. **Sign in** asks for identity only (`openid email profile`). It creates the
   account and a signed session cookie, and nothing else.
2. **Connect Google Drive** (the button in the header, the account menu, and on
   pages that need it; `GET /api/auth/drive`) adds the `drive.file` scope and an
   offline refresh token, then creates the app-managed "Recipes" folder.
   `drive.file` is non-sensitive and only reaches files chowdown created, so
   there is **no Google verification** and nothing is published to the
   Marketplace.

Until Drive is connected a person can look around and see anything already
cached, but anything that reads or writes their Drive files is refused (the REST
API answers `409 /problems/drive-not-connected`, MCP tools return an error
result that says what to do).

Set up in Google Cloud:

1. Enable the **Google Drive API**.
2. **OAuth consent screen**: External, add the `.../auth/drive.file` scope, add
   your Gmail as a test user (or publish to production — still review-free).
3. **OAuth client ID** (Web application) → **Authorized redirect URIs**:
   - `http://localhost:3737/api/auth/callback` (dev)
   - `https://chowdown.apps.mrida.ng/api/auth/callback` (prod)

Secrets, in `.dev.vars` locally and `wrangler secret put <NAME>` in production:

```sh
GOOGLE_OAUTH_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=...
SESSION_SECRET=...          # openssl rand -base64 32 — signs the session cookie
TOKEN_ENCRYPTION_KEY=...    # openssl rand -base64 32 — seals Drive refresh tokens
```

`APP_URL` is optional (the public origin, if it can't be read from the request).

## Connecting an assistant (MCP)

chowdown is an MCP server at `https://<your-domain>/api/mcp`, protected with
OAuth 2.1 as the [MCP authorization spec](https://modelcontextprotocol.io/specification/latest/basic/authorization)
describes. Add that URL as a connector in ChatGPT, Claude or any MCP client, sign
in with Google when asked, and approve. There is no secret to copy. The person
needs to have connected Google Drive (see above); until then the assistant is
told so instead of being shown an empty collection.

- **Scopes:** `recipes:read` (browse and search) and `recipes:write` (add, edit,
  tag, favourite, annotate). An assistant can be granted read only.
- **Asking what to cook:** `browse_recipes` ("I feel like cooking Indian",
  "something vegetarian under 30 minutes"), `recipes_from_ingredients` ("I have 3
  tomatoes and 400 g of pasta" returns what can be cooked now and what is a
  couple of ingredients short) and `list_filters`. Every recipe is classed as
  vegan, vegetarian, pescatarian or non-vegetarian from its ingredients, so
  results can be grouped and filtered by diet; existing recipes get this without
  being re-tagged.
- **Discovery:** `/.well-known/oauth-protected-resource/api/mcp` (RFC 9728) and
  `/.well-known/oauth-authorization-server` (RFC 8414).
- **Client registration:** Client ID Metadata Documents (preferred) and dynamic
  registration (`/oauth/register`, RFC 7591). Public clients only, PKCE `S256`
  required.
- **Tokens:** opaque, stored hashed. Access tokens last an hour; refresh tokens
  rotate on every use, and reusing an old one revokes the whole connection.
- **Disconnect:** "Connected apps" in the app, or `POST /oauth/revoke`.
- **Legacy link:** the older secret URL `/api/mcp/<token>` still works with full
  access, but prefer the OAuth URL.

## REST API

The app's data is available as a REST API under `/api`, described in
[`openapi/chowdown.yaml`](openapi/chowdown.yaml) and designed to the
[Zalando RESTful API guidelines](https://opensource.zalando.com/restful-api-guidelines/)
(plural kebab-case nouns, `snake_case` JSON, RFC 9457 problem details, cursor
pagination, JSON Merge Patch, `ETag` / `If-Match`). The one deliberate departure
is the `/api` prefix, which is declared in the spec's `servers` entry.

| Resource                                          | Methods                                     |
| ------------------------------------------------- | ------------------------------------------- |
| `/api/recipes`, `/api/recipes/{recipe-id}`        | list, create · read, replace, patch, delete |
| `/api/recipes/{recipe-id}/notes[/{note-id}]`      | list, create · read, replace, delete        |
| `/api/recipes/{recipe-id}/similar-recipes`        | list                                        |
| `/api/recipe-suggestions?q=`                      | list                                        |
| `/api/recipe-imports[/{import-id}]`               | list, create · read, delete                 |
| `/api/users/self`                                 | read, patch                                 |
| `/api/users/self/favourite-recipes[/{recipe-id}]` | list · read, put, delete                    |
| `/api/users/self/connected-apps[/{grant-id}]`     | list · delete                               |
| `/api/sessions/self`                              | delete (sign out)                           |

Auth is the signed session cookie. Writes must come from the app's own pages
(cross-site writes get `403`). Signing in does not connect Google Drive: writes
and `/api/recipe-suggestions` answer `409 /problems/drive-not-connected` until
the person has connected it in the browser. Everything that is not a resource stays out
of the API: MCP (`/api/mcp`), OAuth (`/oauth/*`, `/.well-known/*`), the Google
sign-in and Drive-connection redirects (`/api/auth/*`), the health check, the
cover-image proxy (`/api/cover-images`) and auto-tagging (`POST /rpc/tag-recipe`,
a model call).

## Deploy

```sh
wrangler d1 create chowdown-db                         # paste the id into wrangler.jsonc
wrangler d1 migrations apply chowdown-db --remote      # schema (CI does this too)
# the four secrets from "Google setup", one `wrangler secret put` each
devbox run deploy                                      # opennextjs-cloudflare build && wrangler deploy
```

The custom domain `chowdown.apps.mrida.ng` requires the `apps.mrida.ng` zone on
the Cloudflare account, and the Worker needs the AI and Images bindings
(declared in `wrangler.jsonc`).

GitHub Actions (`deploy.yml`) deploys on pushes to `master`. It needs a
`CLOUDFLARE_API_TOKEN` secret and a `CLOUDFLARE_ACCOUNT_ID` variable in the
`production` environment.

## Agent skills

Skills are folders an AI agent can load to carry out a task end to end. They
follow the open Agent Skills format (a `SKILL.md` plus helper scripts), so they
work in Claude Code, Cowork, GitHub Copilot and other agents that read it.

| Skill                                                                    | What it does                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`import-bookmarked-recipes`](skills/import-bookmarked-recipes/SKILL.md) | Finds recipe links in your browser bookmarks, imports them into chowdown through your MCP connector, fixes missing cover photos, verifies the result, and offers to remove the imported bookmarks only after you say yes. Can also run on a schedule ("periodically import my recipes"), in which case it imports but never deletes. |

To install one, copy or symlink its folder into your agent's skills folder:

```sh
# Claude Code (all projects)
ln -s "$PWD/skills/import-bookmarked-recipes" ~/.claude/skills/import-bookmarked-recipes

# GitHub Copilot (this repository)
mkdir -p .github/skills && cp -R skills/import-bookmarked-recipes .github/skills/
```

In Cowork, upload the folder (zipped) as a custom skill. The skill also needs
chowdown added to the agent as an MCP connector: use the MCP server address on the home page or
the app's "Cook with AI" page, then approve the connection.
