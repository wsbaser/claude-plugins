import pathlib, sys, tempfile, unittest
sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "scripts"))
from check_slots import check_folder

class CheckSlots(unittest.TestCase):
    def write(self, d, name, text):
        (pathlib.Path(d) / name).write_text(text, encoding="utf-8")

    def test_good_file(self):
        with tempfile.TemporaryDirectory() as d:
            self.write(d, "ui-mockup.md", "---\nwhen: the option changes what a screen looks like\n---\n\nBody\n")
            self.assertEqual(check_folder(d), [])

    def test_missing_when(self):
        with tempfile.TemporaryDirectory() as d:
            self.write(d, "flow.md", "# Flow\n")
            self.assertTrue(any("flow.md" in e and "when" in e for e in check_folder(d)))

    def test_empty_when(self):
        with tempfile.TemporaryDirectory() as d:
            self.write(d, "flow.md", "---\nwhen:\n---\n")
            self.assertTrue(check_folder(d))

    def test_bad_file_name(self):
        with tempfile.TemporaryDirectory() as d:
            self.write(d, "UI Mockup.md", "---\nwhen: x\n---\n")
            self.assertTrue(any("kebab" in e for e in check_folder(d)))

    def test_empty_folder_is_an_error(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertTrue(check_folder(d))

if __name__ == "__main__":
    unittest.main()
