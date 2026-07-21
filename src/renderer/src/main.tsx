import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { applyTheme, storedTheme } from './state/theme'
import './styles.css'

applyTheme(storedTheme())

const root = document.getElementById('root')!
window.crew.onFullScreen(full => root.classList.toggle('square', full))

createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
