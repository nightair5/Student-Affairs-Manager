import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { PilotNotice } from './pilot/PilotNotice'
import './styles.css'
import './mobile.css'
import './visual.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PilotNotice />
    <App />
  </StrictMode>,
)
