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
import { App as NativeApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { initTheme, refreshWallpaperSeed } from './store/theme'
import { initRipples } from './lib/ripple'
import { initBackButton } from './lib/backButton'
import { initSounds } from './lib/sounds'

initTheme()
initRipples()
initBackButton()
initSounds()
// The wallpaper may change while the app is in the background
if (Capacitor.isNativePlatform()) NativeApp.addListener('resume', refreshWallpaperSeed).catch(() => {})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
