import { createRoot } from 'react-dom/client'
import './probe.css'
import Boot from '../../src/renderer/src/views/Boot'
import Home from '../../src/renderer/src/views/Home'
import { applyTheme } from '../../src/renderer/src/state/theme'

;(window as any).crew = {
  projects: async () => [
    { folder: '/Users/jamel/Documents/Repositories/crew', home: 'folder', opened: 4 },
    { folder: '/Users/jamel/work/payments-api', home: 'private', opened: 3 }
  ],
  recentJoins: async () => [
    { link: 'crew://100.64.1.2:2739/a1b2c3', folder: '/Users/jamel/work/ali-thing', name: 'Jamel', at: 2 }
  ],
  setBadge: async () => {},
  current: async () => null
}
localStorage.setItem('crew.name', 'Jamel (dev)')

applyTheme('dark')

const which = location.hash.slice(1) || 'home'
const root = createRoot(document.getElementById('root')!)
root.render(
  <div className="h-screen w-screen bg-ink-900">
    {which === 'boot' ? <Boot ready={false} onDone={() => {}} /> : <Home />}
  </div>
)
