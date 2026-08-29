import { useEffect, useRef, useState } from 'react'
import type { CreateStickyInput, Sticky, UpdateStickyInput } from '../../../shared/stickies'
import { createSticky, updateSticky } from '../state/stickies'
import DocEditor, { type DocEditorHandle } from './DocEditor'
import { stickyEditorBackground } from './StickySidebar'

export { stickyEditorBackground } from './StickySidebar'

export function stickyCreateInput(sticky: Sticky, patch: UpdateStickyInput): CreateStickyInput {
  const title = 'title' in patch ? patch.title : sticky.title
  return {
    title: title?.trim() || undefined,
    body: 'body' in patch ? (patch.body ?? '') : sticky.body,
    color: sticky.color,
    pinned: sticky.pinned
  }
}

export function stickyHasContent(input: CreateStickyInput): boolean {
  return Boolean(input.title?.trim() || input.body.trim())
}

export function stickyImageDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => (typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Image could not be read')))
    reader.onerror = () => reject(reader.error ?? new Error('Image could not be read'))
    reader.readAsDataURL(file)
  })
}

export default function StickyEditor({
  sticky,
  fresh = false,
  draft = false,
  compact = false,
  onCreated
}: {
  sticky: Sticky
  fresh?: boolean
  draft?: boolean
  compact?: boolean
  onCreated?: (sticky: Sticky) => void
}) {
  const [title, setTitle] = useState(sticky.title ?? '')
  const titleRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<DocEditorHandle>(null)
  const createdId = useRef<string | null>(draft ? null : sticky.id)
  const creating = useRef<Promise<Sticky> | null>(null)

  useEffect(() => {
    if (document.activeElement !== titleRef.current) setTitle(sticky.title ?? '')
  }, [sticky.id, sticky.title])

  useEffect(() => {
    if (!fresh) return
    requestAnimationFrame(() => requestAnimationFrame(() => editorRef.current?.focusStart()))
  }, [fresh, sticky.id])

  const persist = async (patch: UpdateStickyInput) => {
    if (createdId.current) {
      await updateSticky(createdId.current, patch)
      return
    }
    if (creating.current) {
      const created = await creating.current
      await updateSticky(created.id, patch)
      return
    }
    const input = stickyCreateInput(sticky, patch)
    if (!stickyHasContent(input)) return
    creating.current = createSticky(input)
    const created = await creating.current
    createdId.current = created.id
    onCreated?.(created)
  }

  const saveTitle = () => {
    const next = title.trim()
    setTitle(next)
    if (next !== (sticky.title ?? '')) void persist({ title: next || undefined })
  }

  const focusBody = () => {
    titleRef.current?.blur()
    requestAnimationFrame(() => editorRef.current?.focusStart())
  }

  return (
    <div
      data-sticky-editor
      style={{ background: stickyEditorBackground(sticky.color) }}
      className="h-full overflow-y-auto overflow-x-hidden transition-[background-color] duration-200"
    >
      <div className={`mx-auto w-full max-w-[780px] pb-16 ${compact ? 'pt-10' : 'pt-[88px]'}`}>
        <div className="px-[54px] pb-3">
          <input
            ref={titleRef}
            value={title}
            onChange={event => setTitle(event.target.value)}
            onBlur={saveTitle}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === 'ArrowDown') {
                event.preventDefault()
                focusBody()
              }
              if (event.key === 'Escape') {
                setTitle(sticky.title ?? '')
                titleRef.current?.blur()
              }
            }}
            placeholder="Title"
            aria-label="Sticky title"
            className="w-full bg-transparent text-[32px] leading-tight font-semibold tracking-[-0.02em] text-fg placeholder:text-fg/15 outline-none"
          />
        </div>
        <DocEditor
          key={sticky.id}
          ref={editorRef}
          text={sticky.body}
          onChange={body => void persist({ body })}
          uploadFile={stickyImageDataUrl}
        />
      </div>
    </div>
  )
}
