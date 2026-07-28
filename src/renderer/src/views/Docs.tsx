import { useEffect, useRef, useState, type DragEvent } from 'react'
import {
  fallbackTitle,
  pageCode,
  pageCodeOf,
  pageSlug,
  ROOT_PAGE,
  slugify,
  splitPageCode
} from '../../../shared/docs'
import DocEditor, { type DocEditorHandle } from '../components/DocEditor'
import FindBar from '../components/FindBar'
import { MenuItem, Popover } from '../components/Popover'
import Tooltip from '../components/Tooltip'
import { ChevronRightGlyph, DocGlyph, PlusGlyph, TrashGlyph } from '../icons'
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
  root.sort((a, b) => (a.slug === ROOT_PAGE ? -1 : b.slug === ROOT_PAGE ? 1 : a.slug.localeCompare(b.slug)))
  return root
}

export default function Docs() {
  const docs = useCrew(s => s.docs)
  const updateDoc = useCrew(s => s.updateDoc)
  const retitleDoc = useCrew(s => s.retitleDoc)
  const renameDoc = useCrew(s => s.renameDoc)
  const deleteDoc = useCrew(s => s.deleteDoc)
  const docsTarget = useCrew(s => s.docsTarget)
  const clearDocsTarget = useCrew(s => s.clearDocsTarget)
  const [page, setPage] = useState(docsTarget ?? ROOT_PAGE)

  useEffect(() => {
    if (!docsTarget) return
    setPage(docsTarget)
    clearDocsTarget()
  }, [docsTarget, clearDocsTarget])
  const current = docs[page] !== undefined ? page : ROOT_PAGE
  const titleOf = (slug: string): string => docs[slug]?.title ?? fallbackTitle(slug)
  const [title, setTitle] = useState(() => titleOf(current))
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [dragged, setDragged] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ slug: string; x: number; y: number } | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<DocEditorHandle>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const pendingFocus = useRef(false)

  const focusBody = () => {
    requestAnimationFrame(() => requestAnimationFrame(() => editorRef.current?.focusStart()))
  }

  const tree = buildTree(Object.keys(docs))
  const trail: string[] = []
  for (let parent = parentOf(current); parent; parent = parentOf(parent)) trail.unshift(parent)

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
    const taken = new Set(Object.keys(docs).map(pageCodeOf))
    let code = pageCode()
    while (taken.has(code)) code = pageCode()
    return pageSlug(parent, base, code)
  }

  const createPage = (parent: string) => {
    const slug = freshSlug(parent, 'untitled')
    updateDoc(slug, '', '')
    if (parent) setExpanded(prev => new Set(prev).add(parent))
    pendingFocus.current = true
    setPage(slug)
  }

  const canDrop = (target: string): boolean => {
    if (!dragged || dragged === ROOT_PAGE) return false
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
      e.stopPropagation()
      if (!canDrop(target)) {
        setDropTarget(t => (t === null ? t : null))
        return
      }
      e.preventDefault()
      setDropTarget(target)
    },
    onDragLeave: (e: DragEvent) => {
      if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
      setDropTarget(t => (t === target ? null : t))
    },
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
    if (current === ROOT_PAGE) {
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
          draggable={node.slug !== ROOT_PAGE}
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
            dropTarget === node.slug ? 'bg-fg/[0.08] ring-1 ring-fg/25' : ''
          } ${active ? 'bg-ink-800' : 'hover:bg-fg/[0.04]'}`}
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
            <ChevronRightGlyph className={`w-3.5 h-3.5 transition-transform duration-150 ${open ? 'rotate-90' : ''}`} />
          </button>
          <button
            onClick={() => setPage(node.slug)}
            className={`flex-1 min-w-0 flex items-center gap-1.5 text-left py-1.5 text-sm font-semibold ${
              active ? 'text-fg' : 'text-fg-muted hover:text-fg-secondary'
            }`}
          >
            <DocGlyph className="w-4 h-4 shrink-0 opacity-60" />
            <span className="truncate">{titleOf(node.slug) || 'Untitled'}</span>
          </button>
          <Tooltip label="Add sub-page">
            <button
              onClick={() => createPage(node.slug)}
              aria-label="Add sub-page"
              className="w-6 h-6 mr-1 rounded-full flex items-center justify-center text-fg-muted opacity-0 group-hover/row:opacity-100 hover:text-fg hover:bg-fg/[0.08] transition-all shrink-0"
            >
              <PlusGlyph className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
        </div>
        {open && node.children.map(child => renderNode(child, depth + 1))}
      </div>
    )
  }

  return (
    <div className="h-full flex">
      <aside {...dropProps('')} className="w-64 shrink-0 flex flex-col min-h-0 pt-24 pb-6 pl-6 pr-2">
          <span className="text-sm font-semibold text-fg-muted px-3.5 mb-2">Pages</span>
          <div
            className={`flex-1 min-h-0 overflow-y-auto space-y-0.5 rounded-card transition-all duration-150 ${
              dragged && dropTarget === '' ? 'bg-fg/[0.06] ring-1 ring-fg/20' : ''
            }`}
          >
            {tree.map(node => renderNode(node, 0))}
            <div className="h-10" />
          </div>
          <button
            onClick={() => createPage('')}
            className="mt-1 w-full flex items-center gap-2 text-left px-3.5 py-2 rounded-full text-sm font-semibold text-fg-muted transition-colors hover:text-fg-secondary hover:bg-fg/[0.04]"
          >
            <PlusGlyph className="w-4 h-4 shrink-0" />
            New page
          </button>
          <Popover open={menu !== null} onClose={() => setMenu(null)} at={menu ?? undefined} align="start">
            <MenuItem
              icon={<PlusGlyph />}
              label="New sub-page"
              onClick={() => {
                if (menu) createPage(menu.slug)
                setMenu(null)
              }}
            />
            {menu?.slug !== ROOT_PAGE && (
              <MenuItem
                icon={<TrashGlyph />}
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
      <FindBar containerRef={contentRef} scrollerRef={scrollerRef} />
      <div ref={scrollerRef} className="flex-1 min-w-0 overflow-y-auto px-6">
        <div ref={contentRef} className="max-w-[760px] mx-auto pt-24">
            {trail.length > 0 && (
              <nav className="px-[54px] pb-1 flex items-center gap-1 text-xs font-semibold text-fg-muted">
                {trail.map((slug, index) => (
                  <span key={slug} className="flex items-center gap-1 min-w-0">
                    {index > 0 && <span className="text-fg-faint">/</span>}
                    <button
                      onClick={() => setPage(slug)}
                      className="truncate max-w-44 transition-colors hover:text-fg-secondary"
                    >
                      {titleOf(slug) || 'Untitled'}
                    </button>
                  </span>
                ))}
              </nav>
            )}
            <div className="px-[54px] pb-2">
              <input
                ref={titleRef}
                value={title}
                onChange={e => setTitle(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === 'ArrowDown') {
                    e.preventDefault()
                    titleRef.current?.blur()
                    focusBody()
                  }
                  if (e.key === 'Escape') {
                    setTitle(titleOf(current))
                    titleRef.current?.blur()
                  }
                }}
                placeholder="Untitled"
                className="w-full bg-transparent text-[32px] leading-tight font-semibold tracking-[-0.02em] text-fg placeholder:text-fg-faint outline-none"
              />
            </div>
            <DocEditor
              key={current}
              ref={editorRef}
              text={docs[current]?.text ?? ''}
              onChange={markdown => updateDoc(current, markdown)}
            />
        </div>
      </div>
    </div>
  )
}
