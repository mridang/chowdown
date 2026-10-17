"""Tests for scan_bookmarks.py. Run: python3 -m unittest discover -s skills/import-bookmarked-recipes/scripts"""

import io
import json
import os
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout

import scan_bookmarks as sb


def category(title, url):
    return sb.classify(title, url)[0]


class ClassifyTests(unittest.TestCase):
    def test_recipe_on_a_known_recipe_site(self):
        self.assertEqual(category("Chicken Taco Pasta - The Clean Eating Couple",
                                  "https://www.thecleaneatingcouple.com/chicken-taco-pasta/"), "recipe")

    def test_recipe_found_from_the_address_when_the_title_is_useless(self):
        self.assertEqual(category("oni", "https://www.ethanchlebowski.com/cooking-techniques-recipes/keema-matar"),
                         "recipe")

    def test_accented_food_words_are_recognised(self):
        self.assertIn(category("Albóndigas Enchipotladas - YouTube", "https://www.youtube.com/watch?v=abc"),
                      ("recipe", "unsure"))
        self.assertEqual(sb.fold("Albóndigas"), "Albondigas")

    def test_front_pages_and_indexes_are_sites_not_recipes(self):
        self.assertEqual(category("Home | The Woks of Life", "https://thewoksoflife.com/"), "site")
        self.assertEqual(category("Mexican Recipes | 200+ Authentic Recipes", "https://example.com/recipes/"), "site")

    def test_videos_with_a_food_word_are_surfaced_for_the_user_to_decide(self):
        cat, _, reasons = sb.classify("You Want Fish That Bad! #Shorts - YouTube", "https://youtube.com/shorts/x")
        self.assertEqual(cat, "unsure")
        self.assertIn("video", reasons)

    def test_a_video_with_no_food_words_is_ignored(self):
        self.assertEqual(category("Keynote 2024 - YouTube", "https://youtube.com/watch?v=x"), "other")

    def test_tech_sites_are_never_recipes_even_with_food_words_in_the_address(self):
        self.assertEqual(category("3 Column Responsive Layout", "https://codepen.io/Cheesetoast/pen/KFAaq"), "other")
        self.assertEqual(category("How to Configure AWS S3 Event Notification with Lambda",
                                  "https://aws.amazon.com/blogs/x"), "other")

    def test_how_to_make_alone_is_not_enough(self):
        self.assertNotEqual(category("How to Make Other Developers Hate to Work with You",
                                     "https://anaxi.com/blog/2019/02/how-to-make-other-developers-hate"), "recipe")

    def test_shops_and_restaurants_do_not_count(self):
        self.assertEqual(category("Buy Artisanal Natural Cocktail Mixers Online - Bartisans", "https://bartisans.in/"),
                         "other")
        self.assertEqual(category("Madison - Tapiolan Diner - Madison Gastro & Wine", "https://ravintolamadison.fi/"),
                         "other")

    def test_non_web_links_are_ignored(self):
        self.assertEqual(category("Recipes", "javascript:void(0)"), "other")

    def test_instagram_redirects_are_unsure_because_the_target_is_unknown(self):
        self.assertEqual(category("x", "https://l.instagram.com/?u=http%3A%2F%2Fexample.com"), "unsure")


class HelperTests(unittest.TestCase):
    def test_chrome_timestamps_become_dates(self):
        # 13_400_000_000_000_000 µs after 1601-01-01 is in 2025.
        self.assertTrue(sb.webkit_to_iso("13400000000000000").startswith("2025"))
        self.assertEqual(sb.webkit_to_iso("not a number"), "")
        self.assertEqual(sb.webkit_to_iso(None), "")

    def test_host_drops_www_and_mobile_prefixes(self):
        self.assertEqual(sb.host_of("https://www.Example.com/x"), "example.com")
        self.assertEqual(sb.host_of("https://m.example.com/x"), "example.com")

    def test_subdomains_of_a_listed_host_match(self):
        self.assertTrue(sb.host_matches("docs.aws.amazon.com", sb.NON_RECIPE_HOSTS))
        self.assertFalse(sb.host_matches("notgithub.com", sb.NON_RECIPE_HOSTS))


FIXTURE = {
    "roots": {
        "bookmark_bar": {"type": "folder", "name": "Bookmarks bar", "children": []},
        "other": {"type": "folder", "name": "Other bookmarks", "children": [
            {"type": "url", "id": "1", "guid": "g1", "name": "Loose", "url": "https://a.com/x",
             "date_added": "13400000000000000"},
            {"type": "folder", "name": "Shopping", "children": [
                {"type": "folder", "name": "Shoes", "children": [
                    {"type": "url", "id": "2", "guid": "g2", "name": "Deep", "url": "https://b.com/y"}]}]},
        ]},
        "synced": {"type": "folder", "name": "Mobile Bookmarks", "children": [
            {"type": "url", "id": "3", "guid": "g3", "name": "Chicken Taco Pasta Recipe",
             "url": "https://www.thecleaneatingcouple.com/chicken-taco-pasta/"}]},
        "sync_transaction_version": "5",
    }
}


class ProfileTests(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.path = os.path.join(self.dir, "Bookmarks")
        with open(self.path, "w", encoding="utf-8") as handle:
            json.dump(FIXTURE, handle)

    def test_reads_every_folder_with_its_path_and_ignores_non_folder_roots(self):
        marks = {b["id"]: b for b in sb.read_bookmarks(self.dir)}
        self.assertEqual(set(marks), {"1", "2", "3"})
        self.assertEqual(marks["1"]["folder"], "Other bookmarks")
        self.assertEqual(marks["2"]["folder"], "Other bookmarks / Shopping / Shoes")
        self.assertEqual(marks["3"]["folder"], "Mobile Bookmarks")
        self.assertEqual(marks["3"]["guid"], "g3")

    def test_explicit_profile_is_used_when_it_has_a_bookmarks_file(self):
        self.assertEqual(list(sb.profile_dirs("all", self.dir)), [("custom", self.dir)])
        self.assertEqual(list(sb.profile_dirs("all", os.path.join(self.dir, "missing"))), [])

    def test_the_bookmarks_file_is_never_modified(self):
        with open(self.path, "rb") as handle:
            before = handle.read()
        with redirect_stdout(io.StringIO()):
            sb.main(["--profile", self.dir, "--json"])
        with open(self.path, "rb") as handle:
            self.assertEqual(handle.read(), before)

    def test_json_output_lists_the_recipe_with_its_location(self):
        buf = io.StringIO()
        with redirect_stdout(buf):
            self.assertEqual(sb.main(["--profile", self.dir, "--json"]), 0)
        data = json.loads(buf.getvalue())
        recipes = [b for b in data[0]["bookmarks"] if b["category"] == "recipe"]
        self.assertEqual([r["id"] for r in recipes], ["3"])
        self.assertEqual(recipes[0]["folder"], "Mobile Bookmarks")

    def test_ignored_links_are_left_out_by_guid_or_url(self):
        ignore = os.path.join(self.dir, "ignore.txt")
        with open(ignore, "w", encoding="utf-8") as handle:
            handle.write("# declined\ng3  # the taco pasta\n\n")
        buf = io.StringIO()
        with redirect_stdout(buf):
            sb.main(["--profile", self.dir, "--json", "--ignore", ignore])
        mark = {b["id"]: b for b in json.loads(buf.getvalue())[0]["bookmarks"]}["3"]
        self.assertEqual(mark["category"], "ignored")
        by_url = sb.scan(sb.read_bookmarks(self.dir), {"https://www.thecleaneatingcouple.com/chicken-taco-pasta/"})
        self.assertEqual({b["id"]: b["category"] for b in by_url}["3"], "ignored")

    def test_ignore_file_comments_and_blank_lines_are_skipped(self):
        ignore = os.path.join(self.dir, "ignore.txt")
        with open(ignore, "w", encoding="utf-8") as handle:
            handle.write("# only a comment\n\nguid-1\nhttps://x.com/a # trailing\n")
        self.assertEqual(sb.load_ignore(ignore), {"guid-1", "https://x.com/a"})

    def test_no_profile_found_is_reported_not_crashed(self):
        with redirect_stderr(io.StringIO()):
            self.assertEqual(sb.main(["--profile", os.path.join(self.dir, "nope")]), 2)


if __name__ == "__main__":
    unittest.main()
