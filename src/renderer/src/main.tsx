import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { useCrew } from './state/store'
import { applyTheme, storedTheme } from './state/theme'
import './styles.css'

applyTheme(storedTheme())
void useCrew.getState().boot()

const root = document.getElementById('root')!
window.crew.onFullScreen(full => root.classList.toggle('square', full))

createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
