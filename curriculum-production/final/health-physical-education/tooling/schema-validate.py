#!/usr/bin/env python3
"""Validate every emitted Health/PE package and scoring guide."""

from json import load
from pathlib import Path

from jsonschema.validators import validator_for


ROOT = Path(__file__).resolve().parent.parent


def read_json(path: Path):
    with path.open(encoding="utf-8") as handle:
        return load(handle)


def validate_tree(schema_path: Path, tree: Path) -> tuple[int, list[str]]:
    schema = read_json(schema_path)
    validator_class = validator_for(schema)
    validator_class.check_schema(schema)
    validator = validator_class(schema)
    count = 0
    failures: list[str] = []
    for path in sorted(tree.rglob("*.json")):
        count += 1
        for error in sorted(validator.iter_errors(read_json(path)), key=lambda item: list(item.absolute_path)):
            location = ".".join(str(part) for part in error.absolute_path) or "<root>"
            failures.append(f"{path.relative_to(ROOT)}:{location}: {error.message}")
    return count, failures


def main() -> None:
    package_count, package_failures = validate_tree(
        ROOT / "schema" / "student-task-card.schema.json",
        ROOT / "packages",
    )
    scoring_count, scoring_failures = validate_tree(
        ROOT / "schema" / "scoring-guide.schema.json",
        ROOT / "scoring-guides",
    )
    failures = package_failures + scoring_failures
    if failures:
        raise SystemExit("\n".join(failures))
    print(f"Schema-valid: {package_count} packages + {scoring_count} scoring guides.")


if __name__ == "__main__":
    main()
