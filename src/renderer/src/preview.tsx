import { createRoot } from 'react-dom/client'
import './styles.css'
import ToolBuilder from './components/ToolBuilder'
import Toolbox from './components/Toolbox'
import { useCrew } from './state/store'

useCrew.setState({
  tools: [
    { id: 't1', name: 'Figma', mark: 'globe', action: { kind: 'web', url: 'https://figma.com' }, createdBy: 'Jamel', ts: 1 },
    { id: 't2', name: 'Ship it', mark: '🚀', action: { kind: 'terminal', command: 'yarn dist' }, createdBy: 'Jamel', ts: 2 }
  ],
  agents: [
    { id: 'a1', label: 'Fable', provider: 'claude', ownerId: 'o', ownerName: 'Jamel', status: 'idle', runs: {}, settings: {}, fields: [] },
    { id: 'a2', label: 'Bubbles', provider: 'claude', ownerId: 'o', ownerName: 'Jamel', status: 'idle', runs: {}, settings: {}, fields: [] }
  ]
} as never)

function Card({ children }: { children: React.ReactNode }) {
  return <div className="glass w-[304px] rounded-2xl overflow-hidden self-start">{children}</div>
}

createRoot(document.getElementById('root')!).render(
  <div className="min-h-screen bg-ink-900 p-6 flex gap-6 items-start">
    <Card><ToolBuilder tool={null} onDone={() => {}} /></Card>
    <div id="slot2" />
    <Toolbox open={false} onClose={() => {}} onChat={() => {}} />
  </div>
)
