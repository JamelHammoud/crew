import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

const root = document.getElementById('root')!
window.crew.onFullScreen(full => root.classList.toggle('square', full))

createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
