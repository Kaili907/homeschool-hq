# Jarvis core interaction API

`ui/JarvisCore.tsx` is a controlled, presentation-only React component. It
renders the approved circular Jarvis visual, captions, status, transcript
region, and voice fallback state. The session shell continues to own speech,
speech recognition, persistence, and transcript data.

The existing tutor patterns informed two rules in this component:

- Spoken guidance always has an on-screen equivalent.
- Missing or intentionally disabled audio changes the message, never the
  learner's ability to continue.

## Props

| Prop | Type | Default | Purpose |
| --- | --- | --- | --- |
| `name` | `string` | `"Jarvis"` | Student-facing assistant name. |
| `activity` | `idle \| listening \| thinking \| speaking \| paused \| offline` | `idle` | Drives the visual and default accessible status. `speaking` adds the brighter pulse. |
| `statusText` | `string` | Activity label | Optional localized or more specific status. |
| `currentUtterance` | `ReactNode` | Guidance placeholder | Exact visible equivalent of any spoken line. Pass the full spoken text whenever voice plays. |
| `captionLabel` | `string` | `"Jarvis captions"` | Visible caption-region label. |
| `motionMode` | `full \| minimal \| none` | `full` | Explicit learner animation preference. The OS `prefers-reduced-motion` setting also disables animation. |
| `voiceMode` | `available \| no-audio \| unavailable` | `available` | Shows the appropriate non-blocking text fallback. |
| `voiceFallbackMessage` | `string` | Built-in message | Optional product-specific fallback copy. |
| `transcript` | `ReactNode` | none | Parent-owned transcript content. |
| `transcriptOpen` | `boolean` | `false` | Controlled transcript-region state. |
| `onTranscriptOpenChange` | `(open: boolean) => void` | none | Displays and controls the transcript toggle when transcript content is supplied. |
| `transcriptLabel` | `string` | `"Session transcript"` | Accessible label for the open transcript region. |
| `className` | `string` | none | Layout hook for the host surface. |

## Example

```tsx
import { useState } from 'react'
import { JarvisCore } from '../ui/JarvisCore'

export function TutorPanel() {
  const [transcriptOpen, setTranscriptOpen] = useState(false)

  return (
    <JarvisCore
      activity="speaking"
      currentUtterance="First, split 24 into two groups of 12."
      motionMode="minimal"
      voiceMode="no-audio"
      transcriptOpen={transcriptOpen}
      onTranscriptOpenChange={setTranscriptOpen}
      transcript={
        <ol>
          <li>Student: Show me another way.</li>
          <li>Jarvis: First, split 24 into two groups of 12.</li>
        </ol>
      }
    />
  )
}
```

## Integration notes

- Set `activity="speaking"` only while audio is actually playing; move back to
  `idle` when playback ends or fails.
- Always populate `currentUtterance` before requesting audio playback so captions
  never lag behind speech.
- Use `voiceMode="no-audio"` for a learner preference and
  `voiceMode="unavailable"` when the browser or provider cannot play speech.
- Keep the transcript state outside this component. This avoids duplicate
  session events and lets refresh recovery restore the same expanded state if
  desired.
- `motionMode="none"` is a hard stop for component animation.
  `motionMode="minimal"` keeps only very slow ambient movement. The CSS media
  query for `prefers-reduced-motion: reduce` overrides either animated mode.
- Put push-to-talk and typed-answer controls beside this component. Speech
  recognition should remain hold-to-record, place recognized text into an
  editable field, and never auto-submit.
- The transcript toggle and transcript scroll region are keyboard reachable,
  use visible focus indicators, and have 44-pixel minimum target sizing.
