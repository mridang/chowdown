# 🍳 Chowdown

A zero-backend viewer for [Cooklang](https://cooklang.org) `.cook` recipe files,
opened straight from Google Drive. Pure static page: Google Identity Services +
Google Picker + [`@cooklang/cooklang-ts`](https://github.com/cooklang/cooklang-ts),
all client-side. No server, no secrets.

## Run locally

```sh
python3 -m http.server 8123 --directory .
# open http://localhost:8123
```

- `http://localhost:8123/?demo` — render the bundled sample (no Google needed).
- **Open local .cook** button — preview any local file (no Google needed).
- **Open from Drive** — needs the Google setup below.

## Google Cloud setup (one-time, no app review needed)

Because we only use the **`drive.file`** scope (non-sensitive), there is **no
Google verification/security review** and **nothing is published to the
Marketplace**. It's a private app used only by your own account.

1. **Create a project** — https://console.cloud.google.com → project picker →
   *New Project* → name it `Chowdown`.
2. **Enable two APIs** — *APIs & Services → Library*, enable:
   - **Google Drive API**
   - **Google Picker API**
3. **OAuth consent screen** — *APIs & Services → OAuth consent screen*:
   - User type **External** → Create.
   - App name `Chowdown`, your email for support + developer contact.
   - *Scopes* → Add → `.../auth/drive.file`.
   - *Test users* → add your own Gmail address.
   - Leave publishing status on **Testing** (tokens re-consent every 7 days), or
     click **Publish app** → status **In production** to stop that — with only
     `drive.file` this still needs **no review**.
4. **OAuth client ID** — *APIs & Services → Credentials → Create credentials →
   OAuth client ID*:
   - Type **Web application**.
   - *Authorized JavaScript origins*: `http://localhost:8123` (add your deployed
     origin later too).
   - Copy the **Client ID**.
5. **API key** — *Create credentials → API key*:
   - *Application restrictions* → **HTTP referrers**, add `http://localhost:8123/*`.
   - *API restrictions* → restrict to **Google Picker API**.
   - Copy the **API key**.
6. **(Optional) project number** — the Cloud Console dashboard shows a *Project
   number*. Setting it as `APP_ID` improves `drive.file` picker behaviour.

Paste the three values into [`config.js`](./config.js):

```js
export const CLIENT_ID = "....apps.googleusercontent.com";
export const API_KEY   = "AIzaSy....";
export const APP_ID    = "123456789012"; // optional
```

Reload `http://localhost:8123`, click **Open from Drive**, pick a `.cook` file.

## Later: the native "Open with" entry (optional)

This build opens a file *from inside the app*. If you want `.cook` files in
Drive to show **Open with → Chowdown** on right-click, register the app with the
**Google Workspace Marketplace SDK** and publish it **Unlisted**. With
`drive.file` that's still review-free; the app code barely changes (Drive passes
a `state` param with the file id instead of using the Picker).

## Deploy

Any static host. For Cloudflare Pages: point it at this directory, no build
command. Then add the deployed origin to the OAuth client's authorized origins
and the API key's referrer list.
