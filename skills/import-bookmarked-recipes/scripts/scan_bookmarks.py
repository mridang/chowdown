#!/usr/bin/env python3
"""Find recipe links in a Chromium browser's bookmarks (READ-ONLY).

Chrome, Edge, Brave, Chromium and Vivaldi all keep bookmarks in a JSON file
named ``Bookmarks`` inside each profile folder. This script reads that file,
walks every folder (bookmarks bar, other bookmarks, synced/mobile bookmarks and
all nested folders), scores each link for "looks like a recipe", and prints the
result. It never writes to the file — editing it while the browser is running
is unsafe, because the browser rewrites it and sync can resurrect changes.

Standard library only (Python 3.8+).

Usage:
    scan_bookmarks.py                      # scan every profile found, show candidates
    scan_bookmarks.py --browser edge       # one browser
    scan_bookmarks.py --profile "/path/to/Profile 1"
    scan_bookmarks.py --list-all           # compact list of EVERYTHING, for review
    scan_bookmarks.py --json               # machine-readable output
    scan_bookmarks.py --ignore ignore.txt  # skip links the user already declined

Each bookmark is given a category:
    recipe  - a single recipe (page or video)
    site    - a recipe website or a collection/index page, not one recipe
    unsure  - might be food related; ask the user
    other   - not a recipe (only shown with --list-all)
"""

import argparse
import json
import os
import re
import sys
import unicodedata
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

# Folder that holds the profiles for each browser, per operating system.
BROWSER_DIRS = {
    "darwin": {
        "chrome": "~/Library/Application Support/Google/Chrome",
        "edge": "~/Library/Application Support/Microsoft Edge",
        "brave": "~/Library/Application Support/BraveSoftware/Brave-Browser",
        "chromium": "~/Library/Application Support/Chromium",
        "vivaldi": "~/Library/Application Support/Vivaldi",
    },
    "linux": {
        "chrome": "~/.config/google-chrome",
        "edge": "~/.config/microsoft-edge",
        "brave": "~/.config/BraveSoftware/Brave-Browser",
        "chromium": "~/.config/chromium",
        "vivaldi": "~/.config/vivaldi",
    },
    "win32": {
        "chrome": "%LOCALAPPDATA%\\Google\\Chrome\\User Data",
        "edge": "%LOCALAPPDATA%\\Microsoft\\Edge\\User Data",
        "brave": "%LOCALAPPDATA%\\BraveSoftware\\Brave-Browser\\User Data",
        "chromium": "%LOCALAPPDATA%\\Chromium\\User Data",
        "vivaldi": "%LOCALAPPDATA%\\Vivaldi\\User Data",
    },
}

# Well-known recipe websites: a link on one of these is almost certainly a recipe.
RECIPE_HOSTS = {
    "seriouseats.com", "bonappetit.com", "cooking.nytimes.com", "epicurious.com",
    "allrecipes.com", "delish.com", "tasty.co", "bbcgoodfood.com", "bbc.co.uk",
    "kingarthurbaking.com", "food52.com", "simplyrecipes.com", "thekitchn.com",
    "budgetbytes.com", "cookieandkate.com", "minimalistbaker.com",
    "loveandlemons.com", "justonecookbook.com", "recipetineats.com",
    "thewoksoflife.com", "maangchi.com", "ethanchlebowski.com", "kenjilopezalt.com",
    "jamieoliver.com", "bongeats.com", "indianhealthyrecipes.com",
    "thecleaneatingcouple.com", "ribbonstopastas.com", "thriftandspice.com",
    "howtofeedaloon.com", "whatmollymade.com", "insidetherustickitchen.com",
    "hebbarskitchen.com", "vegrecipesofindia.com", "cookwithmanali.com",
    "mybakingaddiction.com", "pinchofyum.com", "damndelicious.net",
    "smittenkitchen.com", "halfbakedharvest.com", "nytimes.com/recipes",
}

# Sites that are never recipes, even if a word in the address looks like food.
NON_RECIPE_HOSTS = {
    "github.com", "gist.github.com", "stackoverflow.com", "serverfault.com",
    "codepen.io", "jsfiddle.net", "aws.amazon.com", "docs.aws.amazon.com",
    "console.aws.amazon.com", "medium.com", "dev.to", "news.ycombinator.com",
    "hckrnews.com", "reddit.com", "google.com", "mail.google.com", "docs.google.com",
    "chatgpt.com", "slack.com", "app.slack.com", "linkedin.com", "twitter.com",
    "x.com", "facebook.com", "amazon.com", "ebay.com", "apple.com",
}

VIDEO_HOSTS = {"youtube.com", "youtu.be", "instagram.com", "tiktok.com", "vimeo.com"}

# Words that mean "this is a recipe" when they appear in the title or path.
STRONG_WORDS = re.compile(
    r"\brecipes?\b|\bingredients?\b|\bcookbook\b|\bmeal prep\b", re.I)

# "How to make ..." is only weak evidence on its own (it also starts tech posts).
HOW_TO = re.compile(r"\bhow to (?:make|cook|bake|grill|roast)\b", re.I)

# Food and cooking nouns: weak evidence each, stronger together.
FOOD_WORDS = re.compile(
    r"\b(?:chicken|mutton|lamb|pork|beef|steak|fish|prawns?|shrimp|salmon|tofu|"
    r"paneer|egg|eggs|pasta|noodles?|ramen|rice|biryani|pulao|curry|dal|dhal|soup|"
    r"stew|salad|sandwich|burgers?|pizza|tacos?|burritos?|enchiladas?|quesadillas?|"
    r"meatballs?|albondigas|kebabs?|kababs?|tikka|masala|korma|keema|saag|palak|"
    r"chutney|pickles?|sauce|marinade|dough|bread|naan|roti|dosa|idli|cake|cookies?|"
    r"brownies?|pie|tart|pancakes?|waffles?|dessert|breakfast|dinner|lunch|snack|"
    r"roast|grilled|baked|fried|braised|stir[- ]fry|casserole|dumplings?|kimchi|"
    r"sushi|hummus|falafel|chorizo|bacon|cheese|garlic|spinach|potato|potatoes|"
    r"mushroom|lentils?|chickpeas?|sourdough|ferment(?:ed|ing)?|cocktail)\b", re.I)

# Words that suggest a shop or a non-recipe page.
SHOP_WORDS = re.compile(
    r"\b(?:shop|store|buy|sale|collections?|products?|cart|checkout|discount|"
    r"restaurants?|menu|hotel|booking|tickets?|review|forecast|stock|price|"
    r"hardware|mixers?|supplies|wallets?|watches)\b", re.I)

# A path that is just a site's front page or a recipe index.
INDEX_PATH = re.compile(r"^/?(?:recipes?/?|index\.html?|home/?)?$", re.I)


def fold(text):
    """Strip accents so "Albóndigas" matches "albondigas"."""
    decomposed = unicodedata.normalize("NFKD", text or "")
    return "".join(c for c in decomposed if not unicodedata.combining(c))


def webkit_to_iso(value):
    """Chrome stores dates as microseconds since 1601-01-01 UTC."""
    try:
        micros = int(value)
        return (datetime(1601, 1, 1, tzinfo=timezone.utc)
                + timedelta(microseconds=micros)).strftime("%Y-%m-%d")
    except (TypeError, ValueError, OverflowError):
        return ""


def host_of(url):
    """The host without a leading www/m/mobile, lower-cased."""
    host = (urlparse(url).hostname or "").lower()
    return re.sub(r"^(?:www|m|mobile)\.", "", host)


def host_matches(host, hosts):
    """True if the host is one of the listed hosts or a subdomain of one."""
    return any(host == h or host.endswith("." + h) for h in hosts)


def classify(title, url):
    """Return (category, score, reasons) for one bookmark.

    The score adds up small pieces of evidence; the thresholds below turn it
    into a category. Kept deliberately simple and explainable.
    """
    parsed = urlparse(url)
    host = host_of(url)
    path = parsed.path or "/"
    title = fold(title)
    text = "{} {}".format(title, path.replace("-", " ").replace("_", " ").replace("/", " "))
    reasons = []
    score = 0

    if parsed.scheme not in ("http", "https"):
        return "other", 0, ["not a web link"]
    if host_matches(host, NON_RECIPE_HOSTS):
        return "other", 0, ["site is not about recipes"]

    # An Instagram redirect wraps the real address in ?u=...
    if host == "l.instagram.com":
        return "unsure", 1, ["Instagram redirect; target not checked"]

    known = host_matches(host, RECIPE_HOSTS)
    if known:
        score += 5
        reasons.append("known recipe site")
    if re.search(r"/recipes?(?:/|-|$)|-recipes?(?:/|-|$)|recipes?-", path, re.I):
        score += 4
        reasons.append("'recipe' in the address")
    if STRONG_WORDS.search(title):
        score += 4
        reasons.append("'recipe' wording in the title")
    foods = {m.lower() for m in FOOD_WORDS.findall(text)}
    if HOW_TO.search(title) and foods:
        score += 1
        reasons.append("'how to make' with food words")
    if foods:
        score += min(len(foods), 3)
        reasons.append("food words: " + ", ".join(sorted(foods)[:4]))
    if SHOP_WORDS.search(title) or re.search(r"/(?:shop|collections?|products?)/", path, re.I):
        score -= 3
        reasons.append("looks like a shop page")

    is_video = host_matches(host, VIDEO_HOSTS)
    is_index = bool(INDEX_PATH.match(path)) or bool(re.search(r"/recipes/?$", path, re.I))

    if is_video:
        # A video can be a recipe, but there is usually no text to import, so
        # even one food word is worth surfacing for the user to decide.
        if score < 1:
            return "other", score, reasons
        return ("recipe" if score >= 3 else "unsure"), score, reasons + ["video"]
    if score < 2:
        return "other", score, reasons
    if is_index and (known or score >= 4):
        return "site", score, reasons + ["front page or index, not a single recipe"]
    if score >= 5 or (score >= 3 and foods):
        return "recipe", score, reasons
    return "unsure", score, reasons


def profile_dirs(browser, explicit=None):
    """Yield (browser, profile_dir) for every profile that has a Bookmarks file."""
    if explicit:
        if os.path.isfile(os.path.join(explicit, "Bookmarks")):
            yield "custom", explicit
        return
    platform = "darwin" if sys.platform == "darwin" else "win32" if sys.platform.startswith("win") else "linux"
    for name, raw in BROWSER_DIRS[platform].items():
        if browser not in ("all", name):
            continue
        base = os.path.expandvars(os.path.expanduser(raw))
        if not os.path.isdir(base):
            continue
        for entry in sorted(os.listdir(base)):
            full = os.path.join(base, entry)
            if (entry == "Default" or entry.startswith("Profile ")) and os.path.isfile(os.path.join(full, "Bookmarks")):
                yield name, full


def walk(node, path, out):
    """Collect every link under a bookmarks node, remembering its folder path."""
    if node.get("type") == "url":
        out.append({
            "id": node.get("id", ""),
            "guid": node.get("guid", ""),
            "folder": " / ".join(path),
            "title": node.get("name", ""),
            "url": node.get("url", ""),
            "added": webkit_to_iso(node.get("date_added")),
        })
        return
    name = node.get("name")
    for child in node.get("children", []):
        walk(child, path + [name] if name else path, out)


def read_bookmarks(profile_dir):
    """Return every bookmark in a profile as a flat list (read-only)."""
    with open(os.path.join(profile_dir, "Bookmarks"), encoding="utf-8") as handle:
        data = json.load(handle)
    out = []
    for root in data.get("roots", {}).values():
        if isinstance(root, dict) and "children" in root:
            walk(root, [], out)
    return out


def load_ignore(path):
    """Read an ignore list: one bookmark guid or URL per line, '#' starts a comment."""
    wanted = set()
    with open(path, encoding="utf-8") as handle:
        for line in handle:
            line = line.split("#", 1)[0].strip()
            if line:
                wanted.add(line)
    return wanted


def scan(bookmarks, ignored=()):
    """Attach a category, score and reasons to each bookmark.

    Anything whose guid or URL is in ``ignored`` becomes ``ignored`` and is left
    out of every list, so a periodic run does not ask about it again.
    """
    results = []
    for b in bookmarks:
        if b["guid"] in ignored or b["url"] in ignored:
            results.append(dict(b, category="ignored", score=0, reasons=["on the ignore list"], host=host_of(b["url"])))
            continue
        category, score, reasons = classify(b["title"], b["url"])
        results.append(dict(b, category=category, score=score, reasons=reasons, host=host_of(b["url"])))
    return results


def short(text, width):
    text = re.sub(r"\s+", " ", text or "")
    return text if len(text) <= width else text[: width - 1] + "…"


def main(argv=None):
    parser = argparse.ArgumentParser(description="Find recipe links in browser bookmarks (read-only).")
    parser.add_argument("--browser", default="all", choices=["all"] + sorted(BROWSER_DIRS["linux"]))
    parser.add_argument("--profile", help="path to one profile folder (contains a Bookmarks file)")
    parser.add_argument("--list-all", action="store_true", help="list every bookmark, for manual review")
    parser.add_argument("--json", action="store_true", help="print JSON instead of a table")
    parser.add_argument("--ignore", help="file of bookmark guids or URLs to skip (one per line)")
    args = parser.parse_args(argv)

    found = list(profile_dirs(args.browser, args.profile))
    if not found:
        print("No browser profile with a Bookmarks file was found. Use --profile.", file=sys.stderr)
        return 2

    ignored = load_ignore(args.ignore) if args.ignore else set()
    report = []
    for browser, directory in found:
        items = scan(read_bookmarks(directory), ignored)
        report.append({"browser": browser, "profile": directory, "total": len(items), "bookmarks": items})

    if args.json:
        json.dump(report, sys.stdout, indent=1)
        print()
        return 0

    for entry in report:
        items = entry["bookmarks"]
        print("== {} ({}) - {} bookmarks".format(entry["browser"], entry["profile"], entry["total"]))
        for category in ("recipe", "site", "unsure"):
            group = [b for b in items if b["category"] == category]
            print("\n{} ({})".format(category.upper(), len(group)))
            for b in sorted(group, key=lambda x: (-x["score"], x["title"])):
                print("  [{:>4}] {:<28} {:<54} {}".format(
                    b["id"], short(b["folder"], 28), short(b["title"], 54), short(b["host"], 28)))
        if args.list_all:
            print("\nEVERYTHING ELSE")
            for b in items:
                if b["category"] == "other":
                    print("  {}|{}|{}".format(b["id"], short(b["title"], 60), short(b["host"], 30)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
