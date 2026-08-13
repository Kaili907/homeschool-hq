import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { startAcademyUpdateRuntime } from './update/runtime'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Offline support (D1): register the service worker in production builds only —
// never in dev, where it would fight Vite HMR. Failures are swallowed so a missing
// SW can never break the app.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void startAcademyUpdateRuntime().catch(() => {})
  })
}
