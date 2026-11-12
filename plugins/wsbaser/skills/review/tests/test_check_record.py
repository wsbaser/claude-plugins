import copy, json, pathlib, sys, unittest
HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "scripts"))
from check_record import validate

def load():
    return json.loads((HERE / "fixtures" / "review-round2.json").read_text(encoding="utf-8"))

class CheckRecord(unittest.TestCase):
    def test_fixture_is_valid_at_every_stage(self):
        for stage in ("intake", "decided", "ready"):
            self.assertEqual(validate(load(), stage), [], stage)

    def test_zero_issues_is_valid(self):
        r = load(); r["issues"] = []
        self.assertEqual(validate(r, "ready"), [])

    def test_duplicate_issue_id(self):
        r = load(); r["issues"][1]["id"] = "1"
        self.assertTrue(any("duplicate" in e for e in validate(r, "intake")))

    def test_recommendation_must_name_real_option(self):
        r = load(); r["issues"][0]["recommendation"]["option"] = "Z"
        self.assertTrue(any("issue 1" in e and "recommendation" in e for e in validate(r, "decided")))

    def test_recommending_a_dispute_option_is_rejected(self):
        r = load(); r["issues"][2]["recommendation"]["option"] = "reject"
        self.assertTrue(validate(r, "decided"))

    def test_no_recommendation_needs_owner(self):
        r = load(); r["issues"][0]["recommendation"] = None
        self.assertEqual(validate(r, "decided"), [])
        r["issues"][0]["needsOwner"] = False
        self.assertTrue(validate(r, "decided"))

    def test_buttons_mode_needs_exactly_one_real_option(self):
        r = load(); r["issues"][2]["options"][1].pop("dispute")
        self.assertTrue(any("buttons" in e for e in validate(r, "decided")))

    def test_dependency_on_missing_issue(self):
        r = load(); r["issues"][1]["dependsOn"]["issue"] = "9"
        self.assertTrue(any("issue 2" in e and "dependsOn" in e for e in validate(r, "decided")))

    def test_dependency_on_itself(self):
        r = load(); r["issues"][1]["dependsOn"]["issue"] = "2"
        self.assertTrue(validate(r, "decided"))

    def test_dependency_cycle(self):
        r = load()
        r["issues"][0]["dependsOn"] = {"issue": "2", "map": {"A": "A"}, "note": "x"}
        self.assertTrue(any("cycle" in e for e in validate(r, "decided")))

    def test_dependency_map_names_unknown_option(self):
        r = load(); r["issues"][1]["dependsOn"]["map"]["B"] = "Z"
        self.assertTrue(validate(r, "decided"))

    def test_short_fold_is_rejected(self):
        r = load()
        r["issues"][0]["explanation"].append({"form": "fold", "label": "Code", "size": "2 lines", "blocks": [{"form": "code", "text": "a\nb"}]})
        self.assertTrue(any("fold" in e for e in validate(r, "ready")))

    def test_long_fold_is_accepted(self):
        r = load()
        r["issues"][0]["explanation"].append({"form": "fold", "label": "Full diff", "size": "48 lines", "blocks": [{"form": "diff", "text": "x" * 700}]})
        self.assertEqual(validate(r, "ready"), [])

    def test_fold_without_size_label(self):
        r = load()
        r["issues"][0]["explanation"].append({"form": "fold", "label": "Full diff", "size": "", "blocks": [{"form": "diff", "text": "x" * 700}]})
        self.assertTrue(validate(r, "ready"))

    def test_origin_needs_verdict_reason(self):
        r = load(); r["issues"][0]["origin"]["verdictReason"] = ""
        self.assertTrue(validate(r, "decided"))

    def test_malformed_input_gives_errors_not_crashes(self):
        for bad in ([], {"schema": 1}, {"schema": 1, "review": [], "issues": [1, {"id": "1"}]}):
            for stage in ("intake", "decided", "ready"):
                self.assertTrue(validate(bad, stage), (bad, stage))

    def test_artifact_url_is_optional(self):
        r = load(); r["review"]["artifactUrl"] = "https://example.test/a"
        self.assertEqual(validate(r, "ready"), [])

    def test_agent_decision_needs_existing_choice(self):
        r = load(); r["issues"][2]["decision"]["choice"] = "nope"
        self.assertTrue(any("issue 3" in e and "decision" in e for e in validate(r, "decided")))

if __name__ == "__main__":
    unittest.main()
