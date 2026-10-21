---
name: import-bookmarked-recipes
description: Find the recipe links saved in the user's browser bookmarks (Chrome, Edge, Brave, Chromium, Vivaldi), import them into their chowdown recipe collection through the chowdown MCP connector, fix up missing cover photos, verify the result, and then — only after the user explicitly agrees — help remove the imported bookmarks. Use when the user says things like "import my bookmarked recipes", "move my saved recipes into chowdown", "periodically import my recipes", or "clean up my recipe bookmarks".
---

# Import bookmarked recipes into chowdown

Turns the recipe links scattered across a person's browser bookmarks into proper
recipes in their chowdown collection (Cooklang files in their own Google Drive),
then helps tidy the bookmarks away.

## What you need

- **The chowdown MCP connector**, with these tools: `import_recipe`,
  `set_recipe_images`, `list_recipes`, `get_recipe`. If they are missing, stop and
  tell the user to add chowdown as a connector: the MCP server URL shown at the
  top of the chowdown app (`…/mcp`), then sign in and approve when asked.
  The approval must include the `recipes:write` access, or imports will be
  refused. Do not try to work around it.
- **Python 3.8+** to run the helper scripts in `scripts/` (standard library only).
- **Read access to the browser profile folder** (the scanner reads the browser's
  `Bookmarks` file).
- **A way to read web pages**: a fetch or browser tool. A tool that runs
  JavaScript in the user's open browser is needed only for the cover-photo step.

## Hard rules

1. **Read-only on the browser profile.** Never edit, move or delete the
   `Bookmarks` file. The browser rewrites it while running and sync can restore
   anything changed behind its back.
2. **Ask before importing and ask before removing.** Show what you found first.
   Removal is always a separate, explicit question.
3. **Never bypass bot protection.** Do not use scraping proxies, challenge
   solvers, spoofed referers or similar. If a page blocks automated fetching,
   open it in the user's own browser as an ordinary visit and read it there. If
   the page shows a CAPTCHA or challenge, stop and ask the user to deal with it.
4. **Never import from a site that looks hijacked or parked** (a "for sale" page,
   gambling or other spam where a recipe site used to be). Report it instead.
5. **Only touch what was asked for.** Browser tools can see every open tab (mail,
   chat, work). Work only in tabs you open yourself, and never read or send
   anything that is not a recipe link.
6. **Don't invent content.** Never pass placeholder text ("recipe unavailable"),
   a summary you wrote, or Cooklang you generated to `import_recipe`. Pass the
   page's real text. chowdown writes the Cooklang itself.

## Workflow

### 1. Scan the bookmarks

```sh
python3 scripts/scan_bookmarks.py                    # readable list, grouped by category
python3 scripts/scan_bookmarks.py --json > scan.json # keep this for the later steps
```

It checks every profile of every supported browser and walks every folder
(bookmarks bar, other bookmarks, mobile/synced bookmarks and nested folders). Each
link is a **recipe**, a **site** (a front page or index, not one recipe), or
**unsure**. Use `--browser edge`, or `--profile <folder>` to target one profile.

The scoring is a heuristic and **will miss things** (one real recipe was saved
under the title "oni"). After reading the grouped results, run
`python3 scripts/scan_bookmarks.py --list-all` and skim the remainder yourself in
chunks of about 150 lines for recipes the scorer did not catch.

### 2. Show the user and ask

Present three short lists, each with the folder it lives in:

- **Recipes** to import.
- **Recipe sites** (not single recipes) — default to leaving these alone.
- **Unsure** — video links, redirects, anything odd; let the user decide.

Ask which to import. Remember the choices. Links the user declines can go in an
ignore file (one bookmark guid or URL per line) passed with
`--ignore ignore.txt`, so later runs don't ask again.

### 3. Import

For each approved link, one `import_recipe` call:

- `url`: the bookmark's address, with tracking parameters (`utm_*`, `fbclid`,
  `igshid`) removed but identifying ones kept (`?v=` on a video).
- `content`: the page's real text, fetched yourself.
- `images`: the recipe photo's address if you can see it (see step 5).

Work in batches of about ten and keep going if one fails. chowdown de-duplicates
by source address, so running again is safe: a link already imported is reported
as such, and an earlier import that saved no ingredients or steps is repaired in
place. If the server refuses a page ("no ingredients or steps") believe it: the
page had no readable recipe. Do not retry with filler text.

### 4. Verify — do not trust summaries

Check chowdown itself, not your own account of what happened. With `list_recipes`
and `get_recipe`, confirm for each imported link that:

- the recipe exists and its `source` is that link;
- it has at least one ingredient and at least one method step;
- it has tags (cuisine, protein, and so on);
- the recipe count rose by the number you expected.

Anything that fails is **not** safe to remove from the bookmarks.

### 5. Fix missing cover photos

chowdown fetches the page itself to find a photo, but many sites refuse automated
requests, so some recipes arrive without one. For each recipe still without a
cover:

1. Open the page in the user's browser (a normal visit) in a tab you created.
2. Run `scripts/extract-cover.js` in that page. It returns `{ title, best, candidates }`
   and only reads the page.
3. **Check the address really serves an image** before saving it: an HTTP 200, a
   content type starting with `image/`, and more than about 2 KB.
4. Call `set_recipe_images` with the recipe and the address. If two recipes share
   a title, pass the recipe's file id instead of its name.

Skip a page that says "Page not found", and skip any image that is a site-wide
default or logo. Close the tab when done.

### 6. Report

Give the user a short table: imported (with a note on cover and tags), already
there, and failed with the reason. Common reasons: the site is gone or parked, the
site now serves spam, the link is a video with no text, the page blocks automated
reading, or it was never a recipe.

### 7. Offer to remove the bookmarks (needs the user's explicit yes)

List only bookmarks whose recipe passed verification in step 4:

```sh
python3 scripts/removal_checklist.py scan.json --ids 118,159,160
```

Ask plainly: "Remove these N bookmarks?" and wait for a yes. Then:

- If you have a tool that can genuinely operate the browser's bookmark manager,
  remove them **one at a time**, re-confirm if anything unexpected appears, and
  never remove a bookmark that is not on the approved list.
- Otherwise hand the user the checklist and let them delete the bookmarks
  themselves. This is the normal case: the common browser tools cannot read or
  drive `chrome://bookmarks`.

Afterwards re-run the scanner. Confirm the approved bookmarks are gone and the
total dropped by exactly that many.

## Running it on a schedule

The user may ask to "periodically import my recipes". Set it up with the agent's
own scheduler (for example a scheduled task, `/schedule` or `/loop` in Claude
Code, or Cowork's scheduled tasks). It has to run **on the user's own computer**,
because it reads the local browser profile and uses their browser.

A scheduled run is unattended, so it is deliberately limited:

- import **only** links categorised `recipe` — never `site` or `unsure`;
- never remove bookmarks;
- finish with a report, and write the pending removal checklist where the user
  will see it. The next interactive session asks about removal (step 7).

## Gotchas learned the hard way

- Some browser tools refuse to print web addresses. Return counts and summaries,
  or move data through the clipboard (select text in a hidden `textarea` and use
  `document.execCommand('copy')`; the asynchronous Clipboard API is blocked on
  some sites).
- A scraper that finds no image can produce `…/undefined`. `extract-cover.js`
  rejects these; do the same in anything you write.
- Image addresses can contain spaces or commas. Keep each address intact and
  percent-encode spaces.
- Images load lazily. Only trust an `<img>` once it is `complete` and has a real
  `naturalWidth`.
- A match on the word "uploads" must not be treated as "ads". Match whole path
  words when skipping logos, avatars and ads.
- Video links (YouTube, Instagram, TikTok) rarely contain recipe text. Offer to
  use the video's description if the user can paste it; otherwise leave the
  bookmark in place.
- A site can look fine in a browser yet be a hijacked domain now serving spam.
  Check what the page actually is before importing from it.
