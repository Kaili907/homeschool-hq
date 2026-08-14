# Family Pilot Student Dashboard + Jarvis UI R1

## Scope and custody

- Authoritative application base: `56dd8a45fee1ca03dd5f83e1466c9f081824d6b9`.
- Branch: `mac/family-dashboard-jarvis-ui-r1`.
- This change owns presentation only under `src/study/family-pilot/student-dashboard/**`, its visual harness, screenshots, and this evidence file.
- No `App.tsx`, Family Pilot controller, data adapter, persistence, scoring, curriculum runtime, Profile sync, or Tutor transcript path was changed.
- The component receives a `StudentDashboardModel` and intent callbacks. A separate adapter session can compose real Family Pilot projections without changing the visual component.

## Reference lineage

The repository history was inspected in the requested order:

| Commit | Accepted contribution used |
| --- | --- |
| `26f3ec1dee90e49cca208aede2543d79cc36b951` | Original Student Dashboard composition and dark Academy palette. |
| `c879b241234d99c6efbd54044c07b6c2cf47d5bb` | First correction pass for hierarchy, state copy, and responsive behavior. |
| `e98de47f167c548c471ae5d7eb8bfc2e34ad1421` | Polished layered Jarvis visual. |
| `f7ff8cc97179dc85173bb67a7b05d20ad530ce74` | Student-facing copy correction lineage. Only presentation findings were used; `App.tsx` was not ported. |
| `e913962182a6f459b80c97173288c993c3f694af` | Final visual-correction baseline used for the dashboard/Jarvis treatment. |
| `40db3d597d3b414c9bbb4620d53ee29c96162f53` | Default-home context reviewed. `LegacyMissionPanel`, legacy mission data, and legacy `App.tsx` wiring were intentionally excluded. |
| `ffd1cc5a7ff706abfde00a07bc284b22687ffe0f` | Master reference inspected for the final release lineage. |

## Dashboard UI

`StudentDashboard` renders only injected data and raises route intents through:

- `onOpenWork(workRef)`
- `onOpenCourse(courseRef)`
- `onOpenSchedule()`
- `onOpenTool(toolRef)`
- `onSignOut()`

The primary hierarchy is greeting/identity, current period, mission (“what do I do next?”), today’s sequence, Jarvis, courses, upcoming schedule, and quick tools. The model contains safe display copy only; the presentation does not derive assignment state, progress, explanations, or business authority.

Fixture coverage is provided for:

- no work today
- lesson ready
- continue lesson
- assessment pending
- guardian pending
- Safety blocked
- Social source blocked
- storage unavailable

Descriptions and empty-state explanations are rendered only when supplied by the model.

## Jarvis visual and current mode

`JarvisDashboardProps` is intentionally narrow:

```ts
interface JarvisDashboardProps {
  mode: 'visual-only' | 'tutor-v2'
  status: string
  onActivate?: () => void
}
```

The Family Pilot default is `visual-only` with the honest status “Jarvis is visual only. Tutor is not connected in this release.” The control makes no AI call, starts no microphone, persists no conversation, and sends no request. Without `onActivate`, a click announces the supplied status through an `aria-live` region. With `onActivate`, it invokes only that injected callback.

The core is CSS-only: a dark nucleus, primary ring, secondary orbit, outer detail, and subtle ambient halo. No WebGL, canvas, animation library, image asset, or network image is used.

## Tutor V2 port

A future Tutor V2 host may pass `mode="tutor-v2"`, a truthful host-owned status, and `onActivate`. No Tutor V2 state machine, API client, microphone behavior, transcript store, or unrestricted Tutor route is defined here. The host remains responsible for all authorization and behavior.

## Responsive and accessibility evidence

The browser harness verifies 390×844 phone, 768×1024 tablet, 1280×800 laptop, and 1440×1000 desktop layouts. It checks horizontal overflow, the Jarvis core’s viewport bounds, and visibility of the primary mission. Pixel baselines are stored beside `tests/browser/family-pilot-dashboard-visual.spec.ts`.

Accessibility provisions include:

- one `main` landmark and a keyboard-visible skip link
- semantic buttons for every action
- complete route-intent accessible names
- visible `:focus-visible` treatment
- text labels in addition to status marks and color
- progressbar names and numeric values
- a single `aria-hidden` decorative Jarvis core
- forced-colors fallback
- live status feedback for a no-callback Jarvis click

Jarvis animation exists only inside `prefers-reduced-motion: no-preference`. All visual tiers stop under `prefers-reduced-motion: reduce`; hover translation is also removed.

## Dependency and legacy-import proof

The component test reads the complete local presentation source graph and asserts that every import is either `react` or local to `student-dashboard`. It also rejects legacy, Profile sync, scoring, transcript, curriculum, adult-answer, fetch, XHR, WebSocket, canvas, WebGL, Three.js, and Lottie references.

Expected graph:

```text
index.ts
├── StudentDashboard.tsx
│   ├── JarvisDashboard.tsx
│   ├── types.ts
│   └── studentDashboard.css
├── JarvisDashboard.tsx
├── fixtures.ts
└── types.ts
```

The production-enabled Vite build additionally runs the repository’s browser answer-authority audit.

## Verification commands

The final branch was verified with:

```text
npm run typecheck
npx vitest run --project root-app src/study/family-pilot/student-dashboard/StudentDashboard.test.tsx
npx playwright test --config playwright.family-pilot-dashboard.config.ts
npx vitest run --project root-app src/study/family-pilot
npm run test:family-pilot-browser
VITE_FAMILY_PILOT_ENABLED=true npm run build
```

Final command results and the pushed SHA are reported in the session return.

## Final local results

| Gate | Result |
| --- | --- |
| TypeScript | PASS |
| Focused dashboard component suite | PASS — 17/17 |
| Dashboard browser/visual/accessibility suite | PASS — 8/8 |
| Family Pilot unit/integration directory | PASS — 854/854 |
| Full Family Pilot Chromium workflow | PASS — 11/11 |
| Family Pilot default-off browser gate | PASS — 1/1 |
| Production-enabled build | PASS — 556 modules transformed |
| Browser answer-authority audit | PASS — 4 chunks, 0 authority terms, 0 findings |
| Standalone dashboard bundle proof | PASS — 5 source/style inputs, 19,077-byte JS, 25,718-byte CSS, 0 forbidden findings |
| Production dependency audit | PASS — 0 production vulnerabilities reported by `npm audit --omit=dev` |
| Whitespace/error diff check | PASS |

The existing development toolchain reports three high-severity audit findings in Playwright/Nanoid. The production dependency audit reports zero, and this session does not change `package.json` or `package-lock.json`.
