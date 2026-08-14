# Grade 3 Rounding Sample R1

## Review identity

- Lesson ref: `ma-g3-mathematics-u01-l02`
- Canonical catalog title: `Concept build A: the place-value structure of three-digit numbers`
- Grade / subject / course day: Grade 3 / Mathematics / Day 2
- Approved standard refs: `3.NBT.1`, `MP.6`, `MP.7`
- Child-facing learning goal: Today you will learn how to round a number to the nearest hundred.

The requested lesson identity is exact. The active Day 2 package at this ref already taught rounding under the approved 3.NBT.1 intent even though its preserved catalog title names the broader place-value concept. This sample deepens that same active package; it does not substitute Lesson 5 or alter catalog scheduling.

## Composition

| Part | Count |
| --- | ---: |
| Teaching blocks | 3 |
| Worked examples | 3 |
| Guided items | 5 |
| Independent items | 10 |
| Mastery items | 5 |
| Remediation items | 4 |
| Optional challenge items | 2 |

## Canonical authorship and provenance

- Authoritative base: `56dd8a45fee1ca03dd5f83e1466c9f081824d6b9`
- Authored sample source and independent oracle: `curriculum-production/final/mathematics/evidence/oracle-sources/grades-03-04/src/g34/grade3RoundingSampleR1.ts`
- Canonical dispatcher: `curriculum-production/final/mathematics/evidence/oracle-sources/grades-03-04/src/emit.ts`
- Isolated deterministic emitter: `curriculum-production/final/mathematics/evidence/oracle-sources/grades-03-04/tooling/generateGrade3RoundingSampleR1.ts`
- Final learner package: `curriculum-production/final/mathematics/active/packages/grade-03/ma-g3-mathematics-u01-l02.package.json`
- Separate adult answer authority: `curriculum-production/final/mathematics/active/answer-keys/grade-03/ma-g3-mathematics-u01-l02.key.json`
- Binding: package `answerKeyRef` resolves to the separate adult key; both retain the exact lesson, course, grade, unit, and phase identity.
- Corpus binding/checksum evidence: `curriculum-production/final/mathematics/manifest.json` and `curriculum-production/final/mathematics/SHA256SUMS.txt`.
- Regenerate from the repository root with `node --disable-warning=ExperimentalWarning --experimental-strip-types curriculum-production/final/mathematics/evidence/oracle-sources/grades-03-04/tooling/generateGrade3RoundingSampleR1.ts`, then `python3 curriculum-production/final/mathematics/build.py`.
- Admission/browser payloads were not hand-edited. Shared Tutor V2 and release-admission contracts were not changed for this sample.

## Proposed Tutor-readiness metadata (sample evidence only)

No accepted curriculum field currently exists for this metadata, so this proposal is evidence only and does not define Tutor V2 runtime behavior.

```json
{
  "concept": "round whole numbers to the nearest hundred",
  "prerequisites": [
    "read and name three-digit numbers",
    "identify hundreds and tens digits",
    "compare positions on a number line"
  ],
  "possibleMisconceptionIds": [
    "rounding-uses-ones-digit",
    "rounding-always-goes-down",
    "rounding-halfway-does-not-go-up",
    "rounding-changes-to-nearest-ten"
  ],
  "phaseHelpPolicyReferences": {
    "guided": "adult may prompt for bounding hundreds, then tens digit",
    "independent": "no answer reveal; ask learner to name the two neighboring hundreds",
    "mastery": "no help during first attempt",
    "remediation": "use Need Help? items in order",
    "challenge": "optional; ask for justification, not a new rule"
  }
}
```

## Child-facing lesson transcript

## Learn: Find the Nearby Hundreds

Today you will learn how to round a number to the nearest hundred. Rounding finds a nearby hundred that is easier to use. First, find the two hundreds around the number. For 327, the nearby hundreds are 300 and 400. Picture a number line: 300 — 327 — 400.

## Learn: Let the Tens Digit Help

The tens digit tells which hundred is nearer. A tens digit from 0 through 4 means the number is closer to the lower hundred. A tens digit from 5 through 9 means the number is halfway or closer to the higher hundred. The ones digit does not make this choice.

## Learn: What Happens Halfway?

A number ending in 50 is exactly halfway between two hundreds. It is the same distance from both. Our rounding rule says to choose the higher hundred when the tens digit is 5. So halfway numbers round up.

## Examples

Read each example. Notice the nearby hundreds, the tens digit, and why the answer is nearer.

### Example 1 — Round 243 to the nearest hundred.

- Step 1: 243 is between 200 and 300.

- Step 2: The tens digit is 4.

- Step 3: 4 is less than 5, so choose 200.

- Why: 243 is 43 away from 200 and 57 away from 300. It is closer to 200.

Final answer: **200**

### Example 2 — Round 678 to the nearest hundred.

- Step 1: 678 is between 600 and 700.

- Step 2: The tens digit is 7.

- Step 3: 7 is 5 or more, so choose 700.

- Why: 678 is 78 away from 600 and only 22 away from 700. It is closer to 700.

Final answer: **700**

### Example 3 — Round 550 to the nearest hundred.

- Step 1: 550 is between 500 and 600.

- Step 2: The tens digit is 5.

- Step 3: A 5 means the number is halfway, so choose the higher hundred, 600.

- Why: 550 is 50 away from both hundreds. When a number is halfway, we round up.

Final answer: **600**

## Let's Try One

Work with your teaching adult. The clues get smaller as you go.

### 1. 234 is between which two hundreds?

A. 100 and 200

B. 200 and 300

C. 300 and 400

D. 230 and 240

### 2. Look at 681. Which digit is in the tens place?

A. 6

B. 8

C. 1

D. 0

### 3. 762 is between 700 and 800. Should you round down or up?

A. down to 700

B. up to 800

C. stay at 762

D. down to 760

### 4. 419 is between 400 and 500. Round 419 to the nearest hundred.

What to do: Write your answer. Show or tell how you know.

### 5. Round 853 to the nearest hundred. Tell how the tens digit helped you decide.

What to do: Write your answer. Show or tell how you know.

## Your Turn

Work on your own. Show a number line, place-value thinking, or words when a question asks you to explain.

### 1. Round 142 to the nearest hundred.

What to do: Write your answer. Show or tell how you know.

### 2. Round 684 to the nearest hundred.

What to do: Write your answer. Show or tell how you know.

### 3. Round 450 to the nearest hundred.

What to do: Write your answer. Show or tell how you know.

### 4. Which is 326 rounded to the nearest hundred?

A. 300

B. 320

C. 330

D. 400

### 5. A museum had 781 visitors. About how many visitors is that, rounded to the nearest hundred?

What to do: Write your answer. Show or tell how you know.

### 6. A student says 249 rounds to 300 because 9 is more than 5. Is the student correct? Explain the mistake.

What to do: Write your answer. Show or tell how you know.

### 7. Round 615 to the nearest hundred. Explain why your answer is nearer than the other hundred.

What to do: Write your answer. Show or tell how you know.

### 8. Round 999 to the nearest hundred.

What to do: Write your answer. Show or tell how you know.

### 9. A food drive collected 352 cans. About how many cans is that, rounded to the nearest hundred?

What to do: Write your answer. Show or tell how you know.

### 10. Which hundred is closest to 574?

A. 500

B. 570

C. 600

D. 700

## Check What You Know

Try these fresh problems without help. Show or tell your thinking when asked.

### 1. Round 214 to the nearest hundred.

What to do: Write your answer. Show or tell how you know.

### 2. Which is 863 rounded to the nearest hundred?

A. 800

B. 860

C. 900

D. 1,000

### 3. A school used 547 sheets of paper. About how many sheets is that, rounded to the nearest hundred?

What to do: Write your answer. Show or tell how you know.

### 4. Round 650 to the nearest hundred. Explain what happens because the tens digit is 5.

What to do: Write your answer. Show or tell how you know.

### 5. A student says 392 rounds to 300. Is the student correct? Explain how you know.

What to do: Write your answer. Show or tell how you know.

## Need Help?

Remember: find the two hundreds around the number. Then look at the tens digit. 0–4 means choose the lower hundred. 5–9 means choose the higher hundred.

### 1. 371 is between which two hundreds?

A. 200 and 300

B. 300 and 400

C. 370 and 380

D. 400 and 500

### 2. Look at 526. Which digit helps you round to the nearest hundred?

A. 5

B. 2

C. 6

D. 0

### 3. 487 is between 400 and 500. Should you round down or up?

A. down to 400

B. up to 500

C. stay at 487

D. down to 480

### 4. Now put the steps together. Round 438 to the nearest hundred.

What to do: Write your answer. Show or tell how you know.

## Challenge

These two problems are optional. Use what you know about halfway points and groups of numbers.

### 1. What is the least whole number that rounds to 800 when rounding to the nearest hundred? Explain why.

What to do: Write your answer. Show or tell how you know.

### 2. Maya says every whole number from 600 through 699 rounds to 600. Is she right? Explain.

What to do: Write your answer. Show or tell how you know.

