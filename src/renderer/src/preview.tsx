import { createRoot } from 'react-dom/client'
import Toolbox from './components/Toolbox'
import { useCrew } from './state/store'
import './styles.css'

useCrew.setState({
  tools: [
    { id: 't1', name: 'Figma', mark: 'globe', action: { kind: 'web', url: 'https://figma.com' }, createdBy: 'J', ts: 1 },
    { id: 't2', name: 'Ship it', mark: '\u{1F680}', action: { kind: 'terminal', command: 'yarn dist' }, createdBy: 'J', ts: 2 },
    { id: 't3', name: 'Notes', mark: 'doc', action: { kind: 'file', path: 'docs/notes.md' }, createdBy: 'J', ts: 3 },
    { id: 't4', name: 'Run the tests', mark: 'chat', action: { kind: 'prompt', text: 'Run the tests' }, createdBy: 'J', ts: 4 }
  ],
  agents: []
} as never)

createRoot(document.getElementById('root')!).render(
  <div className="min-h-screen bg-ink-900 p-8">
    <Toolbox open onClose={() => {}} onChat={() => {}} />
  </div>
)
