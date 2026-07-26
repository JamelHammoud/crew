import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import type { CrewTool } from '../../shared/toolbox'
import ToolBuilder from './components/ToolBuilder'
import ToolMarkPicker from './components/ToolMarkPicker'
import { useCrew } from './state/store'
import './styles.css'

useCrew.setState({
  tools: [],
  agents: [
    { id: 'a1', label: 'Fable', provider: 'claude', ownerId: 'o', ownerName: 'Jamel', status: 'idle', runs: {} },
    { id: 'a2', label: 'Bubbles', provider: 'claude', ownerId: 'o', ownerName: 'Jamel', status: 'idle', runs: {} }
  ]
} as never)

const made = (mark: string, name: string, action: CrewTool['action']): CrewTool => ({
  id: 'x',
  name,
  mark,
  action,
  createdBy: 'Jamel',
  ts: 1
})

function Card({ children }: { children: ReactNode }) {
  return <div className="glass w-[304px] rounded-2xl overflow-hidden self-start">{children}</div>
}

createRoot(document.getElementById('root')!).render(
  <div className="min-h-screen bg-ink-900 p-8 flex flex-wrap gap-8 items-start">
    <Card>
      <ToolBuilder tool={null} onDone={() => {}} />
    </Card>
    <Card>
      <ToolBuilder
        tool={made('\u{1F680}', 'Ship it', { kind: 'terminal', command: 'yarn build\nyarn dist' })}
        onDone={() => {}}
      />
    </Card>
    <Card>
      <ToolBuilder tool={made('doc', 'Notes', { kind: 'file', path: 'docs/notes.md' })} onDone={() => {}} />
    </Card>
    <Card>
      <ToolBuilder
        tool={made('chat', 'Tests', { kind: 'prompt', text: 'Run the tests and fix what fails', agentId: 'a2' })}
        onDone={() => {}}
      />
    </Card>
    <Card>
      <ToolMarkPicker mark="star" onPick={() => {}} onBack={() => {}} />
    </Card>
    <Card>
      <ToolMarkPicker mark="\u{1F680}" onPick={() => {}} onBack={() => {}} />
    </Card>
  </div>
)
