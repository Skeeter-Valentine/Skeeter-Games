import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ads } from './ads/ads.js'
import { loadAdScripts } from './ads/adsSetup.js'

// Ad and Grow scripts (only when switched on in the environment; see ADS-SETUP.md).
loadAdScripts(ads)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
