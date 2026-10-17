"""Tests for removal_checklist.py."""

import io
import json
import os
import tempfile
import unittest
from contextlib import redirect_stdout

import removal_checklist as rc

REPORT = [{"bookmarks": [
    {"id": "1", "folder": "Mobile Bookmarks", "title": "B recipe", "host": "b.com", "added": "2024-02-01"},
    {"id": "2", "folder": "Mobile Bookmarks", "title": "A recipe", "host": "a.com", "added": "2024-01-01"},
    {"id": "3", "folder": "Other bookmarks / Food", "title": "Soup", "host": "c.com", "added": "2023-05-05"},
    {"id": "4", "folder": "Other bookmarks", "title": "Not imported", "host": "d.com", "added": ""},
]}]


class ChecklistTests(unittest.TestCase):
    def test_only_the_requested_ids_are_listed_grouped_by_folder(self):
        groups = rc.build_checklist(REPORT, ["1", "2", "3"])
        self.assertEqual(list(groups), ["Mobile Bookmarks", "Other bookmarks / Food"])
        self.assertNotIn("Not imported", rc.render(groups))

    def test_items_in_a_folder_are_ordered_by_date_added(self):
        groups = rc.build_checklist(REPORT, ["1", "2"])
        self.assertEqual([b["id"] for b in groups["Mobile Bookmarks"]], ["2", "1"])

    def test_blank_and_padded_ids_are_ignored(self):
        self.assertEqual(list(rc.build_checklist(REPORT, [" 3 ", "", " "])), ["Other bookmarks / Food"])

    def test_ids_not_in_the_scan_are_reported(self):
        self.assertEqual(rc.missing_ids(REPORT, ["1", "99", "100"]), ["100", "99"])

    def test_render_shows_a_count_and_one_checkbox_per_bookmark(self):
        text = rc.render(rc.build_checklist(REPORT, ["1", "2", "3"]))
        self.assertIn("Bookmarks to remove (3):", text)
        self.assertEqual(text.count("[ ]"), 3)

    def test_main_prints_the_checklist_and_never_touches_the_scan_file(self):
        path = os.path.join(tempfile.mkdtemp(), "scan.json")
        with open(path, "w", encoding="utf-8") as handle:
            json.dump(REPORT, handle)
        with open(path, "rb") as handle:
            before = handle.read()
        buf = io.StringIO()
        with redirect_stdout(buf):
            self.assertEqual(rc.main([path, "--ids", "1,99"]), 0)
        self.assertIn("B recipe", buf.getvalue())
        self.assertIn("Not found in the scan", buf.getvalue())
        with open(path, "rb") as handle:
            self.assertEqual(handle.read(), before)


if __name__ == "__main__":
    unittest.main()
