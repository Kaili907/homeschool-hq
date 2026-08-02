# External assignment capture UI

This directory is an isolated, integration-ready React/TypeScript prototype for Manuel Academy's
provider-neutral external-school workflow. It does not modify or register itself in the shared app.

## Run the browser prototype

From the repository root:

```powershell
npm run dev
```

Then open:

```text
http://localhost:5173/app/features/external-assignment-capture/demo.html
```

The prototype has no network calls or persistent storage unless a host supplies a controller.
The built-in fixture simulates a Romeo Virtual Academy document while labeling its adapter
`provisional · no direct sync`.

To typecheck the isolated feature:

```powershell
npx tsc --noEmit -p app/features/external-assignment-capture/tsconfig.json
```

## Embed in the app

Import the component and its controller contract from the barrel:

```tsx
import {
  ExternalAssignmentCapture,
  type ExternalAssignmentCaptureController,
} from '../app/features/external-assignment-capture'

const controller: ExternalAssignmentCaptureController = {
  extractDocument: (request) => extractionService.extract(request),
  checkForDuplicate: (proposal) => assignmentService.checkDuplicate(proposal),
  scheduleAssignment: (input) => assignmentService.scheduleConfirmed(input),
  submitEvidence: (input) => evidenceService.submit(input),
  reviewEvidence: (input) => evidenceService.review(input),
  getProviderSyncStatus: (providerId) => providerService.getStatus(providerId),
}

<ExternalAssignmentCapture
  controller={controller}
  initialRole="parent"
  initialTimeZone="America/New_York"
  studentDisplayName="Student"
  onClose={() => navigateBack()}
/>
```

The local `ExternalAssignmentCaptureController` is deliberately narrow. An integration layer should
map its values to the canonical contracts under `external-learning/capture/**`; the UI does not own
assignment/calendar persistence or shared student identity.

## Demonstration paths

- Document intake: choose **Load readable demo**, review confidence and source evidence, confirm all
  twelve fields, run duplicate checking, and schedule.
- Manual intake: select **Enter it manually**, fill required values, confirm every field, then run
  the same duplicate and scheduling gates.
- Missing file: choose **Extract proposed details** with no file selected.
- Unreadable image: choose **Demo unreadable input**, then use the manual fallback.
- Duplicate/update/conflict: after confirming fields, choose a **Demo outcome** and resolve the
  result explicitly.
- Evidence and approval: after scheduling, switch to the student workspace, submit the configured
  file/link evidence, then switch to the parent workspace to approve or return it.

## Integration and privacy boundaries

- There is no password input. The UI explicitly says it never requests or stores school passwords.
- It does not sign in to an external provider or bypass provider access controls.
- Extracted strings and dates remain unconfirmed proposals until every field is checked.
- Editing a value clears its confirmation and invalidates an earlier duplicate check.
- Source evidence and per-field confidence stay visible during review.
- The provider identity and original assignment reference are displayed in capture, review, and
  schedule receipts.
- File bytes stay in browser memory in the built-in demo. A host controller receives a `File` only
  after the user explicitly starts extraction or submits evidence.
- Source attachment metadata says `browser-only` until the host accepts storage.
- Students cannot approve evidence. Parents cannot submit student evidence in this prototype.
- Scheduling does not complete an assignment. Completion occurs only after evidence satisfies the
  configured rule and the parent approves.
- Romeo sync status is `not-authorized` by default. Future authorized provider adapters can supply
  status and orchestration through the controller.

## Files

- `ExternalAssignmentCapture.tsx` — complete interactive workflow and integration boundary.
- `ExternalAssignmentCapture.css` — isolated responsive styles with reduced-motion support.
- `types.ts` — UI-facing TypeScript contracts and controller callbacks.
- `fixtures.ts` — representative readable extraction, duplicate, conflict, and workflow fixtures.
- `index.ts` — public exports.
- `demo.tsx` — standalone browser demo entry.
- `demo.html` — Vite-served demo page.
- `tsconfig.json` — isolated typecheck target.
- `README.md` — this integration and demonstration guide.
