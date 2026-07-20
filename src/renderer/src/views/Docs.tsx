import { useEffect, useRef, useState } from 'react'
import Markdown from '../components/Markdown'
import { useCrew } from '../state/store'

export default function Docs() {
  const docs = useCrew(s => s.docs)
  const updateDoc = useCrew(s => s.updateDoc)
  const [page, setPage] = useState('main')
  const [draft, setDraft] = useState(docs['main'] ?? '')
  const [editing, setEditing] = useState(true)
  const focused = useRef(false)
  const timer = useRef<number | null>(null)

  const pages = Object.keys(docs).sort((a, b) => (a === 'main' ? -1 : b === 'main' ? 1 : a.localeCompare(b)))

  useEffect(() => {
    if (!focused.current) setDraft(docs[page] ?? '')
  }, [docs, page])

  const onChange = (value: string) => {
    setDraft(value)
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => updateDoc(page, value), 700)
  }

  const switchPage = (next: string) => {
    setPage(next)
    setDraft(docs[next] ?? '')
    setEditing(true)
  }

  return (
    <div className="h-full flex">
      <aside className="w-44 border-r border-zinc-800 px-3 py-4 space-y-1 shrink-0">
        {pages.map(name => (
          <button
            key={name}
            onClick={() => switchPage(name)}
            className={`w-full text-left px-2 py-1.5 rounded-md text-sm ${
              name === page ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {name}
          </button>
        ))}
      </aside>
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex justify-end px-6 pt-3 shrink-0">
          <button
            onClick={() => setEditing(e => !e)}
            className="text-xs px-3 py-1.5 rounded-md border border-zinc-700 text-zinc-300 hover:border-zinc-500"
          >
            {editing ? 'Preview' : 'Edit'}
          </button>
        </div>
        <div className="flex-1 min-h-0 px-6 pb-6 pt-2">
          {editing ? (
            <textarea
              value={draft}
              onChange={e => onChange(e.target.value)}
              onFocus={() => (focused.current = true)}
              onBlur={() => (focused.current = false)}
              placeholder="Plan together. Markdown works here."
              className="w-full h-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 outline-none resize-none font-mono leading-6"
            />
          ) : (
            <div className="max-w-3xl">
              <Markdown text={draft || 'Nothing here yet.'} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
