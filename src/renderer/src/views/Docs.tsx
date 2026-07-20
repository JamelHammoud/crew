import { EyeIcon, PencilIcon } from '@heroicons/react/16/solid'
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
    <div className="h-full flex px-6">
      <div className="max-w-[880px] w-full mx-auto flex pt-24 pb-6 gap-8 min-h-0">
        <aside className="w-44 shrink-0 pt-14 space-y-1">
          {pages.map(name => (
            <button
              key={name}
              onClick={() => switchPage(name)}
              className={`w-full text-left px-3.5 py-2 rounded-full text-sm font-semibold transition-all duration-150 active:scale-[0.98] ${
                name === page ? 'bg-ink-800 text-fg' : 'text-fg-muted hover:text-fg-secondary hover:bg-white/[0.04]'
              }`}
            >
              {name}
            </button>
          ))}
        </aside>
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex justify-end shrink-0">
            <div className="flex items-center gap-0.5 bg-ink-800 rounded-full p-1">
              <button
                onClick={() => setEditing(true)}
                className={`flex items-center gap-1.5 h-8 px-3.5 rounded-full text-sm font-semibold transition-all duration-150 ${
                  editing ? 'bg-ink-600 text-fg' : 'text-fg-muted hover:text-fg-secondary'
                }`}
              >
                <PencilIcon className="w-3.5 h-3.5" />
                Edit
              </button>
              <button
                onClick={() => setEditing(false)}
                className={`flex items-center gap-1.5 h-8 px-3.5 rounded-full text-sm font-semibold transition-all duration-150 ${
                  !editing ? 'bg-ink-600 text-fg' : 'text-fg-muted hover:text-fg-secondary'
                }`}
              >
                <EyeIcon className="w-3.5 h-3.5" />
                Preview
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0 pt-4">
            {editing ? (
              <textarea
                value={draft}
                onChange={e => onChange(e.target.value)}
                onFocus={() => (focused.current = true)}
                onBlur={() => (focused.current = false)}
                placeholder="Plan together. Markdown works here."
                className="w-full h-full bg-transparent text-base text-fg placeholder:text-fg-muted outline-none resize-none font-mono leading-6"
              />
            ) : (
              <div className="h-full overflow-y-auto">
                <Markdown text={draft || 'Nothing here yet.'} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
