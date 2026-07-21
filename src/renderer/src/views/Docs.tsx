import { ChevronRightIcon, DocumentTextIcon, PlusIcon, TrashIcon } from '@heroicons/react/16/solid'
import { useEffect, useRef, useState, type DragEvent } from 'react'
import { fallbackTitle, pageCode, pageSlug, slugify, splitPageCode } from '../../../shared/docs'
import DocEditor, { type DocEditorHandle } from '../components/DocEditor'
import { MenuItem, Popover } from '../components/Popover'
import Tooltip from '../components/Tooltip'
import { useCrew } from '../state/store'

interface PageNode {
  slug: string
  children: PageNode[]
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
    const node: PageNode = { slug, children: [] }
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
  const retitleDoc = useCrew(s => s.retitleDoc)
  const renameDoc = useCrew(s => s.renameDoc)
  const deleteDoc = useCrew(s => s.deleteDoc)
  const [page, setPage] = useState('main')
  const current = docs[page] !== undefined ? page : 'main'
  const titleOf = (slug: string): string => docs[slug]?.title ?? fallbackTitle(slug)
  const [title, setTitle] = useState(() => titleOf(current))
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [dragged, setDragged] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ slug: string; x: number; y: number } | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<DocEditorHandle>(null)
  const pendingFocus = useRef(false)

  const focusBody = () => {
    requestAnimationFrame(() => requestAnimationFrame(() => editorRef.current?.focusStart()))
  }

  const tree = buildTree(Object.keys(docs))

  const currentTitle = docs[current]?.title ?? fallbackTitle(current)
  useEffect(() => {
    if (document.activeElement !== titleRef.current) setTitle(currentTitle)
  }, [current, currentTitle])

  useEffect(() => {
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

  const freshSlug = (parent: string, base: string): string => {
    let slug = pageSlug(parent, base, pageCode())
    while (docs[slug] !== undefined) slug = pageSlug(parent, base, pageCode())
    return slug
  }

  const createPage = (parent: string) => {
    const slug = freshSlug(parent, 'untitled')
    updateDoc(slug, '', '')
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
    const segment = lastSegment(dragged)
    const kept = target ? `${target}/${segment}` : segment
    const to = docs[kept] !== undefined ? freshSlug(target, splitPageCode(segment).base) : kept
    editorRef.current?.flush()
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
    const trimmed = title.trim()
    setTitle(trimmed)
    if (trimmed === titleOf(current)) return
    if (docs[current] === undefined) {
      updateDoc(current, '', trimmed)
      return
    }
    if (current === 'main') {
      retitleDoc(current, trimmed)
      return
    }
    const parent = parentOf(current)
    const { base: oldBase, code } = splitPageCode(lastSegment(current))
    const base = slugify(trimmed) || 'untitled'
    if (base === oldBase) {
      retitleDoc(current, trimmed)
      return
    }
    const kept = code ? pageSlug(parent, base, code) : null
    const target = kept && docs[kept] === undefined ? kept : freshSlug(parent, base)
    editorRef.current?.flush()
    renameDoc(current, target, trimmed)
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
          onContextMenu={e => {
            e.preventDefault()
            setMenu({ slug: node.slug, x: e.clientX, y: e.clientY })
          }}
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
          <Popover open={menu !== null} onClose={() => setMenu(null)} at={menu ?? undefined} align="start">
            <MenuItem
              icon={<PlusIcon />}
              label="New sub-page"
              onClick={() => {
                if (menu) createPage(menu.slug)
                setMenu(null)
              }}
            />
            {menu?.slug !== 'main' && (
              <MenuItem
                icon={<TrashIcon />}
                label="Delete page"
                danger
                onClick={() => {
                  if (menu) {
                    if (current === menu.slug || current.startsWith(`${menu.slug}/`)) editorRef.current?.discard()
                    deleteDoc(menu.slug)
                  }
                  setMenu(null)
                }}
              />
            )}
          </Popover>
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
  )
}
