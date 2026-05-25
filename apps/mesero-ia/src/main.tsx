import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import {
  applyMeseroAppearance,
  applyMeseroPalette,
  getPaletteFromSettings,
  getStoredMeseroPalette,
  getStoredMeseroTheme,
} from './lib/meseroTheme'

applyMeseroAppearance(getStoredMeseroTheme(), getStoredMeseroPalette())

void fetch('/api/settings')
  .then((r) => (r.ok ? r.json() : null))
  .then((s) => {
    const p = getPaletteFromSettings(s);
    if (p) applyMeseroPalette(p);
  })
  .catch(() => {
    /* */
  })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div className="h-full">
      <App />
    </div>
  </StrictMode>,
)
