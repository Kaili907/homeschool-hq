#!/usr/bin/env python3
"""Author the student-work packages and answer keys for the four 8.EE.2 days.

Answer authority
----------------
Every fixed answer is established twice on independent code paths:

  construction  the item is built from a chosen root (e.g. root=7 -> radicand 49)
                and the answer string is rendered from that root;
  oracle        `oracle()` recovers the answer from the item's recorded `given`
                parameters alone, using integer search and exact rational
                arithmetic, without seeing the construction root.

Generation raises if the two disagree. The strength of that gate differs by item
kind, and is stated rather than overclaimed:

  - For the item types in EXACT_MATCH the oracle's output must EQUAL the keyed
    option and must select exactly one option, so the gate pins the answer index.
    A wrong value or a mis-keyed index cannot reach the corpus.
  - For prose items the option states a classification plus a reason. The oracle
    verifies the classification and the mathematical invariant the answer asserts
    (sign behaviour under squaring/cubing, perfect-power membership); it cannot
    judge a reason. `validate.py` covers that gap by requiring every distractor
    that states the same classification to carry a stated invalid reason.

Emits into student-work/ in this directory, in the shipped
curriculum-production/student-work/mathematics schema.

Usage: python3 build_student_work.py   (from this directory)
"""
import json
import math
import os
from fractions import Fraction

HERE = os.path.dirname(os.path.abspath(__file__))
PKG = os.path.join(HERE, "student-work", "packages", "grade-08")
KEY = os.path.join(HERE, "student-work", "answer-keys", "grade-08")
CORPUS_VERSION = "1.0.1-correction"
ITEM_SOURCE = "integration-correction-generator@curriculum-release-corrections/grade8-mathematics-integration/build_student_work.py"
ORACLE = "build_student_work.py#oracle"


# --------------------------------------------------------------------------
# Oracle: recovers each answer from `given` alone. Independent of construction.
# --------------------------------------------------------------------------
def _isqrt_exact(n):
    r = math.isqrt(n)
    return r if r * r == n else None


def _icbrt_exact(n):
    sign = -1 if n < 0 else 1
    m = abs(n)
    r = round(m ** (1 / 3))
    for cand in (r - 1, r, r + 1):
        if cand >= 0 and cand ** 3 == m:
            return sign * cand
    return None


def _frac(num, den):
    return str(Fraction(num, den))


def _between(n, index):
    """Consecutive whole numbers bounding an inexact root, from n alone."""
    lo = 0
    while (lo + 1) ** index <= n:
        lo += 1
    assert lo ** index != n, "radicand is an exact perfect power"
    return f"between {lo} and {lo + 1}"


def oracle(item_type, given):
    """Recompute the authoritative answer tokens from the item's parameters only.

    Returns a list of strings. Every token must appear verbatim in the keyed
    answer; `emit` asserts that, so a construction/oracle disagreement raises.
    """
    g = given
    if item_type == "solve-x-squared-equals-p":
        r = _isqrt_exact(g["p"]); assert r is not None
        return [f"x = {r} or x = \u2212{r}"]
    if item_type == "solve-x-cubed-equals-p":
        r = _icbrt_exact(g["p"]); assert r is not None
        return [f"x = {r}"]
    if item_type == "count-real-solutions":
        return ["2" if g["exponent"] % 2 == 0 else "1"]
    if item_type == "write-exact-solutions-nonperfect":
        assert _isqrt_exact(g["p"]) is None
        return [f"x = \u221a{g['p']} or x = \u2212\u221a{g['p']}"]
    if item_type == "write-exact-solution-cube-nonperfect":
        assert _icbrt_exact(g["p"]) is None
        return [f"x = \u221b{g['p']}"]
    if item_type == "solve-x-squared-rational":
        a, b = _isqrt_exact(g["num"]), _isqrt_exact(g["den"]); assert a is not None and b is not None
        f = Fraction(a, b)
        return [f"x = {f} or x = \u2212{f}"]
    if item_type == "exact-versus-approximate":
        assert _isqrt_exact(g["p"]) is None
        return [f"x = \u221a{g['p']} or x = \u2212\u221a{g['p']}"]
    if item_type == "evaluate-perfect-square-root":
        r = _isqrt_exact(g["radicand"]); assert r is not None
        return [str(r)]
    if item_type == "evaluate-perfect-cube-root":
        r = _icbrt_exact(g["radicand"]); assert r is not None
        return [str(r)]
    if item_type == "evaluate-rational-square-root":
        a, b = _isqrt_exact(g["num"]), _isqrt_exact(g["den"]); assert a is not None and b is not None
        return [_frac(a, b)]
    if item_type == "evaluate-rational-cube-root":
        a, b = _icbrt_exact(g["num"]), _icbrt_exact(g["den"]); assert a is not None and b is not None
        return [_frac(a, b)]
    if item_type == "has-exact-whole-number-root":
        n, idx = g["radicand"], g["index"]
        r = _isqrt_exact(n) if idx == 2 else _icbrt_exact(n)
        sym = "square" if idx == 2 else "cube"
        return [f"Yes, {r}"] if r is not None else [f"No \u2014 {n} is not a perfect {sym}"]
    if item_type == "classify-root-rational-or-irrational":
        n = g["radicand"]; r = _isqrt_exact(n)
        return ["Rational", f"\u221a{n} = {r}"] if r is not None else ["Irrational", str(n)]
    if item_type == "classify-cube-root":
        n = g["radicand"]; r = _icbrt_exact(n)
        return ["Rational", f"\u221b{n} = {r}"] if r is not None else ["Irrational", str(n)]
    if item_type == "decimal-expansion-of-irrational":
        assert _isqrt_exact(g["radicand"]) is None
        return ["never terminates and never repeats"]
    if item_type == "ratio-of-integers-test":
        n = g["radicand"]; assert _isqrt_exact(n) is None
        return [f"(a/b)\u00b2 = {n}"]
    if item_type == "bounding-perfect-powers":
        return [_between(g["radicand"], g["index"])]
    if item_type == "exact-side-length-from-area":
        a = g["area"]; r = _isqrt_exact(a)
        return [str(r)] if r is not None else [f"\u221a{a}"]
    if item_type == "exact-edge-length-from-volume":
        v = g["volume"]; r = _icbrt_exact(v)
        return [str(r)] if r is not None else [f"\u221b{v}"]
    if item_type == "sign-behaviour-invariant":
        hi = g["checked_to"]
        assert all((-r) ** 2 == r ** 2 for r in range(1, hi + 1))
        assert all((-r) ** 3 != r ** 3 for r in range(1, hi + 1))
        return ["\u221ap and \u2212\u221ap", "\u221bp"]
    if item_type == "assessment-exact-solutions":
        out = []
        for p in g["squares"]:
            r = _isqrt_exact(p)
            out.append(f"x = {r} or x = \u2212{r}" if r is not None
                       else f"x = \u221a{p} or x = \u2212\u221a{p}")
        for p in g["cubes"]:
            r = _icbrt_exact(p)
            out.append(f"x = {r}" if r is not None else f"x = \u221b{p}")
        return out
    if item_type == "assessment-evaluate-roots":
        n = g["square_radicand"]; r = _isqrt_exact(n); assert r is not None
        sn, sd = g["rational_square"]; a, b = _isqrt_exact(sn), _isqrt_exact(sd)
        assert a is not None and b is not None
        cn = g["cube_radicand"]; c = _icbrt_exact(cn); assert c is not None
        qn, qd = g["rational_cube"]; d, e = _icbrt_exact(qn), _icbrt_exact(qd)
        assert d is not None and e is not None
        return [f"\u221a{n} = {r}", f"\u221a({sn}/{sd}) = {_frac(a, b)}",
                f"\u221b{cn} = {c}", f"\u221b({qn}/{qd}) = {_frac(d, e)}"]
    if item_type == "assessment-bounding":
        return [f"\u221a{g['square_radicand']} lies {_between(g['square_radicand'], 2)}",
                f"\u221b{g['cube_radicand']} lies {_between(g['cube_radicand'], 3)}"]
    if item_type == "assessment-irrationality":
        n = g["irrational_radicand"]; assert _isqrt_exact(n) is None
        m = g["rational_radicand"]; r = _isqrt_exact(m); assert r is not None
        return [f"\u221a{n} is irrational", f"\u221a{m} = {r}"]
    if item_type == "assessment-error-analysis":
        p = g["square_p"]; r = _isqrt_exact(p); assert r is not None
        n = g["negative_cube_radicand"]; c = _icbrt_exact(n)
        assert c is not None and n < 0
        return [f"x = {r} or x = \u2212{r}", f"\u221b(\u2212{abs(n)}) = \u2212{abs(c)}"]
    if item_type == "assessment-transfer-area":
        a = g["area"]; assert _isqrt_exact(a) is None
        return [f"\u221a{a}"]
    raise KeyError(item_type)


# --------------------------------------------------------------------------
# Authored teaching examples, one per item type (a DIFFERENT problem).
# --------------------------------------------------------------------------
REF = {
    "solve-x-squared-equals-p": ("Solve x² = 36 exactly.",
        ["x² = 36 asks which number multiplied by itself gives 36.",
         "For positive p, x² = p has two real solutions, x = √p and x = −√p.",
         "√36 = 6, and (−6)² = 36 as well."], "x = 6 or x = −6"),
    "solve-x-cubed-equals-p": ("Solve x³ = 8 exactly.",
        ["x³ = 8 asks which number multiplied by itself three times gives 8.",
         "Cubing keeps a number's sign, so only one real number cubes to 8.",
         "∛8 = 2 because 2³ = 8."], "x = 2"),
    "count-real-solutions": ("How many real solutions does x² = 5 have?",
        ["The exponent is even, so a positive and a negative value both square to 5.",
         "x = √5 and x = −√5."], "2"),
    "write-exact-solutions-nonperfect": ("Write the exact solutions of x² = 7.",
        ["7 is not a perfect square, so the solutions cannot be written as whole numbers.",
         "Root notation names them exactly: x = √7 and x = −√7."], "x = √7 or x = −√7"),
    "write-exact-solution-cube-nonperfect": ("Write the exact solution of x³ = 6.",
        ["6 is not a perfect cube, so the solution is not a whole number.",
         "Cubing keeps the sign, so there is exactly one real solution: x = ∛6."], "x = ∛6"),
    "solve-x-squared-rational": ("Solve x² = 4/9 exactly.",
        ["Take the root of numerator and denominator separately: √4 = 2 and √9 = 3.",
         "Both 2/3 and −2/3 square to 4/9."], "x = 2/3 or x = −2/3"),
    "exact-versus-approximate": ("x² = 30. Which form is exact?",
        ["30 is not a perfect square, so no whole number or terminating decimal is exact.",
         "5.48 is a rounded value; √30 names the length with no error."],
        "x = √30 or x = −√30"),
    "evaluate-perfect-square-root": ("Evaluate √144 exactly.",
        ["Look for a whole number whose square is 144.", "12² = 144."], "12"),
    "evaluate-perfect-cube-root": ("Evaluate ∛343 exactly.",
        ["Look for a whole number whose cube is 343.", "7³ = 343."], "7"),
    "evaluate-rational-square-root": ("Evaluate √(9/25) exactly.",
        ["√9 = 3 and √25 = 5.", "So the value is 3/5, and (3/5)² = 9/25."], "3/5"),
    "evaluate-rational-cube-root": ("Evaluate ∛(8/27) exactly.",
        ["∛8 = 2 and ∛27 = 3.", "So the value is 2/3, and (2/3)³ = 8/27."], "2/3"),
    "has-exact-whole-number-root": ("Does √90 have an exact whole-number value?",
        ["81 = 9² and 100 = 10², and 81 < 90 < 100.",
         "90 sits strictly between two consecutive perfect squares, so it is not one."],
        "No — 90 is not a perfect square"),
    "classify-root-rational-or-irrational": ("Classify √50.",
        ["49 = 7² and 64 = 8², and 49 < 50 < 64, so 50 is not a perfect square.",
         "A square root of a whole number that is not a perfect square cannot be written as a ratio of integers."],
        "Irrational, √50"),
    "classify-cube-root": ("Classify ∛125.",
        ["5³ = 125, so ∛125 = 5.", "5 = 5/1 is a ratio of integers."], "Rational, ∛125 = 5"),
    "bounding-perfect-powers": ("Between which two consecutive whole numbers does √73 lie?",
        ["8² = 64 and 9² = 81.", "64 < 73 < 81."], "between 8 and 9"),
    "exact-side-length-from-area": ("A square has area 18 square units. Give the exact side length.",
        ["A side s satisfies s² = 18, and a length is positive, so s = √18.",
         "18 is not a perfect square, so √18 is the exact form."], "s = √18"),
    "exact-edge-length-from-volume": ("A cube has volume 64 cubic units. Give the exact edge length.",
        ["An edge e satisfies e³ = 64.", "4³ = 64, so e = 4."], "e = 4"),
    "sign-behaviour-invariant": ("Why does x² = 9 have two solutions but x³ = 27 only one?",
        ["Squaring destroys sign information: 3² and (−3)² are both 9.",
         "Cubing preserves sign: 3³ = 27 but (−3)³ = −27."], "two-for-even-one-for-odd"),
    "count-real-solutions@odd": ("How many real solutions does x³ = 5 have?",
        ["The exponent is odd, so cubing preserves sign and no negative number cubes to a positive value.",
         "Only x = ∛5 works."], "1"),
    "has-exact-whole-number-root@yes": ("Does ∛125 have an exact whole-number value?",
        ["Look for a whole number whose cube is 125.", "5³ = 125."], "Yes, 5"),
    "classify-root-rational-or-irrational@rational": ("Classify √64.",
        ["64 is a perfect square: 8² = 64, so √64 = 8.",
         "8 = 8/1 is a ratio of integers."], "Rational, √64 = 8"),
    "classify-cube-root@irrational": ("Classify ∛30.",
        ["3³ = 27 and 4³ = 64, and 27 < 30 < 64, so 30 is not a perfect cube.",
         "A cube root of a whole number that is not a perfect cube is not a ratio of integers."],
        "Irrational, ∛30"),
    "exact-side-length-from-area@perfect": ("A square has area 49 square units. Give the exact side length.",
        ["A side s satisfies s² = 49 and a length is positive.", "7² = 49, so s = 7."], "s = 7"),
    "exact-edge-length-from-volume@inexact": ("A cube has volume 20 cubic units. Give the exact edge length.",
        ["An edge e satisfies e³ = 20.", "2³ = 8 and 3³ = 27, so 20 is not a perfect cube.",
         "Root notation names it exactly: e = ∛20."], "e = ∛20"),
    "decimal-expansion-of-irrational": ("What kind of decimal expansion does √3 have?",
        ["3 is not a perfect square, so √3 is not a ratio of two integers.",
         "A number that is not a ratio of integers has a decimal expansion that never terminates and never repeats."],
        "never terminates and never repeats"),
    "ratio-of-integers-test": ("What single finding would show that √3 is not irrational?",
        ["Irrational means: not expressible as a ratio of two integers.",
         "So exhibiting whole numbers a and b, b ≠ 0, with (a/b)² = 3 would settle it."],
        "(a/b)² = 3"),
    "assessment-exact-solutions": ("Write the exact solutions of x² = 16 and x³ = 64.",
        ["4² = 16 and (−4)² = 16, so x² = 16 has two solutions.",
         "4³ = 64 and cubing preserves sign, so x³ = 64 has one."],
        "x = 4 or x = −4; x = 4"),
    "assessment-evaluate-roots": ("Evaluate √100, √(9/25), ∛8 and ∛(1/8) exactly.",
        ["Root numerator and denominator separately for the fractions.",
         "Check each with the inverse operation."],
        "√100 = 10; √(9/25) = 3/5; ∛8 = 2; ∛(1/8) = 1/2"),
    "assessment-bounding": ("Between which whole numbers do √30 and ∛30 lie?",
        ["25 < 30 < 36, so √30 lies between 5 and 6.",
         "27 < 30 < 64, so ∛30 lies between 3 and 4."],
        "√30 lies between 5 and 6; ∛30 lies between 3 and 4"),
    "assessment-irrationality": ("Why is √3 irrational but √25 rational?",
        ["3 is not a perfect square, so √3 is no ratio of integers and its expansion never repeats.",
         "25 = 5², so √25 = 5 = 5/1."],
        "√3 is irrational; √25 = 5"),
    "assessment-error-analysis": ("Correct: “x² = 9, so x = 3” and “∛(−8) is undefined”.",
        ["(−3)² = 9 as well, so x = 3 or x = −3.",
         "Cube roots keep sign, so ∛(−8) = −2."],
        "x = 3 or x = −3; ∛(−8) = −2"),
    "assessment-transfer-area": ("A square covers 12 square feet. Give the exact side length.",
        ["s² = 12 and a length is positive, so s = √12.",
         "12 is not a perfect square, so √12 is the exact form."],
        "s = √12"),
    "negative-cube-root-defined": ("Evaluate ∛(−8).",
        ["Cubing keeps the sign, so a negative number has a real cube root.",
         "(−2)³ = −8."], "-2"),
}

DIRECTIONS = {
    "instructional-example": "Use these examples as the model for the work below.",
    "guided-practice": "Work these with your teaching parent. Say the reason for each step out loud before you write it.",
    "independent-practice": "Work these on your own. Report exact values wherever an exact value exists.",
    "mastery-check": "Work these with no support. Show enough that someone else could check each step.",
}

CR_EXPECTATION = "Give the result and the reasoning that produced it. Show enough work that someone else could check each step."


def _subcase(item_type, given):
    """Sub-case key so a reference example never demonstrates the opposite case."""
    if item_type == "count-real-solutions" and given["exponent"] % 2 == 1:
        return "count-real-solutions@odd"
    if item_type == "has-exact-whole-number-root":
        n, idx = given["radicand"], given["index"]
        r = _isqrt_exact(n) if idx == 2 else _icbrt_exact(n)
        if r is not None:
            return "has-exact-whole-number-root@yes"
    if item_type == "classify-root-rational-or-irrational" and _isqrt_exact(given["radicand"]) is not None:
        return "classify-root-rational-or-irrational@rational"
    if item_type == "classify-cube-root" and _icbrt_exact(given["radicand"]) is None:
        return "classify-cube-root@irrational"
    if item_type == "exact-side-length-from-area" and _isqrt_exact(given["area"]) is not None:
        return "exact-side-length-from-area@perfect"
    if item_type == "exact-edge-length-from-volume" and _icbrt_exact(given["volume"]) is None:
        return "exact-edge-length-from-volume@inexact"
    return item_type


def ref_for(item_type, given):
    prompt, steps, answer = REF[_subcase(item_type, given)]
    return {"prompt": prompt, "steps": steps, "answer": answer}


def _bounds(n, index):
    lo = 0
    while (lo + 1) ** index <= n:
        lo += 1
    return lo, lo + 1


def steps_for(item_type, given, answer):
    """Worked derivation for THIS item, using THIS item's numbers."""
    g = given
    if item_type in ("solve-x-squared-equals-p", "exact-versus-approximate"):
        p = g["p"]; r = _isqrt_exact(p)
        if r is not None:
            return [f"x² = {p} asks which number multiplied by itself gives {p}.",
                    f"{r}² = {p}, and (−{r})² = {p} as well, because squaring destroys the sign.",
                    f"So the two real solutions are x = {r} and x = −{r}."]
        lo, hi = _bounds(p, 2)
        return [f"{lo}² = {lo * lo} and {hi}² = {hi * hi}, and {lo * lo} < {p} < {hi * hi}, "
                f"so {p} is not a perfect square.",
                f"No whole number or terminating decimal squares to {p} exactly, so any decimal is a rounding.",
                f"Root notation names both solutions with no error: x = √{p} and x = −√{p}."]
    if item_type == "write-exact-solutions-nonperfect":
        p = g["p"]; lo, hi = _bounds(p, 2)
        return [f"{lo}² = {lo * lo} and {hi}² = {hi * hi}, and {lo * lo} < {p} < {hi * hi}, "
                f"so {p} is not a perfect square.",
                f"The solutions therefore have no whole-number form.",
                f"Both are named exactly by root notation: x = √{p} and x = −√{p}."]
    if item_type == "solve-x-cubed-equals-p":
        p = g["p"]; r = _icbrt_exact(p)
        return [f"x³ = {p} asks which number multiplied by itself three times gives {p}.",
                f"{r}³ = {p}, while (−{r})³ = −{p}: cubing keeps the sign.",
                f"So there is one real solution, x = {r}."]
    if item_type == "write-exact-solution-cube-nonperfect":
        p = g["p"]; lo, hi = _bounds(p, 3)
        return [f"{lo}³ = {lo ** 3} and {hi}³ = {hi ** 3}, and {lo ** 3} < {p} < {hi ** 3}, "
                f"so {p} is not a perfect cube.",
                "Cubing keeps the sign, so there is exactly one real solution.",
                f"Root notation names it exactly: x = ∛{p}."]
    if item_type == "count-real-solutions":
        p, e = g["p"], g["exponent"]
        if e % 2 == 0:
            return [f"The exponent is even, so a number and its opposite have the same {e}th power.",
                    f"Both √{p} and −√{p} satisfy x² = {p}.",
                    "So there are 2 real solutions."]
        return [f"The exponent is odd, so cubing keeps the sign of the number.",
                f"No negative number cubes to the positive value {p}.",
                f"Only x = ∛{p} works, so there is 1 real solution."]
    if item_type == "solve-x-squared-rational":
        a, b = _isqrt_exact(g["num"]), _isqrt_exact(g["den"])
        f = Fraction(a, b)
        return [f"√{g['num']} = {a} and √{g['den']} = {b}, so root the numerator and denominator separately.",
                f"({f})² = {g['num']}/{g['den']}, and (−{f})² gives the same.",
                f"So x = {f} or x = −{f}."]
    if item_type == "evaluate-perfect-square-root":
        n = g["radicand"]; r = _isqrt_exact(n)
        return [f"Look for a whole number whose square is {n}.",
                f"{r}² = {r * r}.",
                f"The radical names the non-negative root, so √{n} = {r}."]
    if item_type == "evaluate-perfect-cube-root":
        n = g["radicand"]; r = _icbrt_exact(n)
        return [f"Look for a whole number whose cube is {n}.",
                f"{r}³ = {r ** 3}.",
                f"So ∛{n} = {r}."]
    if item_type == "evaluate-rational-square-root":
        a, b = _isqrt_exact(g["num"]), _isqrt_exact(g["den"])
        return [f"√{g['num']} = {a} and √{g['den']} = {b}.",
                f"So √({g['num']}/{g['den']}) = {_frac(a, b)}.",
                f"Check by squaring: ({_frac(a, b)})² = {g['num']}/{g['den']}."]
    if item_type == "evaluate-rational-cube-root":
        a, b = _icbrt_exact(g["num"]), _icbrt_exact(g["den"])
        return [f"∛{g['num']} = {a} and ∛{g['den']} = {b}.",
                f"So ∛({g['num']}/{g['den']}) = {_frac(a, b)}.",
                f"Check by cubing: ({_frac(a, b)})³ = {g['num']}/{g['den']}."]
    if item_type == "has-exact-whole-number-root":
        n, idx = g["radicand"], g["index"]
        r = _isqrt_exact(n) if idx == 2 else _icbrt_exact(n)
        word, sym = ("square", "√") if idx == 2 else ("cube", "∛")
        if r is not None:
            return [f"Look for a whole number whose {word} is {n}.",
                    f"{r}{'²' if idx == 2 else '³'} = {n}, so {n} is a perfect {word}.",
                    f"So {sym}{n} = {r} exactly."]
        lo, hi = _bounds(n, idx)
        mark = "²" if idx == 2 else "³"
        return [f"{lo}{mark} = {lo ** idx} and {hi}{mark} = {hi ** idx}.",
                f"{lo ** idx} < {n} < {hi ** idx}, so {n} sits strictly between consecutive perfect {word}s.",
                f"So {sym}{n} lies strictly between {lo} and {hi} and is not a whole number."]
    if item_type in ("classify-root-rational-or-irrational", "classify-cube-root"):
        n = g["radicand"]
        idx = 2 if item_type == "classify-root-rational-or-irrational" else 3
        r = _isqrt_exact(n) if idx == 2 else _icbrt_exact(n)
        sym, mark, word = ("√", "²", "square") if idx == 2 else ("∛", "³", "cube")
        if r is not None:
            return [f"{r}{mark} = {n}, so {n} is a perfect {word} and {sym}{n} = {r}.",
                    f"{r} = {r}/1 is a ratio of two integers, and its decimal expansion terminates.",
                    "So the value is rational."]
        lo, hi = _bounds(n, idx)
        return [f"{lo}{mark} = {lo ** idx} and {hi}{mark} = {hi ** idx}, and {lo ** idx} < {n} < {hi ** idx}, "
                f"so {n} is not a perfect {word}.",
                f"{sym}{n} therefore cannot be written as a ratio of two integers.",
                "Its decimal expansion never terminates and never repeats, so the value is irrational."]
    if item_type == "decimal-expansion-of-irrational":
        n = g["radicand"]; lo, hi = _bounds(n, 2)
        return [f"{lo}² = {lo * lo} and {hi}² = {hi * hi}, and {lo * lo} < {n} < {hi * hi}, "
                f"so {n} is not a perfect square and √{n} is irrational.",
                "A terminating or repeating expansion is exactly what a ratio of integers produces.",
                "So the expansion of an irrational number never terminates and never repeats."]
    if item_type == "ratio-of-integers-test":
        n = g["radicand"]
        return ["Irrational means one thing: not expressible as a ratio of two integers.",
                f"So the only finding that would overturn it is whole numbers a and b, b ≠ 0, with (a/b)² = {n}.",
                "Any number of accurate decimal places leaves the question open, because accuracy is not exactness."]
    if item_type == "exact-side-length-from-area":
        a = g["area"]; r = _isqrt_exact(a)
        if r is not None:
            return [f"A side s satisfies s² = {a}, and a length is positive.",
                    f"{r}² = {a}, so s = {r}."]
        lo, hi = _bounds(a, 2)
        return [f"A side s satisfies s² = {a}, and a length is positive, so s = √{a}.",
                f"{lo}² = {lo * lo} and {hi}² = {hi * hi}, and {lo * lo} < {a} < {hi * hi}, "
                f"so √{a} lies strictly between {lo} and {hi} and is not a whole number.",
                f"√{a} is therefore the exact form; any decimal is a rounding of it."]
    if item_type == "exact-edge-length-from-volume":
        v = g["volume"]; r = _icbrt_exact(v)
        if r is not None:
            return [f"An edge e satisfies e³ = {v}.",
                    f"{r}³ = {v}, so e = {r} exactly."]
        lo, hi = _bounds(v, 3)
        return [f"An edge e satisfies e³ = {v}, so e = ∛{v}.",
                f"{lo}³ = {lo ** 3} and {hi}³ = {hi ** 3}, and {lo ** 3} < {v} < {hi ** 3}.",
                f"So ∛{v} lies strictly between {lo} and {hi} and is not a whole number."]
    return None


# For these item types the keyed option is exactly the oracle's output, so the gate
# pins the answer INDEX, not merely the value. The remainder are prose items whose
# option states a classification plus a reason; there the oracle can verify only the
# classification, and `validate.py` separately requires every same-classification
# distractor to carry a stated invalid reason.
EXACT_MATCH = {
    "solve-x-squared-equals-p", "solve-x-cubed-equals-p", "count-real-solutions",
    "write-exact-solutions-nonperfect", "write-exact-solution-cube-nonperfect",
    "solve-x-squared-rational", "exact-versus-approximate",
    "evaluate-perfect-square-root", "evaluate-perfect-cube-root",
    "evaluate-rational-square-root", "evaluate-rational-cube-root",
    "has-exact-whole-number-root",
}


def _agree(ref, item_type, tokens, answer, choices=None):
    """Construction/oracle agreement gate. A disagreement stops generation."""
    if item_type in EXACT_MATCH:
        if len(tokens) != 1 or tokens[0] != answer:
            raise AssertionError(
                f"{ref}: oracle recomputed {tokens!r} from the item parameters, but the keyed "
                f"option is {answer!r}")
        if choices is not None and sum(1 for c in choices if c == tokens[0]) != 1:
            raise AssertionError(f"{ref}: oracle output does not select exactly one option")
        return
    missing = [t for t in tokens if t not in answer]
    if missing:
        raise AssertionError(
            f"{ref}: oracle recomputed {tokens!r} from the item parameters, but the keyed "
            f"answer {answer!r} does not contain {missing!r}")


def mc(ref, item_type, standard, difficulty, prompt, choices, answer_index, given, errors=None):
    return {
        "spec": "mc", "ref": ref, "itemType": item_type, "standard": standard,
        "difficulty": difficulty, "prompt": prompt, "choices": choices,
        "answerIndex": answer_index, "given": given, "errors": errors or {},
    }


def cr(ref, item_type, standard, difficulty, prompt, answer, given, steps, errors=None):
    return {
        "spec": "cr", "ref": ref, "itemType": item_type, "standard": standard,
        "difficulty": difficulty, "prompt": prompt, "answer": answer,
        "given": given, "steps": steps, "errors": errors or {},
    }


def ex(ref, item_type, difficulty, prompt, steps, answer, standard="8.EE.2"):
    return {"spec": "ex", "ref": ref, "itemType": item_type, "standard": standard,
            "difficulty": difficulty, "prompt": prompt, "steps": steps, "answer": answer}


L = "ma-g8-mathematics-u01-l"


# --------------------------------------------------------------------------
# Lesson 19 — root symbols as exact solutions
# --------------------------------------------------------------------------
L19 = {
    "lessonId": f"{L}19", "dayInUnit": 19, "courseDay": 19,
    "unitTitle": "Real Numbers and Irrational Numbers",
    "phase": "Concept model — correction block",
    "focus": "root symbols as exact solutions",
    "title": "Square and cube roots as solutions to x² = p and x³ = p",
    "profile": "concept-model-correction",
    "sections": [
        ("ex", "instructional-example", "Instructional examples", [
            ex(f"{L}19#ex-01", "solve-x-squared-equals-p", 1,
               "Solve x² = 36. Write the exact solution or solutions using root notation.",
               ["x² = 36 asks which number multiplied by itself gives 36.",
                "For a positive p, x² = p has two real solutions: x = √p and x = −√p.",
                "√36 = 6 because 6² = 36, and (−6)² = 36 as well."],
               "x = 6 or x = −6"),
            ex(f"{L}19#ex-02", "solve-x-cubed-equals-p", 1,
               "Solve x³ = 8. Write the exact solution using root notation.",
               ["x³ = 8 asks which number multiplied by itself three times gives 8.",
                "Cubing keeps the sign of a number, so only one real number cubes to 8.",
                "∛8 = 2 because 2³ = 8."],
               "x = 2"),
        ]),
        ("gp", "guided-practice", "Guided practice", [
            mc(f"{L}19#gp-01", "solve-x-squared-equals-p", "8.EE.2", 1,
               "Write the complete exact solution of x² = 49.",
               ["x = 7", "x = 7 or x = −7", "x = −7", "x = 49/2"], 1, {"p": 49},
               {"x = 7": "Only the non-negative root was reported; (−7)² is also 49.",
                "x = −7": "Only the negative root was reported.",
                "x = 49/2": "The equation was read as 2x = 49 rather than x·x = 49."}),
            mc(f"{L}19#gp-02", "solve-x-cubed-equals-p", "8.EE.2", 1,
               "Write the complete exact solution of x³ = 125.",
               ["x = 5 or x = −5", "x = ∛5", "x = 5", "x = 125/3"], 2, {"p": 125},
               {"x = 5 or x = −5": "The two-solution rule for even exponents was applied to an odd exponent; (−5)³ = −125.",
                "x = ∛5": "The radicand and the equation's right side were swapped.",
                "x = 125/3": "The equation was read as 3x = 125."}),
            mc(f"{L}19#gp-03", "count-real-solutions", "8.EE.2", 1,
               "How many real solutions does x² = 11 have?",
               ["0", "1", "2", "infinitely many"], 2, {"exponent": 2, "p": 11},
               {"0": "A non-perfect-square right side was read as having no solution; √11 and −√11 are still real.",
                "1": "The negative solution was overlooked.",
                "infinitely many": "The equation was read as an identity."}),
            mc(f"{L}19#gp-04", "write-exact-solutions-nonperfect", "8.EE.2", 2,
               "Write the exact solutions of x² = 11 using root notation.",
               ["x = √11 or x = −√11", "x = √11", "x = 11/2", "x is about 3.32"], 0, {"p": 11},
               {"x = √11": "Only the non-negative root was reported.",
                "x = 11/2": "The equation was read as 2x = 11.",
                "x is about 3.32": "An approximation was given where an exact form was asked for."}),
        ]),
        ("ip", "independent-practice", "Independent practice", [
            mc(f"{L}19#ip-01", "solve-x-squared-equals-p", "8.EE.2", 1,
               "Write the complete exact solution of x² = 81.",
               ["x = 9 or x = −9", "x = 9", "x = −9", "x = 40.5"], 0, {"p": 81},
               {"x = 9": "Only the non-negative root was reported.",
                "x = −9": "Only the negative root was reported.",
                "x = 40.5": "The equation was read as 2x = 81."}),
            mc(f"{L}19#ip-02", "solve-x-cubed-equals-p", "8.EE.2", 1,
               "Write the complete exact solution of x³ = 27.",
               ["x = 3 or x = −3", "x = 3", "x = ∛3", "x = 9"], 1, {"p": 27},
               {"x = 3 or x = −3": "The even-exponent rule was applied to a cube; (−3)³ = −27.",
                "x = ∛3": "The radicand and the right side were swapped.",
                "x = 9": "27 was divided by 3 instead of a cube root being taken."}),
            mc(f"{L}19#ip-03", "write-exact-solutions-nonperfect", "8.EE.2", 2,
               "Write the exact solutions of x² = 23 using root notation.",
               ["x = 23/2", "x = √23 or x = −√23", "x is about 4.80", "x = √23"], 1, {"p": 23},
               {"x = 23/2": "The equation was read as 2x = 23.",
                "x is about 4.80": "An approximation was given where an exact form was asked for.",
                "x = √23": "Only the non-negative root was reported."}),
            mc(f"{L}19#ip-04", "write-exact-solution-cube-nonperfect", "8.EE.2", 2,
               "Write the exact solution of x³ = 10 using root notation.",
               ["x = ∛10 or x = −∛10", "x = 10/3", "x = ∛10", "x is about 2.15"], 2, {"p": 10},
               {"x = ∛10 or x = −∛10": "A second solution was added; cubing preserves sign, so only one real value cubes to 10.",
                "x = 10/3": "The equation was read as 3x = 10.",
                "x is about 2.15": "An approximation was given where an exact form was asked for."}),
            mc(f"{L}19#ip-05", "count-real-solutions", "8.EE.2", 1,
               "How many real solutions does x³ = 5 have?",
               ["1", "2", "0", "3"], 0, {"exponent": 3, "p": 5},
               {"2": "The even-exponent rule was applied to a cube.",
                "0": "A non-perfect-cube right side was read as having no solution.",
                "3": "The exponent was mistaken for the number of solutions."}),
            mc(f"{L}19#ip-06", "solve-x-squared-rational", "8.EE.2", 2,
               "Write the complete exact solution of x² = 9/16.",
               ["x = 3/4", "x = 3/4 or x = −3/4", "x = 9/8", "x = 81/256"], 1,
               {"num": 9, "den": 16},
               {"x = 3/4": "Only the non-negative root was reported.",
                "x = 9/8": "The fraction was halved instead of its numerator and denominator being rooted.",
                "x = 81/256": "The fraction was squared instead of rooted."}),
        ]),
        ("mc", "mastery-check", "Mastery check", [
            mc(f"{L}19#mc-01", "exact-versus-approximate", "8.EE.2", 3,
               "x² = 20. Which line gives the exact solutions rather than an approximation?",
               ["x = 4.47 or x = −4.47", "x = 10 or x = −10",
                "x = √20 or x = −√20", "x = 400 or x = −400"], 2, {"p": 20},
               {"x = 4.47 or x = −4.47": "A rounded value was accepted as exact; 4.47² = 19.9809, not 20.",
                "x = 10 or x = −10": "The equation was read as 2x = 20 rather than x·x = 20.",
                "x = 400 or x = −400": "The radicand was squared instead of rooted."}),
            mc(f"{L}19#mc-02", "count-real-solutions", "8.EE.2", 2,
               "How many real solutions does x² = 7 have?",
               ["2", "1", "0", "infinitely many"], 0, {"exponent": 2, "p": 7},
               {"1": "The negative solution was overlooked.",
                "0": "A non-perfect-square right side was read as having no solution.",
                "infinitely many": "The equation was read as an identity."}),
            cr(f"{L}19#mc-03", "sign-behaviour-invariant", "8.EE.2", 3,
               "For a positive rational p, x² = p has two real solutions but x³ = p has only one. Explain why, using what squaring and cubing do to the sign of a number.",
               "Squaring a negative number gives a positive result, so √p and −√p both satisfy x² = p; cubing a negative number gives a negative result, so for positive p only ∛p satisfies x³ = p.",
               {"checked_to": 50},
               ["Square any whole number and its opposite: 7² = 49 and (−7)² = 49. Squaring destroys the sign, so two different numbers share one square.",
                "Cube any whole number and its opposite: 7³ = 343 but (−7)³ = −343. Cubing keeps the sign, so no negative number cubes to a positive result.",
                "Checked over every whole number from 1 to 50: r² = (−r)² in all 50 cases, and r³ ≠ (−r)³ in all 50 cases."],
               {"“x² = p has one solution”": "The negative root was overlooked; squaring maps two numbers to the same value.",
                "“x³ = p has two solutions”": "The even-exponent rule was over-generalised to odd exponents."}),
        ]),
    ],
}

# --------------------------------------------------------------------------
# Lesson 20 — evaluating small perfect squares and perfect cubes
# --------------------------------------------------------------------------
L20 = {
    "lessonId": f"{L}20", "dayInUnit": 20, "courseDay": 20,
    "unitTitle": "Real Numbers and Irrational Numbers",
    "phase": "Guided and independent practice — correction block",
    "focus": "exact roots of perfect squares and perfect cubes",
    "title": "Evaluating small perfect squares and perfect cubes",
    "profile": "guided-practice-correction",
    "sections": [
        ("ex", "instructional-example", "Instructional examples", [
            ex(f"{L}20#ex-01", "evaluate-perfect-square-root", 1,
               "Evaluate √144 exactly.",
               ["Look for a whole number whose square is 144.",
                "12² = 144.",
                "So √144 = 12. The radical symbol names the non-negative root."], "12"),
            ex(f"{L}20#ex-02", "evaluate-perfect-cube-root", 1,
               "Evaluate ∛343 exactly.",
               ["Look for a whole number whose cube is 343.",
                "7³ = 343.",
                "So ∛343 = 7."], "7"),
        ]),
        ("gp", "guided-practice", "Guided practice", [
            mc(f"{L}20#gp-01", "evaluate-perfect-square-root", "8.EE.2", 1,
               "Evaluate √169 exactly.", ["13", "12", "14", "84.5"], 0, {"radicand": 169},
               {"12": "The nearest smaller perfect square was reported; 12² = 144.",
                "14": "The nearest larger perfect square was reported; 14² = 196.",
                "84.5": "The radicand was halved instead of rooted."}),
            mc(f"{L}20#gp-02", "evaluate-perfect-cube-root", "8.EE.2", 1,
               "Evaluate ∛216 exactly.", ["8", "6", "7", "72"], 1, {"radicand": 216},
               {"8": "A neighbouring perfect cube was reported; 8³ = 512.",
                "7": "A neighbouring perfect cube was reported; 7³ = 343.",
                "72": "The radicand was divided by 3 instead of rooted."}),
            mc(f"{L}20#gp-03", "evaluate-rational-square-root", "8.EE.2", 2,
               "Evaluate √(16/49) exactly.", ["8/49", "4/49", "4/7", "16/7"], 2,
               {"num": 16, "den": 49},
               {"8/49": "The numerator was halved and the denominator left alone.",
                "4/49": "Only the numerator was rooted.",
                "16/7": "Only the denominator was rooted."}),
            mc(f"{L}20#gp-04", "evaluate-rational-cube-root", "8.EE.2", 2,
               "Evaluate ∛(1/27) exactly.", ["1/3", "1/9", "1/27", "3"], 0,
               {"num": 1, "den": 27},
               {"1/9": "The denominator was divided by 3 instead of cube-rooted.",
                "1/27": "No root was taken.",
                "3": "The fraction was inverted after rooting."}),
        ]),
        ("ip", "independent-practice", "Independent practice", [
            mc(f"{L}20#ip-01", "evaluate-perfect-square-root", "8.EE.2", 1,
               "Evaluate √225 exactly.", ["15", "25", "14", "112.5"], 0, {"radicand": 225},
               {"25": "A digit of the radicand was read as the root.",
                "14": "A neighbouring perfect square was reported; 14² = 196.",
                "112.5": "The radicand was halved instead of rooted."}),
            mc(f"{L}20#ip-02", "evaluate-perfect-square-root", "8.EE.2", 1,
               "Evaluate √400 exactly.", ["200", "20", "40", "21"], 1, {"radicand": 400},
               {"200": "The radicand was halved instead of rooted.",
                "40": "The root of 1600 was reported.",
                "21": "A neighbouring value was reported; 21² = 441."}),
            mc(f"{L}20#ip-03", "evaluate-perfect-cube-root", "8.EE.2", 2,
               "Evaluate ∛512 exactly.", ["6", "7", "9", "8"], 3, {"radicand": 512},
               {"6": "A neighbouring perfect cube was reported; 6³ = 216.",
                "7": "A neighbouring perfect cube was reported; 7³ = 343.",
                "9": "A neighbouring perfect cube was reported; 9³ = 729."}),
            mc(f"{L}20#ip-04", "evaluate-perfect-cube-root", "8.EE.2", 1,
               "Evaluate ∛1000 exactly.", ["10", "100", "30", "1000"], 0, {"radicand": 1000},
               {"100": "A square root was taken instead of a cube root.",
                "30": "The square root of 900 was reported; 30³ = 27000, not 1000.",
                "1000": "No root was taken."}),
            mc(f"{L}20#ip-05", "evaluate-rational-square-root", "8.EE.2", 2,
               "Evaluate √(25/81) exactly.", ["5/9", "25/9", "5/81", "50/81"], 0,
               {"num": 25, "den": 81},
               {"25/9": "Only the denominator was rooted.",
                "5/81": "Only the numerator was rooted.",
                "50/81": "The numerator was doubled instead of rooted."}),
            mc(f"{L}20#ip-06", "evaluate-rational-cube-root", "8.EE.2", 2,
               "Evaluate ∛(8/125) exactly.", ["4/25", "2/5", "8/5", "2/25"], 1,
               {"num": 8, "den": 125},
               {"4/25": "The square root of 16/625 was reported; (4/25)³ = 64/15625, not 8/125.",
                "8/5": "Only the denominator was rooted.",
                "2/25": "The numerator was cube-rooted but the denominator was divided by 5."}),
            mc(f"{L}20#ip-07", "has-exact-whole-number-root", "8.EE.2", 2,
               "Does √150 have an exact whole-number value? Choose the correct statement.",
               ["Yes, 15", "Yes, 12", "No — 150 is not a perfect square",
                "No — only cube roots can have exact whole-number values"], 2,
               {"radicand": 150, "index": 2},
               {"Yes, 15": "15² = 225, not 150.",
                "Yes, 12": "12² = 144, not 150.",
                "No — only cube roots can have exact whole-number values":
                    "A true conclusion was reached from a false rule; √144 = 12 is exact."}),
            mc(f"{L}20#ip-08", "has-exact-whole-number-root", "8.EE.2", 2,
               "Does ∛64 have an exact whole-number value? Choose the correct statement.",
               ["No — 64 is not a perfect cube", "Yes, 8", "Yes, 4", "Yes, 16"], 2,
               {"radicand": 64, "index": 3},
               {"No — 64 is not a perfect cube": "4³ = 64, so 64 is a perfect cube.",
                "Yes, 8": "The square root of 64 was reported instead of the cube root.",
                "Yes, 16": "64 was divided by 4 instead of cube-rooted."}),
        ]),
        ("mc", "mastery-check", "Mastery check", [
            mc(f"{L}20#mc-01", "evaluate-perfect-square-root", "8.EE.2", 2,
               "Evaluate √196 exactly.", ["16", "14", "98", "13"], 1, {"radicand": 196},
               {"16": "16² = 256, not 196.",
                "98": "The radicand was halved instead of rooted.",
                "13": "13² = 169, not 196."}),
            mc(f"{L}20#mc-02", "evaluate-perfect-cube-root", "8.EE.2", 3,
               "Evaluate ∛729 exactly.", ["9", "27", "81", "243"], 0, {"radicand": 729},
               {"27": "A square root was taken instead of a cube root.",
                "81": "The radicand was divided by 9 instead of cube-rooted.",
                "243": "The radicand was divided by 3 instead of cube-rooted."}),
            cr(f"{L}20#mc-03", "bounding-perfect-powers", "8.EE.2", 3,
               "√81 and √80 look almost the same. One has an exact whole-number value and one does not. Say which is which, give the exact value where there is one, and explain how you can tell without a calculator.",
               "√81 = 9 exactly; √80 lies between 8 and 9 and has no exact whole-number value.",
               {"radicand": 80, "index": 2},
               ["81 is a perfect square: 9² = 81, so √81 = 9 exactly.",
                "80 is not: the perfect squares on either side are 8² = 64 and 9² = 81, and 64 < 80 < 81.",
                "So √80 lies strictly between 8 and 9 and cannot be a whole number."],
               {"“√80 = 8.9”": "A rounded value was reported as exact.",
                "“both are exact”": "Nearness to a perfect square was mistaken for being one."}),
        ]),
    ],
}

# --------------------------------------------------------------------------
# Lesson 21 — √2 is irrational; consolidation and transfer
# --------------------------------------------------------------------------
L21 = {
    "lessonId": f"{L}21", "dayInUnit": 21, "courseDay": 21,
    "unitTitle": "Real Numbers and Irrational Numbers",
    "phase": "Consolidation and transfer — correction block",
    "focus": "irrationality of √2 and transfer of root reasoning",
    "title": "Knowing that √2 is irrational, and consolidating root reasoning",
    "profile": "consolidation-transfer-correction",
    "sections": [
        ("ex", "instructional-example", "Instructional examples", [
            ex(f"{L}21#ex-01", "classify-root-rational-or-irrational", 2,
               "Classify √49 and √50 as rational or irrational.",
               ["49 is a perfect square: 7² = 49, so √49 = 7, which is the ratio 7/1. It is rational.",
                "50 is not a perfect square: 7² = 49 and 8² = 64, so √50 lies strictly between 7 and 8.",
                "A square root of a whole number that is not a perfect square cannot be written as a ratio of two integers, so √50 is irrational."],
               "√49 is rational; √50 is irrational"),
            ex(f"{L}21#ex-02", "exact-side-length-from-area", 2,
               "A square has area 18 square units. Give its exact side length and classify it.",
               ["A side s satisfies s² = 18, and a length is positive, so s = √18.",
                "18 is not a perfect square: 16 < 18 < 25, so √18 lies strictly between 4 and 5.",
                "√18 is irrational. A rounded value such as 4.24 is an approximation, not the exact length."],
               "s = √18, irrational"),
        ]),
        ("gp", "guided-practice", "Guided practice", [
            mc(f"{L}21#gp-01", "classify-root-rational-or-irrational", "8.EE.2", 1,
               "Classify √36 and give the reason.",
               ["Rational, because 36 is a perfect square and √36 = 6 = 6/1",
                "Irrational, because it is written with a radical symbol",
                "Rational, because 36 is an even number",
                "Irrational, because 6 is not a fraction"], 0, {"radicand": 36},
               {"Irrational, because it is written with a radical symbol":
                    "The notation was taken as the classification; the radicand decides it.",
                "Rational, because 36 is an even number": "Parity has nothing to do with rationality.",
                "Irrational, because 6 is not a fraction": "6 = 6/1 is a ratio of integers."}),
            mc(f"{L}21#gp-02", "classify-root-rational-or-irrational", "8.EE.2", 2,
               "Classify √2 and give the reason.",
               ["Rational, because √2 is about 1.41",
                "Irrational, because 2 is not a perfect square and the decimal expansion of √2 never terminates and never repeats",
                "Rational, because 2 is a whole number",
                "Irrational, because 2 is an even number"], 1, {"radicand": 2},
               {"Rational, because √2 is about 1.41": "A rounding was mistaken for the value itself.",
                "Rational, because 2 is a whole number": "The radicand being whole does not make its root whole.",
                "Irrational, because 2 is an even number": "Parity has nothing to do with rationality; √4 and √16 have even radicands and are rational."}),
            mc(f"{L}21#gp-03", "decimal-expansion-of-irrational", "8.EE.2", 2,
               "Which statement about the decimal expansion of √2 is correct?",
               ["It terminates after several digits",
                "It repeats a fixed block of digits forever",
                "It never terminates and never repeats",
                "It has no decimal expansion at all"], 2, {"radicand": 2},
               {"It terminates after several digits": "A calculator display was mistaken for the whole expansion.",
                "It repeats a fixed block of digits forever": "That describes a rational number.",
                "It has no decimal expansion at all": "Every real number has a decimal expansion; √2's is non-repeating."}),
            mc(f"{L}21#gp-04", "ratio-of-integers-test", "8.EE.2", 3,
               "Which single fact, if someone found it, would show that √2 is NOT irrational?",
               ["Whole numbers a and b, with b ≠ 0, satisfying (a/b)² = 2",
                "A decimal approximation of √2 accurate to twenty places",
                "A calculation showing 1.41² is close to 2",
                "An argument showing √2 lies between 1 and 2"], 0, {"radicand": 2},
               {"A decimal approximation of √2 accurate to twenty places": "Accuracy is not exactness.",
                "A calculation showing 1.41² is close to 2": "Closeness is not equality.",
                "An argument showing √2 lies between 1 and 2": "Both rational and irrational numbers live in that interval."}),
        ]),
        ("ip", "independent-practice", "Independent practice", [
            mc(f"{L}21#ip-01", "classify-root-rational-or-irrational", "8.EE.2", 1,
               "Classify √121 and give the reason.",
               ["Irrational, because it is a square root",
                "Rational, because 11² = 121, so √121 = 11",
                "Rational, because 121 is an odd number",
                "Irrational, because 121 is greater than 100"], 1, {"radicand": 121},
               {"Irrational, because it is a square root": "The notation was taken as the classification.",
                "Rational, because 121 is an odd number": "Parity has nothing to do with rationality.",
                "Irrational, because 121 is greater than 100": "Size has nothing to do with rationality."}),
            mc(f"{L}21#ip-02", "classify-root-rational-or-irrational", "8.EE.2", 2,
               "Classify √120 and give the reason.",
               ["Rational, because 120 is a whole number",
                "Rational, because √120 is about 10.95",
                "Irrational, because 120 lies strictly between the perfect squares 100 and 121",
                "Irrational, because 120 is an even number"], 2, {"radicand": 120},
               {"Rational, because 120 is a whole number": "The radicand being whole does not make its root whole.",
                "Rational, because √120 is about 10.95": "A rounding was mistaken for the value itself.",
                "Irrational, because 120 is an even number": "A true conclusion from an irrelevant reason; √4 is even and rational."}),
            mc(f"{L}21#ip-03", "classify-cube-root", "8.EE.2", 2,
               "Classify ∛64 and give the reason.",
               ["Rational, because 4³ = 64, so ∛64 = 4",
                "Irrational, because it is written with a radical symbol",
                "Rational, because 64 is a perfect square",
                "Irrational, because 64 is an even number"], 0, {"radicand": 64},
               {"Irrational, because it is written with a radical symbol": "The notation was taken as the classification.",
                "Rational, because 64 is a perfect square": "A true conclusion from the wrong reason; the cube root needs 64 to be a perfect cube, which it also is.",
                "Irrational, because 64 is an even number": "Parity has nothing to do with rationality."}),
            mc(f"{L}21#ip-04", "exact-side-length-from-area", "8.EE.2", 2,
               "A square garden bed must enclose exactly 20 square feet. What is the exact side length?",
               ["s = 5 feet", "s = √20 feet", "s = 10 feet", "s = 4.5 feet"], 1, {"area": 20},
               {"s = 5 feet": "5² = 25, not 20.",
                "s = 10 feet": "The area was halved instead of rooted.",
                "s = 4.5 feet": "A rounded value was reported where an exact value was asked for."}),
            mc(f"{L}21#ip-05", "exact-edge-length-from-volume", "8.EE.2", 2,
               "A cube-shaped box has volume exactly 27 cubic inches. What is the exact edge length?",
               ["9 inches", "3 inches", "∛9 inches", "1.7 inches"], 1, {"volume": 27},
               {"9 inches": "The volume was divided by 3 instead of cube-rooted.",
                "∛9 inches": "The volume was divided by 3 before rooting.",
                "1.7 inches": "A rounding of ∛5 was reported; it does not cube to 27."}),
            mc(f"{L}21#ip-06", "exact-side-length-from-area", "8.EE.2", 3,
               "For that 20-square-foot bed, which statement about exact and rounded forms is correct?",
               ["√20 feet is exact; a rounded value such as 4.5 feet is what a saw cut can realise",
                "4.5 feet is exact; √20 feet is the approximation",
                "Both forms are exact",
                "Neither form is exact"], 0, {"area": 20},
               {"4.5 feet is exact; √20 feet is the approximation": "The two roles were swapped.",
                "Both forms are exact": "4.5² = 20.25, not 20.",
                "Neither form is exact": "√20 names the length with no error."}),
        ]),
        ("mc", "mastery-check", "Mastery check", [
            mc(f"{L}21#mc-01", "classify-root-rational-or-irrational", "8.EE.2", 3,
               "Is √2 rational or irrational, and why?",
               ["Rational — every square root can be written as a fraction",
                "Irrational — 2 is not a perfect square, so √2 cannot be written as a ratio of two integers",
                "Rational — √2 is 1.414",
                "Irrational — √2 is greater than 1"], 1, {"radicand": 2},
               {"Rational — every square root can be written as a fraction": "√4 can; √2 cannot.",
                "Rational — √2 is 1.414": "A rounding was mistaken for the value itself.",
                "Irrational — √2 is greater than 1": "A true conclusion from an irrelevant reason; 3/2 is greater than 1 and rational."}),
            mc(f"{L}21#mc-02", "classify-root-rational-or-irrational", "8.EE.2", 2,
               "Is √49 rational or irrational, and why?",
               ["Irrational — it is written with a radical symbol",
                "Rational — 49 is a perfect square, so √49 = 7 = 7/1",
                "Irrational — 7 is an odd number",
                "Rational — 49 is an odd number"], 1, {"radicand": 49},
               {"Irrational — it is written with a radical symbol": "The notation was taken as the classification.",
                "Irrational — 7 is an odd number": "Parity has nothing to do with rationality.",
                "Rational — 49 is an odd number": "A true conclusion from an irrelevant reason."}),
            cr(f"{L}21#mc-03", "exact-side-length-from-area", "8.EE.2", 3,
               "A square patio must cover exactly 32 square feet. Give the exact side length in root notation, classify it as rational or irrational with a reason, and explain why a builder would still work from a rounded value.",
               "s = √32 feet, irrational.",
               {"area": 32},
               ["A side s satisfies s² = 32, and a length is positive, so s = √32 feet.",
                "32 is not a perfect square: 5² = 25 and 6² = 36, and 25 < 32 < 36, so √32 lies strictly between 5 and 6 and cannot be written as a ratio of two integers. It is irrational.",
                "A saw cut cannot realise a non-terminating decimal, so a builder measures a rounded value such as 5.7 feet; √32 remains the exact length the rounding stands in for."],
               {"“s = 16 feet”": "The area was halved instead of rooted.",
                "“s = 5.7 feet, rational”": "A rounded value was classified in place of the exact one."}),
        ]),
    ],
}

# --------------------------------------------------------------------------
# Lesson 22 — correction assessment day (renders the accepted c01 instrument)
# --------------------------------------------------------------------------
L22 = {
    "lessonId": f"{L}22", "dayInUnit": 22, "courseDay": 22,
    "unitTitle": "Real Numbers and Irrational Numbers",
    "phase": "Correction assessment",
    "focus": "independent mastery evidence for 8.EE.2",
    "title": "Correction assessment: exact roots, evaluation, and irrationality",
    "profile": "correction-assessment",
    "sections": [
        ("a", "mastery-check",
         "ma-g8-mathematics-c01-assessment — 30 points, 6 prompts", [
            cr(f"{L}22#a-01", "assessment-exact-solutions", "8.EE.2", 2,
               "Write the exact solution or solutions of each equation using root notation: x² = 49, x² = 11, x³ = 27, x³ = 5. For each, state how many real solutions the equation has and why. (6 points)",
               "x = 7 or x = −7 (two real solutions); x = √11 or x = −√11 (two); x = 3 (one); x = ∛5 (one).",
               {"squares": [49, 11], "cubes": [27, 5]},
               ["x² = 49: 7² = 49 and (−7)² = 49, so x = 7 or x = −7 — two real solutions.",
                "x² = 11: 11 is not a perfect square, so the exact solutions are x = √11 and x = −√11 — two real solutions.",
                "x³ = 27: 3³ = 27, and cubing preserves sign, so x = 3 — one real solution.",
                "x³ = 5: 5 is not a perfect cube, so the exact solution is x = ∛5 — one real solution."],
               {"“x² = 49, so x = 7”": "Only the non-negative root was reported.",
                "“x³ = 27, so x = 3 or x = −3”": "The even-exponent rule was applied to a cube."}),
            cr(f"{L}22#a-02", "assessment-evaluate-roots", "8.EE.2", 2,
               "Evaluate exactly, without a calculator: √121, √(16/49), ∛64, ∛(1/27). Verify two of your four answers using the inverse operation and show that verification. (6 points)",
               "√121 = 11; √(16/49) = 4/7; ∛64 = 4; ∛(1/27) = 1/3.",
               {"square_radicand": 121, "rational_square": [16, 49], "cube_radicand": 64, "rational_cube": [1, 27]},
               ["√121 = 11 because 11² = 121.",
                "√(16/49) = 4/7 because √16 = 4 and √49 = 7, and (4/7)² = 16/49.",
                "∛64 = 4 because 4³ = 64.",
                "∛(1/27) = 1/3 because (1/3)³ = 1/27.",
                "Any two of those inverse-operation checks satisfy the verification requirement."],
               {"“∛64 = 8”": "The square root was taken instead of the cube root.",
                "“√(16/49) = 16/7”": "Only the denominator was rooted."}),
            cr(f"{L}22#a-03", "assessment-bounding", "8.EE.2", 3,
               "For √45 and ∛50, state the two consecutive whole numbers each value lies between and explain how you know without a calculator. Then explain why neither can be written as an exact whole number. (5 points)",
               "√45 lies between 6 and 7; ∛50 lies between 3 and 4.",
               {"square_radicand": 45, "cube_radicand": 50},
               ["6² = 36 and 7² = 49, and 36 < 45 < 49, so √45 lies strictly between 6 and 7.",
                "3³ = 27 and 4³ = 64, and 27 < 50 < 64, so ∛50 lies strictly between 3 and 4.",
                "Each radicand sits strictly between two consecutive perfect powers, so neither is a perfect power and neither root is a whole number."],
               {"“√45 = 6.7, so it is between 6.7 and 7”": "A rounding was used in place of the bounding perfect squares.",
                "“∛50 is between 7 and 8”": "Square-root bounds were used for a cube root."}),
            cr(f"{L}22#a-04", "assessment-irrationality", "8.EE.2", 3,
               "Explain why √2 is irrational but √49 is rational. Give a reason rather than an assertion; reference the decimal expansion, the ratio-of-integers definition, or the informal contradiction argument. (5 points)",
               "√2 is irrational; √49 = 7 is rational.",
               {"irrational_radicand": 2, "rational_radicand": 49},
               ["2 is not a perfect square — 1² = 1 and 2² = 4, and 1 < 2 < 4 — so √2 is not a whole number.",
                "√2 cannot be written as a ratio of two integers, and its decimal expansion neither terminates nor repeats; both are ways of saying it is irrational.",
                "49 is a perfect square: 7² = 49, so √49 = 7, which is the ratio 7/1 and a terminating decimal. It is rational.",
                "The formal contradiction proof is not required at this grade; a stated reason is."],
               {"“√2 is rational because it equals 1.414”": "A rounding was mistaken for the value.",
                "“all square roots are irrational”": "√49 is a counterexample."}),
            cr(f"{L}22#a-05", "assessment-error-analysis", "8.EE.2", 3,
               "A learner writes: “x² = 25, so x = 5,” and “∛(−27) has no real solution because you cannot take a root of a negative.” Identify what is wrong with each statement, correct it, and explain why the error is tempting. (4 points)",
               "x = 5 or x = −5; ∛(−27) = −3.",
               {"square_p": 25, "negative_cube_radicand": -27},
               ["The first statement drops a solution: (−5)² = 25 as well, so x = 5 or x = −5. It is tempting because √25 alone names only the non-negative root.",
                "The second over-generalises a true rule about even indices. There is no real square root of a negative number, but cube roots keep sign, so ∛(−27) = −3 because (−3)³ = −27.",
                "Checked directly: (−3)³ = −27."],
               {"“∛(−27) = 3”": "The sign was dropped; 3³ = 27, not −27.",
                "“x² = 25 has no negative solution”": "The negative root was overlooked."}),
            cr(f"{L}22#a-06", "assessment-transfer-area", "8.EE.2", 3,
               "A square garden bed must enclose 20 square feet. Give the exact side length in root notation, classify it as rational or irrational with a reason, give an approximation appropriate for buying lumber, and explain why the exact and rounded forms are each correct for their own purpose. (4 points)",
               "s = √20 feet, irrational; about 4.5 feet for lumber.",
               {"area": 20},
               ["A side s satisfies s² = 20 and a length is positive, so s = √20 feet.",
                "20 is not a perfect square — 16 < 20 < 25 — so √20 lies strictly between 4 and 5 and is irrational.",
                "About 4.5 feet is a sensible lumber approximation, since 4.5² = 20.25.",
                "The exact form names the length with no error; the rounded form is what a measurable cut can realise. Each is correct for its own purpose."],
               {"“s = 10 feet”": "The area was halved instead of rooted.",
                "“4.5 feet is the exact side length”": "A rounding was reported as exact."}),
         ]),
    ],
}

LESSONS = [L19, L20, L21, L22]

SCORING = ("Score the stated learning target, accuracy, evidence/reasoning, and revision. "
           "Accept multiple valid approaches when they meet the criteria. Do not infer effort, "
           "motivation, diagnosis, or character from an error.")
MASTERY = ("Do not mark 8.EE.2 mastered from one answer. Require accurate independent evidence "
           "and successful transfer or retrieval on at least two occasions when feasible.")


def emit(lesson):
    lid = lesson["lessonId"]
    sections, answers = [], []
    for sid, kind, title, items in lesson["sections"]:
        out_items = []
        for it in items:
            if it["spec"] == "ex":
                out_items.append({
                    "ref": it["ref"], "kind": "worked-example", "itemType": it["itemType"],
                    "standard": it["standard"], "difficulty": it["difficulty"],
                    "prompt": it["prompt"],
                    "workedSolution": {"steps": it["steps"], "answer": it["answer"]},
                })
                continue

            tokens = oracle(it["itemType"], it["given"])
            expected = "; ".join(tokens)
            if it["spec"] == "mc":
                answer = it["choices"][it["answerIndex"]]
                _agree(it["ref"], it["itemType"], tokens, answer, it["choices"])
                out_items.append({
                    "ref": it["ref"], "kind": "multiple-choice", "itemType": it["itemType"],
                    "standard": it["standard"], "difficulty": it["difficulty"],
                    "prompt": it["prompt"], "choices": it["choices"],
                })
                steps = steps_for(it["itemType"], it["given"], answer)
                assert steps, f"{it['ref']}: no derivation authored for {it['itemType']}"
                steps = steps + [
                    f"Recomputed independently from the recorded parameters, the oracle returns {expected}; "
                    f"the option matching it is “{answer}”.",
                ]
                answers.append({
                    "ref": it["ref"], "itemType": it["itemType"], "standard": it["standard"],
                    "difficulty": it["difficulty"], "answerType": "fixed", "answer": answer,
                    "answerIndex": it["answerIndex"], "given": it["given"],
                    "solutionReasoning": {"steps": steps, "answer": answer},
                    "referenceExample": ref_for(it["itemType"], it["given"]),
                    "verification": {"method": "recomputed", "oracle": ORACLE,
                                      "parameters": it["given"]},
                    "commonErrors": [
                        {"observed": f"Answered “{k}” instead of “{answer}”.",
                         "likelyCause": v,
                         "remediation": "Ask the learner to rework this item from its given quantities and say each "
                                        "step aloud, then name the single step that would have to change for the "
                                        "chosen option to be right, and check that step against the reference example."}
                        for k, v in it["errors"].items()
                    ],
                })
            else:  # constructed response
                answer = it["answer"]
                _agree(it["ref"], it["itemType"], tokens, answer)
                out_items.append({
                    "ref": it["ref"], "kind": "constructed-response", "itemType": it["itemType"],
                    "standard": it["standard"], "difficulty": it["difficulty"],
                    "prompt": it["prompt"], "responseExpectation": CR_EXPECTATION,
                })
                answers.append({
                    "ref": it["ref"], "itemType": it["itemType"], "standard": it["standard"],
                    "difficulty": it["difficulty"], "answerType": "fixed", "answer": answer,
                    "given": it["given"],
                    "solutionReasoning": {"steps": it["steps"], "answer": answer},
                    "referenceExample": ref_for(it["itemType"], it["given"]),
                    "verification": {"method": "recomputed", "oracle": ORACLE,
                                      "parameters": it["given"]},
                    "commonErrors": [
                        {"observed": f"Wrote {k}.", "likelyCause": v,
                         "remediation": "Ask the learner to restate the claim with its reason attached, then test "
                                        "the reason on one fresh case before moving on."}
                        for k, v in it["errors"].items()
                    ],
                })
        sections.append({"sectionId": sid, "kind": kind, "title": title,
                          "directions": DIRECTIONS[kind] if lesson is not L22 else
                          "Work every prompt independently. No instructional support is given during this assessment. "
                          "A squaring and cubing reference table is permitted.",
                          "items": out_items})

    package = {
        "schemaVersion": "1.0",
        "packageId": f"swk-{lid}",
        "lessonRef": {
            "lessonId": lid, "courseId": "ma-g8-mathematics", "grade": 8,
            "subject": "mathematics", "unitNumber": 1, "unitTitle": lesson["unitTitle"],
            "dayInUnit": lesson["dayInUnit"], "courseDay": lesson["courseDay"],
            "phase": lesson["phase"], "focus": lesson["focus"], "title": lesson["title"],
        },
        "standards": ["8.EE.2", "MP.2", "MP.6"],
        "blueprint": {"phase": lesson["phase"], "profile": lesson["profile"],
                       "sectionKinds": [k for _, k, _, _ in lesson["sections"]]},
        "sections": sections,
        "answerKeyRef": f"answer-keys/grade-08/{lid}.key.json",
        "integrity": {"corpusVersion": CORPUS_VERSION, "itemSource": ITEM_SOURCE,
                       "seed": f"{CORPUS_VERSION}|{lid}"},
    }
    key = {
        "schemaVersion": "1.0",
        "packageId": f"swk-{lid}",
        "lessonRef": {"lessonId": lid, "courseId": "ma-g8-mathematics", "grade": 8,
                       "unitNumber": 1, "phase": lesson["phase"]},
        "answers": answers,
        "scoringGuidance": SCORING,
        "masteryRule": MASTERY,
        "remediationGuidance": sorted({
            f"{a['itemType']} ({a['standard']}): if the learner misses these, reteach with the worked example "
            f"“{a['referenceExample']['prompt']}” and require the reasoning for each step before another attempt."
            for a in answers
        }),
        "extensionGuidance": [
            "Apply exact root reasoning under a new constraint, compare two approaches, or teach the idea with an "
            "original example without completing another learner's graded work.",
            "Graded coverage of 8.EE.2. No support on the mastery check.",
        ],
        "integrity": {"corpusVersion": CORPUS_VERSION, "seed": f"{CORPUS_VERSION}|{lid}"},
    }
    return package, key


def main():
    os.makedirs(PKG, exist_ok=True)
    os.makedirs(KEY, exist_ok=True)
    total_items = total_answers = 0
    for lesson in LESSONS:
        package, key = emit(lesson)
        lid = lesson["lessonId"]
        with open(os.path.join(PKG, f"{lid}.package.json"), "w") as fh:
            json.dump(package, fh, indent=2, ensure_ascii=False)
            fh.write("\n")
        with open(os.path.join(KEY, f"{lid}.key.json"), "w") as fh:
            json.dump(key, fh, indent=2, ensure_ascii=False)
            fh.write("\n")
        n = sum(len(s["items"]) for s in package["sections"])
        total_items += n
        total_answers += len(key["answers"])
        print(f"{lid}: {n} items, {len(key['answers'])} keyed")
    print(f"total: {total_items} items, {total_answers} keyed answers")


if __name__ == "__main__":
    main()
