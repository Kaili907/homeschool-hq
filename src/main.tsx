import { StrictMode, type ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

async function loadBrowserRoot(): Promise<ComponentType> {
  if (import.meta.env.VITE_FAMILY_PILOT_ENABLED === 'true') {
    return (await import('./study/family-pilot/web/FamilyPilotWebApp')).default
  }
  return (await import('./App')).default
}

void loadBrowserRoot().then((BrowserRoot) => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRoot />
    </StrictMode>,
  )
})

// Offline support (D1): register the service worker in production builds only —
// never in dev, where it would fight Vite HMR. Failures are swallowed so a missing
// SW can never break the app.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {})
  })
}
