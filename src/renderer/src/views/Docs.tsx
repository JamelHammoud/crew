import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { fallbackTitle, pageCode, pageCodeOf, pageSlug, ROOT_PAGE, slugify, splitPageCode } from '../../../shared/docs'
import { DOC_MAX_W, DOC_TOP, docLeft, trailInset } from '../components/doc/docsLayout'
import { lastSegment, parentOf, trailOf } from '../components/doc/docsTree'
import DocEditor, { type DocEditorHandle } from '../components/DocEditor'
import FindBar from '../components/FindBar'
import HeaderSlot from '../components/HeaderSlot'
import { useDocs } from '../state/docs'
import { cornerRoom, useHeaderSlot } from '../state/headerSlot'
import { SIDEBAR_W, useSidebar } from '../state/sidebar'
import { useCrew } from '../state/store'

export default function Docs() {
  const docs = useCrew(s => s.docs)
  const updateDoc = useCrew(s => s.updateDoc)
  const retitleDoc = useCrew(s => s.retitleDoc)
  const renameDoc = useCrew(s => s.renameDoc)
  const docsTarget = useCrew(s => s.docsTarget)
  const clearDocsTarget = useCrew(s => s.clearDocsTarget)
  const page = useDocs(s => s.page)
  const fresh = useDocs(s => s.fresh)
  const openPage = useDocs(s => s.open)
  const took = useDocs(s => s.took)
  const hold = useDocs(s => s.hold)

  useEffect(() => {
    if (!docsTarget) return
    openPage(docsTarget)
    clearDocsTarget()
  }, [docsTarget, clearDocsTarget, openPage])

  const current = docs[page] !== undefined ? page : ROOT_PAGE
  const titleOf = (slug: string): string => docs[slug]?.title ?? fallbackTitle(slug)
  const [title, setTitle] = useState(() => titleOf(current))
  const titleRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<DocEditorHandle>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const pinned = useSidebar(s => s.pinned)
  const corner = useHeaderSlot(s => s.corner)
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    const el = pageRef.current
    if (!el) return
    const observer = new ResizeObserver(() => setWidth(el.clientWidth))
    observer.observe(el)
    setWidth(el.clientWidth)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    hold(editorRef.current)
    return () => hold(null)
  }, [hold, current])

  const focusBody = () => {
    requestAnimationFrame(() => requestAnimationFrame(() => editorRef.current?.focusStart()))
  }

  const trail = trailOf(current)

  const currentTitle = docs[current]?.title ?? fallbackTitle(current)
  useEffect(() => {
    if (document.activeElement !== titleRef.current) setTitle(currentTitle)
  }, [current, currentTitle])

  // A page opened by making it takes the caret in its own name, since a page
  // called Untitled is a page nobody meant to leave that way.
  useEffect(() => {
    if (!fresh) return
    took()
    requestAnimationFrame(() => {
      titleRef.current?.focus()
      titleRef.current?.select()
    })
  }, [current, fresh, took])

  const freshSlug = (parent: string, base: string): string => {
    const taken = new Set(Object.keys(docs).map(pageCodeOf))
    let code = pageCode()
    while (taken.has(code)) code = pageCode()
    return pageSlug(parent, base, code)
  }

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
    openPage(target)
  }

  return (
    <div ref={pageRef} className="h-full relative">
      {trail.length > 0 && (
        <HeaderSlot place="left">
          <nav
            data-docs-trail
            style={{ paddingLeft: trailInset(width, cornerRoom(corner, pinned ? SIDEBAR_W : 0)) }}
            className="flex items-center gap-1 min-w-0 text-xs font-medium text-fg/45"
          >
            {trail.map((slug, index) => (
              <span key={slug} className="flex items-center gap-1 min-w-0">
                {index > 0 && <span className="text-fg/25">/</span>}
                <button onClick={() => openPage(slug)} className="truncate max-w-44 transition-colors hover:text-fg">
                  {titleOf(slug) || 'Untitled'}
                </button>
              </span>
            ))}
          </nav>
        </HeaderSlot>
      )}
      <FindBar containerRef={contentRef} scrollerRef={scrollerRef} />
      <div ref={scrollerRef} className="h-full overflow-y-auto overflow-x-hidden">
        <div
          ref={contentRef}
          data-docs-page
          style={{ paddingTop: DOC_TOP, marginLeft: docLeft(width), maxWidth: DOC_MAX_W }}
        >
          <div className="px-[54px] pb-3">
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
