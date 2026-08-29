import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Sticky } from '../src/shared/stickies'
import { stickyCreateInput, stickyHasContent } from '../src/renderer/src/components/StickyEditor'
import {
  stickyEditorBackground,
  stickyColorValue,
  stickyLabel,
  stickyPreview
} from '../src/renderer/src/components/StickySidebar'

const draft: Sticky = {
  id: 'draft:one',
  body: '',
  color: 'yellow',
  pinned: false,
  createdAt: 1,
  updatedAt: 1
}

describe('stickies window', () => {
  it('includes a body-first edit in lazy creation', () => {
    const input = stickyCreateInput(draft, { body: '# First line' })

    expect(input).toEqual({
      title: undefined,
      body: '# First line',
      color: 'yellow',
      pinned: false
    })
    expect(stickyHasContent(input)).toBe(true)
  })

  it('does not create a sticky from an empty editor initialization', () => {
    expect(stickyHasContent(stickyCreateInput(draft, { body: '' }))).toBe(false)
    expect(stickyHasContent(stickyCreateInput(draft, { title: '  ', body: '\n  ' }))).toBe(false)
  })

  it('uses the first written line when the optional title is empty', () => {
    const sticky = { ...draft, body: '# First line\n\nSecond line' }

    expect(stickyLabel(sticky)).toBe('First line')
    expect(stickyPreview(sticky)).toBe('Second line')
  })

  it('keeps the shared color order and mixes the selected color into the page', () => {
    expect(
      ['default', 'yellow', 'pink', 'blue', 'green', 'purple'].map(color => stickyColorValue(color as Sticky['color']))
    ).toEqual(['var(--color-ink-700)', '#e9c46a', '#ef8f8f', '#78aee8', '#6fc7ad', '#d394df'])
    expect(stickyEditorBackground('default')).toBe('var(--color-ink-900)')
    expect(stickyEditorBackground('blue')).toBe('color-mix(in srgb, var(--color-ink-900) 94%, #78aee8)')
  })

  it('mounts a fresh draft immediately and focuses its body across two frames', () => {
    const windowSource = readFileSync('src/renderer/src/views/StickiesWindow.tsx', 'utf8')
    const editorSource = readFileSync('src/renderer/src/components/StickyEditor.tsx', 'utf8')

    expect(windowSource).toContain('useState<Sticky | null>(() => stickyDraft())')
    expect(windowSource).toContain('useState<string | null>(() => draft?.id ?? null)')
    expect(editorSource).toContain(
      'requestAnimationFrame(() => requestAnimationFrame(() => editorRef.current?.focusStart()))'
    )
  })

  it('scales a popped-out sticky continuously with its width', () => {
    const styles = readFileSync('src/renderer/src/styles.css', 'utf8')
    const start = styles.indexOf('.sticky-editor-compact')
    const compact = styles.slice(start, styles.indexOf('.doc .bn-editor .bn-trailing-block', start))

    expect(compact).toContain('container-type: inline-size')
    expect(compact).toContain('--sticky-editor-inset: clamp(10px, 8.7cqw, 54px)')
    expect(compact).toContain('padding-top: clamp(40px, 9dvh, 64px)')
    expect(compact).toContain('font-size: clamp(18px, 5.16cqw, 32px)')
    expect(compact).toContain('font-size: clamp(13px, 2.58cqw, 16px)')
    expect(compact).toContain('.mac .sticky-editor-compact .sticky-editor-page')
  })
})
