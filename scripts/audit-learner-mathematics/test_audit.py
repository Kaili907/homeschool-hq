#!/usr/bin/env python3
"""Tests for the Mathematics learner-completeness audit harness."""

from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path


HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("math_learner_audit", HERE / "audit.py")
assert SPEC and SPEC.loader
AUDIT = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = AUDIT
SPEC.loader.exec_module(AUDIT)
REPO = HERE.parents[1]
PATHS = AUDIT.AuditPaths.from_repo(REPO)


class AuditHarnessTests(unittest.TestCase):
    def test_negative_controls_all_detected(self) -> None:
        controls = AUDIT.run_negative_controls(PATHS)
        self.assertTrue(all(controls.values()), controls)

    def test_known_grade_3_day_1_defect(self) -> None:
        package = AUDIT.json_load(
            PATHS.packages / "grade-03/ma-g3-mathematics-u01-l01.package.json"
        )
        key = AUDIT.json_load(
            PATHS.keys / "grade-03/ma-g3-mathematics-u01-l01.key.json"
        )
        result = AUDIT.source_content_findings(package, key)
        self.assertIn("EMPTY_MASTERY_CHECK", result["findings"])
        self.assertIn("ZERO_ACTIONABLE_WORK", result["findings"])
        self.assertIn("STRATEGY_ONLY_DIAGNOSTIC", result["findings"])

    def test_projection_preserves_question_count_but_loses_semantics(self) -> None:
        package = AUDIT.json_load(
            PATHS.packages / "grade-05/ma-g5-mathematics-u01-l01.package.json"
        )
        result = AUDIT.browser_findings(package, AUDIT.project_package(package))
        self.assertTrue(result["source_browser_item_count_equal"])
        self.assertFalse(result["item_refs_survive_projection"])
        self.assertFalse(result["choices_remain_structured"])
        self.assertIn("FLATTENED_MULTIPLE_CHOICE", result["findings"])

    def test_full_audit_is_exhaustive(self) -> None:
        result = AUDIT.audit(PATHS)
        self.assertEqual(AUDIT.EXPECTED_LESSONS, len(result["lesson_records"]))
        self.assertEqual(AUDIT.GRADES, tuple(int(grade) for grade in result["grade_results"]))
        self.assertTrue(result["completeness"]["nine_grades_180_each"])
        self.assertEqual("28/28", result["grade8_standards"]["result"])
        self.assertTrue(result["reserve"]["all_inactive"])


if __name__ == "__main__":
    unittest.main()
