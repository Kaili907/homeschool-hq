#!/usr/bin/env python3
"""Independent re-verification of every committed answer key.

This is a deliberately separate implementation of the computation algebra in
src/oracle.ts: different language, different numeric library (decimal.Decimal
rather than integer arithmetic in JS), written against the committed JSON
rather than against the authoring source. It reads only the scoring records,
re-evaluates each stored `computation`, and compares the result with the
stored `answer` string.

Agreement here means three independent derivations concur: the hand-authored
answer literal, the TypeScript oracle that gates the build, and this checker.
Any disagreement exits non-zero and names the item.

    python3 curriculum-production/student-work/financial-literacy-g38/tooling/crosscheck.py
"""
from __future__ import annotations

import json
import sys
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class CrossCheckError(Exception):
    pass


def _round_half_up(numerator: Decimal, denominator: Decimal) -> Decimal:
    """Half-up on the magnitude, matching the documented rounding rule."""
    if denominator == 0:
        raise CrossCheckError("division by zero")
    quotient = numerator / denominator
    return quotient.quantize(Decimal(1), rounding=ROUND_HALF_UP)


def _divide(numerator: Decimal, denominator: Decimal, rounding: str, label: str) -> Decimal:
    if denominator == 0:
        raise CrossCheckError(f"{label}: division by zero")
    if rounding == "exact":
        if numerator % denominator != 0:
            raise CrossCheckError(f"{label}: {numerator} / {denominator} is not exact")
        return numerator / denominator
    return _round_half_up(numerator, denominator)


def evaluate(spec: dict) -> tuple[str, Decimal | str]:
    """Returns (kind, value); money and count values are Decimals, labels are str."""
    op = spec["op"]
    if op == "money":
        return "money", Decimal(spec["cents"])
    if op == "count":
        return "count", Decimal(spec["n"])
    if op == "sum":
        parts = [evaluate(child) for child in spec["of"]]
        kinds = {kind for kind, _ in parts}
        if kinds not in ({"money"}, {"count"}):
            raise CrossCheckError("sum operands must share a kind")
        return kinds.pop(), sum((value for _, value in parts), Decimal(0))
    if op == "diff":
        left_kind, left = evaluate(spec["from"])
        right_kind, right = evaluate(spec["less"])
        if left_kind != right_kind:
            raise CrossCheckError("diff operands must share a kind")
        return left_kind, left - right
    if op == "scale":
        kind, value = evaluate(spec["of"])
        return kind, value * Decimal(spec["times"])
    if op == "percent":
        kind, value = evaluate(spec["of"])
        if kind != "money":
            raise CrossCheckError("percent requires money")
        return "money", _divide(value * Decimal(spec["bps"]), Decimal(10000), spec["round"], "percent")
    if op == "divide":
        kind, value = evaluate(spec["of"])
        return kind, _divide(value, Decimal(spec["by"]), spec["round"], "divide")
    if op == "compound":
        kind, value = evaluate(spec["principal"])
        if kind != "money":
            raise CrossCheckError("compound requires money")
        cents = value
        for _ in range(int(spec["periods"])):
            cents += _round_half_up(cents * Decimal(spec["bps"]), Decimal(10000))
        return "money", cents
    if op in ("min", "max"):
        parts = [evaluate(child) for child in spec["of"]]
        kinds = {kind for kind, _ in parts}
        if len(kinds) != 1:
            raise CrossCheckError(f"{op} operands must share a kind")
        values = [value for _, value in parts]
        return kinds.pop(), (min(values) if op == "min" else max(values))
    if op == "periodsToReach":
        _, target = evaluate(spec["target"])
        _, per = evaluate(spec["perPeriod"])
        if per <= 0:
            raise CrossCheckError("periodsToReach needs a positive per-period amount")
        # Decimal floor division truncates toward zero, so it cannot be used to
        # build a ceiling. Integer cents make the ceiling explicit instead.
        target_cents, per_cents = int(target), int(per)
        periods = target_cents // per_cents
        if target_cents % per_cents:
            periods += 1
        return "count", Decimal(periods)
    if op == "select":
        _, left = evaluate(spec["left"])
        _, right = evaluate(spec["right"])
        if left < right:
            return "label", spec["whenLess"]
        if left > right:
            return "label", spec["whenGreater"]
        return "label", spec["whenEqual"]
    raise CrossCheckError(f"unknown op: {op}")


def format_value(kind: str, value) -> str:
    if kind == "label":
        return value
    if kind == "count":
        return str(int(value))
    cents = int(value)
    sign = "-" if cents < 0 else ""
    magnitude = abs(cents)
    return f"{sign}${magnitude // 100:,}.{magnitude % 100:02d}"


def main() -> int:
    scoring_files = sorted((ROOT / "scoring").rglob("*.scoring.json"))
    if not scoring_files:
        print("no scoring records found", file=sys.stderr)
        return 1

    checked = 0
    rubric_records = 0
    failures: list[str] = []

    for path in scoring_files:
        record = json.loads(path.read_text())
        authority = record["scoringAuthority"]
        if authority["kind"] != "ANSWER_KEY":
            rubric_records += 1
            continue
        for item in authority["items"]:
            try:
                kind, value = evaluate(item["verification"]["computation"])
                formatted = format_value(kind, value)
            except CrossCheckError as err:
                failures.append(f"{record['packageId']} {item['ref']}: {err}")
                continue
            checked += 1
            if formatted != item["answer"]:
                failures.append(
                    f"{record['packageId']} {item['ref']}: committed answer {item['answer']!r} "
                    f"but independent recomputation gives {formatted!r}"
                )

    print(f"scoring records read: {len(scoring_files)} ({rubric_records} rubric, "
          f"{len(scoring_files) - rubric_records} answer key)")
    print(f"answer-key items independently recomputed: {checked}")
    print(f"disagreements: {len(failures)}")
    for failure in failures[:20]:
        print(f"  {failure}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
