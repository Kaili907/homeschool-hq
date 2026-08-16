import json
import unittest
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def json_file(relative):
    return json.loads((ROOT / relative).read_text(encoding="utf-8"))


def jsonl(relative):
    return [json.loads(line) for line in (ROOT / relative).read_text(encoding="utf-8").splitlines() if line]


class FamilyPilotAdmittedReleaseTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.bindings = jsonl("production-bindings.jsonl")

    def test_exact_release_counts_and_supported_grades(self):
        manifest = json_file("MANIFEST.json")
        self.assertEqual(manifest["admissionStatus"], "ADMITTED")
        self.assertEqual(manifest["supportedGrades"], [3, 4, 5, 7, 8, 9, 10, 11, 12])
        self.assertEqual(
            manifest["counts"],
            {"grades": 9, "courses": 90, "units": 698, "lessons": 8292, "assessments": 699},
        )

    def test_every_structural_lesson_has_one_binding(self):
        refs = [item["lessonRef"] for item in self.bindings]
        self.assertEqual(len(refs), 8292)
        self.assertEqual(len(set(refs)), 8292)
        self.assertNotIn(6, {item["grade"] for item in self.bindings})

    def test_subject_specific_authority_is_preserved(self):
        dynamic = [item for item in self.bindings if item["sourceReadinessKind"] == "DYNAMIC_SOURCE_REQUIRED"]
        self.assertEqual(len(dynamic), 12)
        self.assertTrue(all(item["sourceRuntimeState"] == "PENDING_SOURCE_ATTACHMENT" for item in dynamic))
        guardian = [item for item in self.bindings if item["completionAuthority"] == "GUARDIAN_ATTESTATION_REQUIRED"]
        self.assertEqual(len(guardian), 81)
        self.assertTrue(all(item["learnerSelfReportCanCertify"] is False for item in guardian))
        hs_science = [item for item in self.bindings if item["subject"] == "science" and item["grade"] >= 9]
        self.assertTrue(all(item["sourceLineage"] == "hs912-science-h4" for item in hs_science))
        modes = Counter(
            item["scoringMetadata"]["responseScoringMode"]
            for item in self.bindings if item["subject"] == "financial-literacy"
        )
        self.assertEqual(modes, Counter({"MIXED": 468, "JUDGMENT_APPLICATION": 36}))

    def test_assessment_report_is_honest_and_usable(self):
        assessments = json_file("assessment-bindings.json")
        self.assertEqual(len(assessments), 699)
        self.assertEqual(Counter(item["state"] for item in assessments), Counter({"BOUND": 699}))
        self.assertFalse(any(item["normalFamilyUseStatus"] == "BLOCKED" for item in assessments))

    def test_negative_and_mutation_controls_pass(self):
        grade6 = json_file("admission/grade6-negative-control.json")
        self.assertFalse(grade6["admissible"])
        self.assertIn("RELEASE_GRADE_UNSUPPORTED", grade6["rejectionCodes"])
        mutations = json_file("validation/mutation-controls.json")
        self.assertEqual(mutations["overall"], "PASS")
        self.assertTrue(all(item["result"] == "DETECTED" for item in mutations["controls"]))

    def test_runtime_projection_is_browser_safe(self):
        compatibility = json_file("runtime/compatibility-validation.json")
        self.assertEqual(compatibility["status"], "PASS")
        self.assertEqual(compatibility["checks"]["lessons"], 8292)
        self.assertEqual(compatibility["checks"]["dynamicSourceRows"], 12)
        self.assertFalse(compatibility["checks"]["eagerManifestContainsLessonBody"])


if __name__ == "__main__":
    unittest.main()
