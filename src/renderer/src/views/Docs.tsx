import { ChevronRightIcon, DocumentTextIcon, PlusIcon } from '@heroicons/react/16/solid'
import { useEffect, useRef, useState, type DragEvent } from 'react'
import DocEditor, { type DocEditorHandle } from '../components/DocEditor'
import Tooltip from '../components/Tooltip'
import { useCrew } from '../state/store'

interface PageNode {
  slug: string
  name: string
  children: PageNode[]
}

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
  const words = slug.split('/').pop()!.replace(/-/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function parentOf(slug: string): string {
  const idx = slug.lastIndexOf('/')
  return idx === -1 ? '' : slug.slice(0, idx)
}

function lastSegment(slug: string): string {
  return slug.split('/').pop()!
}

function buildTree(slugs: string[]): PageNode[] {
  const root: PageNode[] = []
  const byPath = new Map<string, PageNode>()
  const ensure = (slug: string): PageNode => {
    const found = byPath.get(slug)
    if (found) return found
    const node: PageNode = { slug, name: lastSegment(slug), children: [] }
    byPath.set(slug, node)
    const parent = parentOf(slug)
    if (parent) ensure(parent).children.push(node)
    else root.push(node)
    return node
  }
  for (const slug of [...slugs].sort()) ensure(slug)
  root.sort((a, b) => (a.slug === 'main' ? -1 : b.slug === 'main' ? 1 : a.slug.localeCompare(b.slug)))
  return root
}

export default function Docs() {
  const docs = useCrew(s => s.docs)
  const updateDoc = useCrew(s => s.updateDoc)
  const renameDoc = useCrew(s => s.renameDoc)
  const [page, setPage] = useState('main')
  const current = docs[page] !== undefined ? page : 'main'
  const [title, setTitle] = useState(() => prettify(current))
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [dragged, setDragged] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<DocEditorHandle>(null)
  const pendingFocus = useRef(false)

  const focusBody = () => {
    requestAnimationFrame(() => requestAnimationFrame(() => editorRef.current?.focusStart()))
  }

  const tree = buildTree(Object.keys(docs))

  useEffect(() => {
    setTitle(prettify(current))
    setExpanded(prev => {
      const next = new Set(prev)
      let parent = parentOf(current)
      while (parent) {
        next.add(parent)
        parent = parentOf(parent)
      }
      return next
    })
    if (pendingFocus.current) {
      pendingFocus.current = false
      requestAnimationFrame(() => {
        titleRef.current?.focus()
        titleRef.current?.select()
      })
    }
  }, [current])

  const freeSlug = (base: string): string => {
    let slug = base
    let n = 2
    while (docs[slug] !== undefined) slug = `${base}-${n++}`
    return slug
  }

  const createPage = (parent: string) => {
    const slug = freeSlug(parent ? `${parent}/untitled` : 'untitled')
    updateDoc(slug, '')
    if (parent) setExpanded(prev => new Set(prev).add(parent))
    pendingFocus.current = true
    setPage(slug)
  }

  const canDrop = (target: string): boolean => {
    if (!dragged || dragged === 'main') return false
    if (target === dragged || target.startsWith(`${dragged}/`)) return false
    return parentOf(dragged) !== target
  }

  const movePage = (target: string) => {
    if (!dragged || !canDrop(target)) return
    const base = target ? `${target}/${lastSegment(dragged)}` : lastSegment(dragged)
    const to = docs[base] !== undefined ? freeSlug(base) : base
    renameDoc(dragged, to)
    if (target) setExpanded(prev => new Set(prev).add(target))
    if (current === dragged || current.startsWith(`${dragged}/`)) setPage(to + current.slice(dragged.length))
  }

  const dropProps = (target: string) => ({
    onDragOver: (e: DragEvent) => {
      if (!canDrop(target)) return
      e.preventDefault()
      e.stopPropagation()
      setDropTarget(target)
    },
    onDragLeave: () => setDropTarget(t => (t === target ? null : t)),
    onDrop: (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      movePage(target)
      setDragged(null)
      setDropTarget(null)
    }
  })

  const commitTitle = () => {
    const name = slugify(title)
    if (!name || current === 'main') {
      setTitle(prettify(current))
      return
    }
    const parent = parentOf(current)
    const slug = parent ? `${parent}/${name}` : name
    if (slug === current) {
      setTitle(prettify(current))
      return
    }
    const target = docs[slug] !== undefined ? freeSlug(slug) : slug
    renameDoc(current, target)
    setPage(target)
  }

  const renderNode = (node: PageNode, depth: number) => {
    const open = expanded.has(node.slug)
    const active = node.slug === current
    return (
      <div key={node.slug}>
        <div
          draggable={node.slug !== 'main'}
          onDragStart={e => {
            e.dataTransfer.effectAllowed = 'move'
            setDragged(node.slug)
          }}
          onDragEnd={() => {
            setDragged(null)
            setDropTarget(null)
          }}
          {...dropProps(node.slug)}
          className={`group/row flex items-center rounded-full transition-all duration-150 ${
            dropTarget === node.slug ? 'bg-white/[0.08] ring-1 ring-white/25' : ''
          } ${active ? 'bg-ink-800' : 'hover:bg-white/[0.04]'}`}
          style={{ paddingLeft: depth * 14 }}
        >
          <button
            onClick={() =>
              setExpanded(prev => {
                const next = new Set(prev)
                if (next.has(node.slug)) next.delete(node.slug)
                else next.add(node.slug)
                return next
              })
            }
            aria-label={open ? 'Collapse' : 'Expand'}
            className={`w-5 h-7 flex items-center justify-center shrink-0 text-fg-faint hover:text-fg-muted ${
              node.children.length === 0 ? 'invisible' : ''
            }`}
          >
            <ChevronRightIcon className={`w-3.5 h-3.5 transition-transform duration-150 ${open ? 'rotate-90' : ''}`} />
          </button>
          <button
            onClick={() => setPage(node.slug)}
            className={`flex-1 min-w-0 flex items-center gap-1.5 text-left py-1.5 text-sm font-semibold ${
              active ? 'text-fg' : 'text-fg-muted hover:text-fg-secondary'
            }`}
          >
            <DocumentTextIcon className="w-4 h-4 shrink-0 opacity-60" />
            <span className="truncate">{prettify(node.slug)}</span>
          </button>
          <Tooltip label="Add sub-page">
            <button
              onClick={() => createPage(node.slug)}
              aria-label="Add sub-page"
              className="w-6 h-6 mr-1 rounded-full flex items-center justify-center text-fg-muted opacity-0 group-hover/row:opacity-100 hover:text-fg hover:bg-white/[0.08] transition-all shrink-0"
            >
              <PlusIcon className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
        </div>
        {open && node.children.map(child => renderNode(child, depth + 1))}
      </div>
    )
  }

  return (
    <div className="h-full flex">
      <aside className="w-64 shrink-0 flex flex-col min-h-0 pt-24 pb-6 pl-6 pr-2">
          <span className="text-sm font-semibold text-fg-muted px-3.5 mb-2">Pages</span>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-0.5">
            {tree.map(node => renderNode(node, 0))}
            <div
              {...dropProps('')}
              className={`h-10 rounded-2xl transition-all duration-150 ${
                dragged && dropTarget === '' ? 'bg-white/[0.06] ring-1 ring-white/20' : ''
              }`}
            />
          </div>
          <button
            onClick={() => createPage('')}
            className="mt-1 w-full flex items-center gap-2 text-left px-3.5 py-2 rounded-full text-sm font-semibold text-fg-muted transition-colors hover:text-fg-secondary hover:bg-white/[0.04]"
          >
            <PlusIcon className="w-4 h-4 shrink-0" />
            New page
          </button>
      </aside>
      <div className="flex-1 min-w-0 overflow-y-auto px-6">
        <div className="max-w-[760px] mx-auto pt-24">
            <div className="px-[54px] pb-2">
              <input
                ref={titleRef}
                value={title}
                readOnly={current === 'main'}
                onChange={e => setTitle(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === 'ArrowDown') {
                    e.preventDefault()
                    titleRef.current?.blur()
                    focusBody()
                  }
                  if (e.key === 'Escape') {
                    setTitle(prettify(current))
                    titleRef.current?.blur()
                  }
                }}
                placeholder="Untitled"
                className="w-full bg-transparent text-3xl font-bold text-fg placeholder:text-fg-faint outline-none"
              />
            </div>
            <DocEditor
              key={current}
              ref={editorRef}
              text={docs[current] ?? ''}
              onChange={markdown => updateDoc(current, markdown)}
            />
            <div className="h-40" />
          </div>
        </div>
      </div>
    </div>
  )
}
