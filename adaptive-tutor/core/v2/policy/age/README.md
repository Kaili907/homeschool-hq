# Tutor V2 age and learning-stage policy

Study supplies an exact `TrustedStudyAgePolicyBinding` containing only opaque
profile, learning-stage, and approval references. Tutor does not select a profile
from a grade, birth date, learner identity, or other private child data. A
missing, unsupported, or mismatched binding returns `tutorMayProceed: false`.

Profiles express teaching behavior as data: concept and step limits, recommended
turn length, abstraction, granularity, comprehension-check cadence, concrete
example preference, reasoning independence, Socratic level, vocabulary,
explanation density, and hint re-check cadence. The same evaluator therefore
supports new stages, courses, and future grade bands without branching into a
new Tutor engine or depending on today's grade list.

`evaluateTutorTurnAgainstAgePolicy` is a structured enforcement boundary. A
provider prompt may repeat these constraints, but prompting is not the policy
authority.
