# Grade 3 Static Lesson and Help Fallback

## The guarantee

**Grade 3 Mathematics is fully functional when no adaptive intervention matches - which, for Grade 3, is always.** No Grade 3 lesson, unit, assessment, project, or practice set depends on the Adaptive Math package being present, installed, licensed, or reachable.

## What every Grade 3 lesson carries on its own

| Field | What it provides |
| --- | --- |
| `support` | The smallest prerequisite to return to, and how to reteach it |
| `target_misconception` | The specific error to expect, a diagnostic question, and a repair move |
| `adaptive_tutor_routes` | Six routes, every one resolving to `static-lesson-fallback` |
| `extension` | Where to go when the learner is ready for more |
| `lesson_flow` | Five or more segments with explicit adult actions |
| `media.fallback` | A written path that needs no image, audio, or video |
| `study_adapter.static_fallback_available` | Always `true`; `requires_adaptive_package` always `false` |

## The six static routes

Every Grade 3 lesson resolves all six of these without any external package:

1. **prerequisite gap** - return to the unit's smallest prerequisite, reteach concretely, retry one fresh item.
2. **target misconception observed** - the unit's named pattern, its diagnostic probe, and its repair move.
3. **procedure without understanding** - require a representation of why the procedure works before more items.
4. **correct but low confidence** - confirm the reasoning, vary the example, do not remediate.
5. **repeated error pattern** - name the pattern neutrally, contrast with a worked example, schedule spaced review.
6. **mastery evidence** - require independent application plus explanation on a later occasion.

## Unit-level fallback

Each of the ten Grade 3 units supplies a prerequisite list and a table of five known misconceptions, each with a diagnostic probe and a repair move. Together with the lesson-level fields above, this is the complete help system for the course.

## What a runtime should do

A Study runtime that has no Adaptive Math capability should render Grade 3 exactly as authored and take no degraded-mode branch. There is no missing-capability warning to show, because nothing is missing: `requires_adaptive_package` is `false` on all 180 Grade 3 lessons.

