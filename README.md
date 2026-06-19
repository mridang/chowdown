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

To dev against the real domain over HTTPS (mirrors prod, valid OAuth origin),
trust the mkcert CA once, then run Next's HTTPS dev on port 443 (needs root):

```sh
mkcert -install                            # once — trusts the local CA
devbox shell                               # enter the Node 24 env
sudo env "PATH=$PATH" npm run dev:https     # https://chowdown.dev.mrida.ng
```

The cert is in `certs/` (gitignored), generated with
`mkcert chowdown.dev.mrida.ng`. The domain is a loopback (resolves to
127.0.0.1). Add `https://chowdown.dev.mrida.ng` to the OAuth origins for this.

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

## Deploy

```sh
wrangler d1 create chowdown-db   # paste the id into wrangler.jsonc
devbox run deploy                # opennextjs-cloudflare build && wrangler deploy
```

The custom domain `chowdown.apps.mrida.ng` requires the `apps.mrida.ng` zone on
the Cloudflare account.
