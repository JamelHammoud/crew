import { useEffect, useRef, useState } from 'react'
import type { Sticky } from '../../../shared/stickies'
import { updateSticky } from '../state/stickies'
import DocEditor, { type DocEditorHandle } from './DocEditor'

export default function StickyEditor({ sticky, fresh = false }: { sticky: Sticky; fresh?: boolean }) {
  const [title, setTitle] = useState(sticky.title)
  const titleRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<DocEditorHandle>(null)

  useEffect(() => {
    if (document.activeElement !== titleRef.current) setTitle(sticky.title)
  }, [sticky.id, sticky.title])

  useEffect(() => {
    if (!fresh) return
    requestAnimationFrame(() => requestAnimationFrame(() => editorRef.current?.focusStart()))
  }, [fresh, sticky.id])

  const saveTitle = () => {
    const next = title.trim()
    setTitle(next)
    if (next !== sticky.title) void updateSticky(sticky.id, { title: next })
  }

  const focusBody = () => {
    titleRef.current?.blur()
    requestAnimationFrame(() => editorRef.current?.focusStart())
  }

  return (
    <div data-sticky-editor className="h-full overflow-y-auto overflow-x-hidden">
      <div className="mx-auto w-full max-w-[780px] pt-[88px] pb-16">
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
                setTitle(sticky.title)
                titleRef.current?.blur()
              }
            }}
            placeholder="Title"
            aria-label="Sticky title"
            className="w-full bg-transparent text-[32px] leading-tight font-semibold tracking-[-0.02em] text-fg placeholder:text-fg-faint outline-none"
          />
        </div>
        <DocEditor
          key={sticky.id}
          ref={editorRef}
          text={sticky.body}
          onChange={body => void updateSticky(sticky.id, { body })}
        />
      </div>
    </div>
  )
}
