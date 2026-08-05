import { useEffect, useState, type DragEvent } from 'react'
import { fallbackTitle, ROOT_PAGE, splitPageCode } from '../../../../shared/docs'
import { ChevronRightGlyph, PlusGlyph, TrashGlyph } from '../../icons'
import { useDocs } from '../../state/docs'
import { useCrew } from '../../state/store'
import { createDocPage, freshSlug } from '../doc/docsPages'
import { buildTree, lastSegment, parentOf, type PageNode } from '../doc/docsTree'
import { EmojiText } from '../Emoji'
import { MenuItem, Popover } from '../Popover'
import Tooltip from '../Tooltip'

export default function SidebarDocs({ open }: { open: boolean }) {
  const docs = useCrew(s => s.docs)
  const renameDoc = useCrew(s => s.renameDoc)
  const deleteDoc = useCrew(s => s.deleteDoc)
  const page = useDocs(s => s.page)
  const go = useDocs(s => s.open)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [dragged, setDragged] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ slug: string; x: number; y: number } | null>(null)

  const current = docs[page] !== undefined ? page : ROOT_PAGE
  const titleOf = (slug: string): string => docs[slug]?.title ?? fallbackTitle(slug)
  const tree = buildTree(Object.keys(docs))

  useEffect(() => {
    setExpanded(prev => {
      const next = new Set(prev)
      for (let parent = parentOf(current); parent; parent = parentOf(parent)) next.add(parent)
      return next
    })
  }, [current])

  const addPage = (parent: string) => {
    createDocPage(parent)
    if (parent) setExpanded(prev => new Set(prev).add(parent))
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
    const to = docs[kept] !== undefined ? freshSlug(docs, target, splitPageCode(segment).base) : kept
    useDocs.getState().editor?.flush()
    renameDoc(dragged, to)
    if (target) setExpanded(prev => new Set(prev).add(target))
    if (current === dragged || current.startsWith(`${dragged}/`)) go(to + current.slice(dragged.length))
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

  const renderNode = (node: PageNode, depth: number) => {
    const shown = expanded.has(node.slug)
    const here = node.slug === current
    return (
      <div key={node.slug} className="flex flex-col gap-0.5">
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
          className={`group/page w-full rounded-xl pr-2 py-1.5 flex items-center gap-1.5 text-left text-sm transition-colors duration-150 ${
            dropTarget === node.slug ? 'ring-1 ring-fg/25' : ''
          } ${here ? 'bg-fg/[0.10] text-fg' : 'text-fg/70 hover:bg-fg/[0.06] hover:text-fg'}`}
          style={{ paddingLeft: 12 + depth * 12 }}
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
            aria-label={shown ? 'Collapse' : 'Expand'}
            className={`w-4 shrink-0 flex items-center justify-center text-fg/35 hover:text-fg ${
              node.children.length === 0 ? 'invisible' : ''
            }`}
          >
            <ChevronRightGlyph className={`w-3.5 h-3.5 transition-transform duration-150 ${shown ? 'rotate-90' : ''}`} />
          </button>
          <button
            onClick={() => go(node.slug)}
            aria-current={here ? 'page' : undefined}
            className="flex-1 min-w-0 truncate text-left"
          >
            <EmojiText text={titleOf(node.slug) || 'Untitled'} />
          </button>
          <Tooltip label="Add sub-page">
            <button
              onClick={() => addPage(node.slug)}
              aria-label="Add sub-page"
              className="h-6 w-6 -my-1 rounded-lg flex items-center justify-center text-fg/45 opacity-0 group-hover/page:opacity-100 focus-visible:opacity-100 hover:text-fg hover:bg-fg/[0.10] transition-opacity shrink-0"
            >
              <PlusGlyph className="w-4 h-4" />
            </button>
          </Tooltip>
        </div>
        {shown && node.children.map(child => renderNode(child, depth + 1))}
      </div>
    )
  }

  return (
    <div
      data-docs-tree
      aria-hidden={!open}
      className={`grid transition-[grid-template-rows] duration-200 ease-out ${
        open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr] pointer-events-none'
      }`}
    >
      <div className="min-h-0 -mx-2 overflow-hidden">
        <div {...dropProps('')} className="px-2 pt-0.5 flex flex-col gap-0.5">
          <div
            className={`flex flex-col gap-0.5 rounded-xl transition-colors duration-150 ${
              dragged && dropTarget === '' ? 'bg-fg/[0.06]' : ''
            }`}
          >
            {tree.map(node => renderNode(node, 0))}
          </div>
        </div>
        <div data-docs-rule className="h-px bg-fg/[0.08] mt-2 mb-1" />
        <Popover open={menu !== null} onClose={() => setMenu(null)} at={menu ?? undefined} align="start">
          <MenuItem
            icon={<PlusGlyph />}
            label="New sub-page"
            onClick={() => {
              if (menu) addPage(menu.slug)
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
                  if (current === menu.slug || current.startsWith(`${menu.slug}/`)) useDocs.getState().editor?.discard()
                  deleteDoc(menu.slug)
                }
                setMenu(null)
              }}
            />
          )}
        </Popover>
      </div>
    </div>
  )
}
