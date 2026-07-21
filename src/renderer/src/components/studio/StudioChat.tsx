import { ArrowUpIcon, ChevronDownIcon, CodeBracketIcon, PaperClipIcon, SparklesIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useMemo, useRef, useState } from 'react'
import { attachmentUrl } from '../../../../shared/attachments'
import AgentIcon from '../AgentIcon'
import { AttachmentTray } from '../Attachments'
import { useCrew } from '../../state/store'

const PHASES = ['Thinking', 'Planning', 'Building', 'Refining', 'Completing']

export default function StudioChat({ pageId, onClose }: { pageId: string; onClose: () => void }) {
  const doc = useCrew(s => s.studioDoc)!
  const agents = useCrew(s => s.agents)
  const threads = useCrew(s => s.threads)
  const threadPrompts = useCrew(s => s.threadPrompts)
  const steps = useCrew(s => s.steps)
  const draft = useCrew(s => s.studioDraft)
  const setDraft = useCrew(s => s.setStudioDraft)
  const assign = useCrew(s => s.assignStudioAgents)
  const sendStudioChat = useCrew(s => s.sendStudioChat)
  const attach = useCrew(s => s.attach)
  const pending = useCrew(s => s.pending)
  const httpBase = useCrew(s => s.httpBase)
  const [picker, setPicker] = useState(false)
  const scroll = useRef<HTMLDivElement>(null)
  const key = `studio:${doc.id}`
  const pendingCount = (pending[key] ?? []).length

  const activity = useMemo(() => {
    const out: Array<{ agentId: string; promptId: string; phase: number; detail: string }> = []
    for (const thread of Object.values(threads)) {
      if (thread.studioId !== doc.id) continue
      const promptId = threadPrompts[thread.id]
      if (!promptId) continue
      const runSteps = steps[promptId] ?? []
      const last = runSteps.at(-1)
      const phase = Math.min(4, Math.max(0, runSteps.filter(step => step.status === 'done').length))
      out.push({ agentId: thread.agentId, promptId, phase, detail: last?.detail ?? last?.text ?? last?.name ?? PHASES[phase] })
    }
    return out
  }, [threads, threadPrompts, steps, doc.id])

  const selected = doc.agents
  const toggleAgent = (agentId: string) => assign(selected.includes(agentId) ? selected.filter(id => id !== agentId) : [...selected, agentId])
  const send = (build = false) => {
    const text = draft.trim() || (build ? 'Build this Studio design as production-ready code in the current repository. Preserve the layout, visual system, assets, components, and responsive behavior.' : '')
    if (!text && pendingCount === 0) return
    sendStudioChat(text, pageId, build)
  }

  const onPaste = (event: React.ClipboardEvent) => { if (event.clipboardData.files.length) void attach(key, event.clipboardData.files) }
  const onDrop = (event: React.DragEvent) => { event.preventDefault(); void attach(key, event.dataTransfer.files) }

  return <section className="studio-chat-dock" onDrop={onDrop} onDragOver={event => event.preventDefault()}>
    <header>
      <div><span><SparklesIcon /></span><div><strong>Studio agents</strong><small>{selected.length ? `${selected.length} assigned` : 'Choose an agent'}</small></div></div>
      <div><button onClick={() => setPicker(value => !value)} className={picker ? 'active' : ''}><ChevronDownIcon /></button><button onClick={onClose}><XMarkIcon /></button></div>
    </header>

    {picker && <div className="studio-agent-picker">
      <p>Work on this canvas</p>
      {agents.map(agent => <button key={agent.id} className={selected.includes(agent.id) ? 'selected' : ''} onClick={() => toggleAgent(agent.id)}>
        <AgentIcon seed={agent.id} size="sm" presence={agent.status === 'offline' ? 'offline' : 'online'} />
        <span><strong>{agent.label}</strong><small>{agent.provider} · {agent.status}</small></span><i>{selected.includes(agent.id) ? '✓' : '+'}</i>
      </button>)}
      {agents.length === 0 && <div className="studio-no-agents">Add an agent from Space to start designing with AI.</div>}
    </div>}

    {activity.length > 0 && <div className="studio-generation">
      {activity.map(item => {
        const agent = agents.find(candidate => candidate.id === item.agentId)
        return <article key={item.promptId}>
          <div className="generation-head">{agent && <AgentIcon seed={agent.id} size="sm" />}<span><strong>{agent?.label ?? 'Agent'}</strong><small>{item.detail}</small></span><i /></div>
          <div className="generation-phases">{PHASES.map((phase, index) => <span key={phase} className={index < item.phase ? 'done' : index === item.phase ? 'active' : ''}><i />{phase}</span>)}</div>
          <div className="generation-shimmer" />
        </article>
      })}
    </div>}

    <div ref={scroll} className="studio-chat-messages">
      {doc.chat.length === 0 && <div className="studio-chat-welcome"><span><SparklesIcon /></span><strong>Design with a sentence.</strong><p>Ask one agent or the whole crew to build, revise, review accessibility, or turn this canvas into code.</p><div>{['Design a modern dashboard', 'Create a mobile settings page', 'Build an onboarding flow'].map(prompt => <button key={prompt} onClick={() => setDraft(prompt)}>{prompt}</button>)}</div></div>}
      {doc.chat.map(entry => <article key={entry.id} className={`studio-chat-message ${entry.kind}`}>
        <div><strong>{entry.authorName}</strong><small>{new Date(entry.ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</small>{entry.build && <em><CodeBracketIcon /> Build</em>}</div>
        <p>{entry.text}</p>{entry.attachments?.length ? <div className="studio-message-files">{entry.attachments.map(file => <a key={file.id} href={attachmentUrl(httpBase, file)} target="_blank" rel="noreferrer"><PaperClipIcon />{file.name}</a>)}</div> : null}{entry.opsApplied ? <span className="ops-applied">{entry.opsApplied} canvas changes</span> : null}
      </article>)}
    </div>

    <div className="studio-chat-compose">
      <AttachmentTray attachmentKey={key} />
      <textarea value={draft} onChange={event => setDraft(event.target.value)} onPaste={onPaste} placeholder={selected.length ? `Message ${selected.length === 1 ? agents.find(a => a.id === selected[0])?.label ?? 'agent' : `${selected.length} agents`}…` : 'Assign an agent, then describe what to design…'} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send() } }} />
      <div>
        <label title="Attach image or file"><PaperClipIcon /><input type="file" multiple accept="image/*,.pdf,.txt,.md,.json,.csv,.svg" onChange={event => void attach(key, event.target.files)} /></label>
        <button className="build-this" onClick={() => send(true)}><CodeBracketIcon /> Build This</button>
        <button className="studio-send" disabled={(!draft.trim() && pendingCount === 0) || selected.length === 0} onClick={() => send()}><ArrowUpIcon /></button>
      </div>
    </div>
  </section>
}
