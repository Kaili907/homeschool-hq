# Manuel Academy mastery interface

This directory is an isolated, integration-ready feature package for the
student and parent mastery experience.

## Resolved path

The existing Homeschool HQ application currently keeps UI components in
`src/components/**`. This session was assigned exclusive ownership of
`app/features/mastery/**`, which did not exist, so the mastery interface was
created here without modifying the shared app shell or existing components.

## Preview

From the repository root:

```powershell
npm exec vite -- --config app/features/mastery/vite.config.ts
```

Open `http://127.0.0.1:4178`. The stable browser-test root is `.ma-mastery`,
the landmark is `main#mastery-main`, and the built-in skip link targets
`#mastery-content`.

To produce an isolated preview build:

```powershell
npm exec vite -- build --config app/features/mastery/vite.config.ts
```

The preview build is written to `app/features/mastery/.preview-dist/`.

To typecheck only this feature and its imported mastery contracts:

```powershell
npx tsc --noEmit -p app/features/mastery/tsconfig.json
```

## Integration contract

`buildMasteryDashboardModel` projects validated `SkillGraph`,
`StudentSkillMastery`, and `MasteryExplanation` domain records from
`adaptive-learning/mastery` into the presentation-only
`MasteryDashboardModel`.

```tsx
import { MasteryFeature, buildMasteryDashboardModel } from "./app/features/mastery";

const model = buildMasteryDashboardModel({
  learner: {
    studentId,
    displayName: profile.name,
    gradeBand: "Grades 6–8",
  },
  generatedAt: new Date().toISOString(),
  graphs,
  masteryRecords,
  explanations,
  subjectLabels: {
    [mathSubjectId]: "Math",
    [englishSubjectId]: "English",
  },
});

<MasteryFeature
  model={model}
  onRequestOverride={async (request) => {
    // Validate and apply through adaptive-learning/mastery, persist the
    // returned audit entry, then provide a newly projected model.
  }}
/>;
```

The UI does not calculate mastery, treat completion as evidence, or write
student progress directly. `MasteryOverrideRequest` is a UI command boundary;
production code must translate it into the domain's validated
`ManualMasteryOverride` flow and rerender the returned record. The prototype's
local override behavior exists only to demonstrate the form and audit display.
The projection rejects records belonging to a different student, duplicate
records, duplicate explanations, duplicate skill IDs, and circular graph input
instead of silently displaying ambiguous or cross-student data.

## Accessibility behavior

- Every glow/color signal includes a visible state label and symbol.
- The path view names every prerequisite and its direction.
- “Accessible list” is a fully visible nonvisual alternative with state,
  blocker, confidence, explanation, next step, and independent-demonstration
  date in text.
- Subject, state, and grade-band filters have persistent labels and a live
  result count.
- Controls use keyboard-visible focus, 44px minimum targets, semantic
  landmarks/headings/lists, and a skip link.
- The parent detail uses the six required questions as actual headings.
- Motion is intentionally absent; the reduced-motion rule also disables any
  host-provided transitions inside the feature.
- Forced-colors mode keeps status boundaries and signals visible.
