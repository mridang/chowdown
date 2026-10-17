# 🍳 chowdown

A viewer for [Cooklang](https://cooklang.org) `.cook` recipe files, opened
straight from Google Drive. Built as a Next.js app on Cloudflare (OpenNext) —
the same stack and conventions as [`scenery`](https://github.com/mridang/scenery).

The recipe rendering and the Google Drive Picker run entirely client-side; the
Cloudflare Worker just serves the app. A minimal D1/Drizzle layer is wired in
for future persistence (open history) but the viewer works without it.

## Stack

- **Next.js 16** (App Router) + **React 19**, **Tailwind 4**
- **Cloudflare Workers** via **OpenNext** (`@opennextjs/cloudflare`)
- **D1** + **Drizzle** (minimal `recipes` table)
- **devbox** (Node 24), **Jest**, **Cypress**, `@mridang/eslint-defaults`
- **[`@cooklang/cooklang-ts`](https://github.com/cooklang/cooklang-ts)** for parsing

## Develop

All commands go through devbox (pins Node 24):

```sh
devbox run dev        # next dev on http://localhost:3737
devbox run test       # jest
devbox run lint       # eslint
devbox run check      # test + build + lint
devbox run migrate    # apply D1 migrations locally
```

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
self-signed warning. Add `https://chowdown.dev.mrida.ng` to the OAuth origins
for Drive to work there.

> Passing the cert explicitly is what stops `--experimental-https` from
> downloading mkcert and installing a CA.

### Dev on localhost (simplest)

`http://localhost:3737` needs no cert at all — Google OAuth allows http for
localhost. Just `devbox run dev` and add `http://localhost:3737` to the OAuth
origins.

Try the renderer with no Google setup:

- http://localhost:3737/?demo — render the bundled sample
- the **Open local .cook** button — open any file off disk

## Google Drive setup (no app review needed)

Only the **`drive.file`** scope is used (non-sensitive), so there is **no Google
verification** and nothing is published to the Marketplace — a private app used
by your own account.

1. Enable **Google Drive API** and **Google Picker API** in a Google Cloud project.
2. **OAuth consent screen**: External, add the `.../auth/drive.file` scope, add
   your Gmail as a test user (or publish to production — still review-free).
3. **OAuth client ID** (Web application) → Authorized JavaScript origins:
   - `http://localhost:3737` (dev — Google allows http only for localhost)
   - `https://chowdown.apps.mrida.ng` (prod)
4. **API key** → restrict to HTTP referrers (`http://localhost:3737/*`,
   `https://chowdown.apps.mrida.ng/*`) and the Picker API.

Put the values in `.env.local` (gitignored; public by design):

```sh
NEXT_PUBLIC_GOOGLE_CLIENT_ID=....apps.googleusercontent.com
NEXT_PUBLIC_GOOGLE_API_KEY=AIzaSy....
NEXT_PUBLIC_GOOGLE_APP_ID=123456789012   # Cloud project number
```

These are inlined into the client bundle at build time, so the same values must
be present in the deploy environment for the production build.

## Connecting an assistant (MCP)

chowdown is an MCP server at `https://<your-domain>/api/mcp`, protected with
OAuth 2.1 as the [MCP authorization spec](https://modelcontextprotocol.io/specification/latest/basic/authorization)
describes. Add that URL as a connector in ChatGPT, Claude or any MCP client, sign
in with Google when asked, and approve. There is no secret to copy.

- **Scopes:** `recipes:read` (browse and search) and `recipes:write` (add, edit,
  tag, favourite, annotate). An assistant can be granted read only.
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

## Deploy

```sh
wrangler d1 create chowdown-db   # paste the id into wrangler.jsonc
devbox run deploy                # opennextjs-cloudflare build && wrangler deploy
```

The custom domain `chowdown.apps.mrida.ng` requires the `apps.mrida.ng` zone on
the Cloudflare account.

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
chowdown added to the agent as an MCP connector: use the MCP server URL shown at
the top of the app once you sign in, then approve the connection.
