import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
// Bundled fonts so the Android app looks right without internet
import '@fontsource-variable/fredoka'
import '@fontsource-variable/nunito'
import '@fontsource-variable/hanken-grotesk'
import '@fontsource-variable/inter'
import '@fontsource-variable/space-grotesk'
import './index.css'
import App from './App.tsx'
import { initTheme } from './store/theme'

initTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
