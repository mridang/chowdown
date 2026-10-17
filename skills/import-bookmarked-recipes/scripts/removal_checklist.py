#!/usr/bin/env python3
"""Print a checklist of bookmarks to remove, grouped by folder (READ-ONLY).

This script never deletes anything. Deleting bookmarks has to go through the
browser itself: the ``Bookmarks`` file is rewritten by the running browser, and
sync can bring back anything edited behind its back. The checklist is what the
user (or an agent that can operate the browser's bookmark manager) works from.

Input is the JSON produced by ``scan_bookmarks.py --json`` plus the ids that were
imported and verified, so only bookmarks that definitely made it into chowdown
are ever listed.

Usage:
    scan_bookmarks.py --json > scan.json
    removal_checklist.py scan.json --ids 118,159,160
"""

import argparse
import json
import re
import sys
from collections import OrderedDict


def build_checklist(report, ids):
    """Return {folder: [bookmark, ...]} for the wanted ids, in a stable order."""
    wanted = {i.strip() for i in ids if i.strip()}
    groups = OrderedDict()
    for entry in report:
        for bookmark in entry["bookmarks"]:
            if bookmark["id"] in wanted:
                groups.setdefault(bookmark["folder"] or "(top level)", []).append(bookmark)
    for items in groups.values():
        items.sort(key=lambda b: (b.get("added") or "", b["title"]))
    return groups


def missing_ids(report, ids):
    """Ids that were asked for but are not in the scan (already deleted, or typos)."""
    present = {b["id"] for entry in report for b in entry["bookmarks"]}
    return sorted({i.strip() for i in ids if i.strip()} - present)


def render(groups):
    lines = []
    total = sum(len(v) for v in groups.values())
    lines.append("Bookmarks to remove ({}):".format(total))
    for folder, items in groups.items():
        lines.append("")
        lines.append("{} ({})".format(folder, len(items)))
        for b in items:
            title = re.sub(r"\s+", " ", b["title"]).strip() or b["url"]
            lines.append("  [ ] {}  -  {}".format(title[:70], b["host"]))
    return "\n".join(lines)


def main(argv=None):
    parser = argparse.ArgumentParser(description="Checklist of imported bookmarks to remove (read-only).")
    parser.add_argument("scan", help="JSON from scan_bookmarks.py --json")
    parser.add_argument("--ids", required=True, help="comma-separated bookmark ids that were imported and verified")
    args = parser.parse_args(argv)
    with open(args.scan, encoding="utf-8") as handle:
        report = json.load(handle)
    ids = args.ids.split(",")
    print(render(build_checklist(report, ids)))
    gone = missing_ids(report, ids)
    if gone:
        print("\nNot found in the scan (already removed?): " + ", ".join(gone))
    return 0


if __name__ == "__main__":
    sys.exit(main())
