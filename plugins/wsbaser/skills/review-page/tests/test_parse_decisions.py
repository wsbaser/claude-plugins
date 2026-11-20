import copy, json, pathlib, sys, unittest
HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "scripts"))
from parse_decisions import parse, merge

TEXT = (HERE / "fixtures" / "decisions-round2.txt").read_text(encoding="utf-8")
def record():
    r = json.loads((HERE / "fixtures" / "review-round2.json").read_text(encoding="utf-8"))
    for i in r["issues"]:
        i["decision"] = {"by": None, "choice": None, "note": "", "status": "undecided"}
    return r

class Parse(unittest.TestCase):
    def test_header(self):
        p = parse(TEXT)
        self.assertEqual((p["review"], p["round"]), ("pr-2317-log-levels", 2))
        self.assertEqual(p["problems"], [])

    def test_each_status(self):
        i = parse(TEXT)["issues"]
        self.assertEqual(i["1"], {"status": "decided", "choice": "B", "note": "", "by": "owner"})
        self.assertEqual(i["2"]["status"], "undecided")
        self.assertEqual(i["3"], {"status": "decided", "choice": "accept", "note": "", "by": "agent"})
        self.assertEqual(i["4"], {"status": "disputed", "choice": "reject", "note": "Ops still wants these at Warning during the migration", "by": "owner"})

    def test_crlf_and_trailing_spaces(self):
        damaged = "\r\n".join(line + "  " for line in TEXT.splitlines())
        self.assertEqual(parse(damaged)["issues"], parse(TEXT)["issues"])

    def test_soft_wrapped_decision_line(self):
        wrapped = TEXT.replace("Error once in the transport, SyncSession", "Error once in the transport,\nSyncSession")
        self.assertEqual(parse(wrapped)["issues"]["1"]["choice"], "B")

    def test_title_with_brackets_and_dashes_does_not_confuse(self):
        t = TEXT.replace("Retry attempts are logged too loud", 'Retry [A] - "attempts" <loud>')
        self.assertEqual(parse(t)["issues"]["4"]["choice"], "reject")

    def test_half_paste_reports_missing_issues(self):
        half = "\n".join(TEXT.splitlines()[:6])
        m = merge(record(), parse(half))
        self.assertFalse(m["settled"])
        self.assertIn("3", m["undecided"]); self.assertIn("4", m["undecided"])
        self.assertTrue(any("3" in p for p in m["problems"]))

    def test_garbage_is_not_guessed(self):
        p = parse("looks good to me, go ahead")
        self.assertEqual(p["issues"], {})
        self.assertTrue(p["problems"])

class Merge(unittest.TestCase):
    def test_merge_writes_decisions(self):
        m = merge(record(), parse(TEXT))
        d = {i["id"]: i["decision"] for i in m["record"]["issues"]}
        self.assertEqual(d["1"]["choice"], "B"); self.assertEqual(d["4"]["status"], "disputed")
        self.assertEqual((m["settled"], m["undecided"], m["disputed"]), (False, ["2"], ["4"]))

    def test_unknown_choice_is_a_problem_and_stays_undecided(self):
        m = merge(record(), parse(TEXT.replace("[B] Error once", "[Z] Error once")))
        self.assertIn("1", m["undecided"]); self.assertTrue(any("issue 1" in p for p in m["problems"]))

    def test_wrong_review_id_is_refused(self):
        m = merge(record(), parse(TEXT.replace("pr-2317-log-levels", "other-review")))
        self.assertTrue(m["problems"]); self.assertEqual(len(m["undecided"]), 4)

    def test_all_decided_is_settled(self):
        t = TEXT.replace("   UNDECIDED. Agent recommends [C] Warning for one release, then Information.", "   Decision: [C] Warning for one release, then Information (owner confirmed)")
        t = t.replace("   DISPUTED: [reject] Reject (owner chose)", "   Decision: [accept] Accept - retry attempts go to Debug (owner chose)")
        self.assertTrue(merge(record(), parse(t))["settled"])

if __name__ == "__main__":
    unittest.main()
