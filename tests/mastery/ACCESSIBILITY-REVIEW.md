# Manuel Academy mastery accessibility review

Date: 2026-07-28  
Scope: `app/features/mastery/**`  
Target: WCAG 2.1 Level A/AA, keyboard use, and a meaningful nonvisual
alternative to the visual prerequisite map.

## Review method

The review uses three complementary checks:

1. `interface.accessibility.test.tsx` server-renders the components and checks
   the semantic contract: explicit state text, ordered lists, description
   lists, headings, form labels, live status regions, filters, and all six
   required parent-detail questions.
2. `browser-accessibility.mjs` opens the isolated browser prototype in
   Chromium, exercises the skip link and view controls by keyboard, opens the
   override form, and runs axe-core against WCAG 2.0/2.1 A/AA rules at desktop
   and mobile viewport sizes.
3. Source inspection checks focus treatment, target sizing, reduced-motion
   handling, forced-colors handling, responsive behavior, and whether any
   meaning depends on glow or color alone.

Exact commands are documented in `VALIDATION-REPORT.md`.

## Findings

| Area | Evidence | Result |
| --- | --- | --- |
| Non-color status | Every state badge renders a symbol and visible state label; tests cover all six states. | Pass |
| Nonvisual alternative | The accessible view is a visible ordered list with skill, state, prerequisite, confidence, independent-demonstration date, rationale, and next step. | Pass |
| Structure | Main landmark, navigation label, ordered paths/lists, headings, definition lists, and native details/summary elements are used. | Pass |
| Forms | Subject/state/grade filters and override fields use persistent native labels. Result and submission messages use polite status regions. | Pass |
| Keyboard | Native buttons/selects/inputs are used. The browser check confirmed the skip link is first in focus order and moves focus to the unique content target. | Pass |
| Focus visibility | Interactive controls receive a 3px high-contrast `:focus-visible` outline with offset. | Source review passed |
| Target size | Buttons, selects, and inputs have a 2.75rem (44px) minimum height. | Source review passed |
| Motion | No decorative animation is present; the reduced-motion query disables transitions and smooth scrolling inside the feature. | Source review passed |
| Forced colors | Status boundaries and signal marks receive explicit `CanvasText` borders. Text labels remain present. | Source review passed |
| Responsive layout | Desktop grid collapses at narrow viewports; the browser check repeated the student-list scan at 390x844. | Pass |
| Automated WCAG scan | Three axe-core WCAG 2.0/2.1 A/AA scans completed with zero violations and zero browser errors. | Pass |
| Contrast | Axe reported 3 incomplete `color-contrast` checks because layered gradients prevent automatic background calculation. Token pairs were reviewed manually; the lowest reviewed pair was 8.49:1. | Pass with documented manual review |

## WCAG-oriented checklist

- 1.3.1 Info and Relationships: semantic headings, lists, definition lists,
  labels, and time/meter elements are present.
- 1.4.1 Use of Color: state names and symbols accompany every colored signal.
- 1.4.3 Contrast (Minimum): Axe could not calculate backgrounds through the
  layered gradients, so the primary token pairs were checked manually. Ratios
  ranged from 8.49:1 to 16.49:1, above the 4.5:1 normal-text requirement.
- 2.1.1 Keyboard: all actions use native keyboard-operable controls.
- 2.4.1 Bypass Blocks: the prototype begins with a skip link to the mastery
  content.
- 2.4.3 Focus Order: browser smoke checks that the skip link is first and its
  target receives focus.
- 2.4.7 Focus Visible: explicit focus-visible styling covers buttons, inputs,
  selects, textareas, summaries, and focusable host elements.
- 3.3.2 Labels or Instructions: all filter and override fields have visible
  labels; the override form describes the audit implications.
- 4.1.2 Name, Role, Value: native elements are used and selected/current states
  are exposed with `aria-pressed` or `aria-current`.
- 4.1.3 Status Messages: filter counts and override results use polite live
  status regions.

## Residual manual review

The completed browser run covered the desktop student list, desktop parent
detail and override form, and mobile student list. It reported 27, 28, and 27
passing Axe rules respectively, with zero confirmed violations. The three
incomplete checks were all `color-contrast`, one per scanned view, caused by
backgrounds that include CSS gradients. Manual token review produced these
representative ratios:

| Pair | Contrast |
| --- | ---: |
| Primary text / raised panel | 16.49:1 |
| Soft text / raised panel | 13.08:1 |
| Muted text / raised panel | 9.03:1 |
| Orange accent / raised panel | 10.89:1 |
| Cyan accent / raised panel | 12.10:1 |
| Dark primary-button text / darkest orange stop | 8.49:1 |
| Dark status glyph / least-luminous state fill | 9.86:1 |

Automated checks do not replace assistive-technology usability testing. Before
production integration, perform one VoiceOver, NVDA, or Narrator walkthrough
inside the real host shell and verify the spoken order of prerequisite paths.
Also recheck contrast if host CSS overrides any `--ma-*` custom properties.

Browser evidence is retained in
`browser-accessibility-result.json` and
`artifacts/mastery-desktop.png`.
