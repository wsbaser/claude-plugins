import pathlib, sys, unittest
HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "scripts"))
from check_page import check

EXAMPLE = (HERE.parent / "assets" / "example-review-page.html").read_text(encoding="utf-8")


class CheckPage(unittest.TestCase):
    def test_worked_example_passes(self):
        self.assertEqual(check(EXAMPLE), [])

    def test_missing_pill_is_reported(self):
        page = EXAMPLE.replace('data-pill="7"', 'data-pill-x="7"', 1)
        self.assertTrue(any("issue 7" in p and "pill" in p for p in check(page)))

    def test_edited_script_is_reported(self):
        page = EXAMPLE.replace("'use strict';", "'use strict'; /* edited */", 1)
        self.assertTrue(any("review-page.js" in p for p in check(page)))

    def test_raw_lt_in_review_data_is_reported(self):
        head, _, tail = EXAMPLE.partition('id="review-data">')
        page = head + 'id="review-data">' + tail.replace('"title":', '"x": "<b>", "title":', 1)
        self.assertNotEqual(page, EXAMPLE)
        self.assertTrue(any("raw '<'" in p for p in check(page)))

    def test_extra_script_is_reported(self):
        page = EXAMPLE.replace('<script type="application/json"', "<script>console.log(1)</script><script type=\"application/json\"", 1)
        self.assertTrue(any("exactly one behaviour script" in p for p in check(page)))

    def test_hex_colour_in_page_css_is_reported(self):
        i = EXAMPLE.index("<style", EXAMPLE.index("</style>"))
        j = EXAMPLE.index(">", i) + 1
        page = EXAMPLE[:j] + ".x{color:#123456}" + EXAMPLE[j:]
        self.assertTrue(any("#123456" in p for p in check(page)))


if __name__ == "__main__":
    unittest.main()
