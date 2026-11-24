import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { PilotAccess } from './pilot/PilotAccess'
import './styles.css'
import './mobile.css'
import './visual.css'

const pilotEnabled = document.querySelector('meta[name="sam-pilot"][content="enabled"]') !== null

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {pilotEnabled ? <PilotAccess><App /></PilotAccess> : <App />}
  </StrictMode>,
)
