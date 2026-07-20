import { DocumentTextIcon, PlusIcon } from '@heroicons/react/16/solid'
import { useState } from 'react'
import DocEditor from '../components/DocEditor'
import { useCrew } from '../state/store'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/^-+/, '')
}

function prettify(slug: string): string {
  const words = slug.replace(/-/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export default function Docs() {
  const docs = useCrew(s => s.docs)
  const updateDoc = useCrew(s => s.updateDoc)
  const [page, setPage] = useState('main')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  const pages = Object.keys(docs).sort((a, b) => (a === 'main' ? -1 : b === 'main' ? 1 : a.localeCompare(b)))
  const current = docs[page] !== undefined ? page : 'main'

  const createPage = () => {
    const slug = slugify(newName)
    if (!slug) return
    if (docs[slug] === undefined) updateDoc(slug, '')
    setPage(slug)
    setCreating(false)
    setNewName('')
  }

  return (
    <div className="h-full flex px-6">
      <div className="max-w-[980px] w-full mx-auto flex pt-24 gap-8 min-h-0">
        <aside className="w-48 shrink-0 flex flex-col min-h-0 pb-6">
          <span className="text-sm font-semibold text-fg-muted px-3.5 mb-2">Pages</span>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-0.5">
            {pages.map(name => (
              <button
                key={name}
                onClick={() => setPage(name)}
                className={`w-full flex items-center gap-2 text-left px-3.5 py-2 rounded-full text-sm font-semibold transition-all duration-150 active:scale-[0.98] ${
                  name === current ? 'bg-ink-800 text-fg' : 'text-fg-muted hover:text-fg-secondary hover:bg-white/[0.04]'
                }`}
              >
                <DocumentTextIcon className="w-4 h-4 shrink-0 opacity-60" />
                <span className="truncate">{prettify(name)}</span>
              </button>
            ))}
          </div>
          {creating ? (
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') createPage()
                if (e.key === 'Escape') {
                  setCreating(false)
                  setNewName('')
                }
              }}
              onBlur={() => {
                setCreating(false)
                setNewName('')
              }}
              placeholder="Page name"
              className="mt-1 w-full bg-ink-800 rounded-full px-3.5 py-2 text-sm text-fg placeholder:text-fg-muted outline-none"
            />
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="mt-1 w-full flex items-center gap-2 text-left px-3.5 py-2 rounded-full text-sm font-semibold text-fg-muted transition-colors hover:text-fg-secondary hover:bg-white/[0.04]"
            >
              <PlusIcon className="w-4 h-4 shrink-0" />
              New page
            </button>
          )}
        </aside>
        <div className="flex-1 min-w-0 overflow-y-auto">
          <div className="max-w-[760px]">
            <h1 className="text-3xl font-bold text-fg px-[54px] pb-2">{prettify(current)}</h1>
            <DocEditor key={current} text={docs[current] ?? ''} onChange={markdown => updateDoc(current, markdown)} />
            <div className="h-40" />
          </div>
        </div>
      </div>
    </div>
  )
}
