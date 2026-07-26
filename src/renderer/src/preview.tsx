import { createRoot } from 'react-dom/client'
import ToolBuilder from './components/ToolBuilder'
import ToolKindPicker from './components/ToolKindPicker'
import ToolMarkPicker from './components/ToolMarkPicker'
import Toolbox from './components/Toolbox'
import { useCrew } from './state/store'
import { showTheme } from './state/theme'
import type { CrewTool } from '../../shared/toolbox'
import './styles.css'

showTheme('dark')

const tool = (id: string, name: string, mark: string, action: CrewTool['action']): CrewTool => ({
  id,
  name,
  mark,
  action,
  createdBy: 'Jamel',
  ts: 1
})

useCrew.setState({
  tools: [
    tool('t1', 'Figma', 'globe', { kind: 'web', url: 'https://figma.com' }),
    tool('t2', 'Dev server', 'terminal', { kind: 'terminal', command: 'yarn dev' }),
    tool('t3', 'Ship it', '🚀', { kind: 'terminal', command: 'yarn build' }),
    tool('t4', 'Join link', 'clipboard', { kind: 'copy', text: 'crew://join' })
  ],
  agents: [
    { id: 'a1', label: 'Bubbles', status: 'idle' },
    { id: 'a2', label: 'Fable', status: 'idle' }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ] as any,
  docs: { 'notes': { title: 'Notes', text: '' }, 'ship-list': { title: 'Ship list', text: '' } },
  boards: [
    { id: 'b1', name: 'Onboarding' },
    { id: 'b2', name: 'Toolbox' }
  ]
})

const editing = tool('t2', 'Dev server', 'terminal', { kind: 'terminal', command: 'yarn dev' })
const asking = tool('t5', 'Tests', 'chat', { kind: 'prompt', text: 'Run the tests and fix what fails', agentId: 'a1' })
const paged = tool('t6', 'Notes', 'doc', { kind: 'doc', page: 'notes' })
const copying = tool('t7', 'Join link', 'clipboard', { kind: 'copy', text: 'crew://join/abc' })

function Sheet({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs text-fg-muted">{title}</p>
      <div className="glass rounded-2xl w-[304px] overflow-hidden">{children}</div>
    </div>
  )
}

const noop = () => {}

createRoot(document.getElementById('root')!).render(
  <div className="min-h-screen bg-ink-900 p-8">
    <div className="flex flex-wrap gap-8 items-start">
      <Sheet title="New tool">
        <ToolBuilder tool={null} onDone={noop} />
      </Sheet>
      <Sheet title="Edit tool, a command">
        <ToolBuilder tool={editing} onDone={noop} />
      </Sheet>
      <Sheet title="Edit tool, an ask">
        <ToolBuilder tool={asking} onDone={noop} />
      </Sheet>
      <Sheet title="Edit tool, a doc">
        <ToolBuilder tool={paged} onDone={noop} />
      </Sheet>
      <Sheet title="Edit tool, a copy">
        <ToolBuilder tool={copying} onDone={noop} />
      </Sheet>
      <Sheet title="What it does">
        <ToolKindPicker kind="terminal" onPick={noop} onBack={noop} />
      </Sheet>
      <Sheet title="Choose a mark">
        <ToolMarkPicker mark="star" onPick={noop} onBack={noop} />
      </Sheet>
      <div className="w-[304px] h-[420px]">
        <p className="mb-2 text-xs text-fg-muted">Toolbox</p>
        <Toolbox open onClose={noop} onChat={noop} />
      </div>
    </div>
  </div>
)
