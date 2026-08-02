import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ExternalAssignmentCapture } from './ExternalAssignmentCapture'

const root = document.getElementById('external-assignment-capture-demo')

if (!root) {
  throw new Error('External assignment capture demo root was not found.')
}

createRoot(root).render(
  <StrictMode>
    <ExternalAssignmentCapture studentDisplayName="Manuel Academy student" />
  </StrictMode>,
)
