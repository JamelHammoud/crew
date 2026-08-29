import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Sticky } from '../src/shared/stickies'
import { stickyEditorBackground, stickyColorValue, stickyLabel, stickyPreview } from '../src/renderer/src/components/StickySidebar'
import { stickyCreateInput } from '../src/renderer/src/state/stickies'

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
    expect(stickyCreateInput(draft, { body: '# First line' })).toEqual({
      title: undefined,
      body: '# First line',
      color: 'yellow',
      pinned: false
    })
  })

  it('uses the first written line when the optional title is empty', () => {
    const sticky = { ...draft, body: '# First line\n\nSecond line' }

    expect(stickyLabel(sticky)).toBe('First line')
    expect(stickyPreview(sticky)).toBe('Second line')
  })

  it('keeps the shared color order and mixes the selected color into the page', () => {
    expect(['yellow', 'pink', 'blue', 'green', 'purple'].map(color => stickyColorValue(color as Sticky['color']))).toEqual([
      '#e9c46a',
      '#ef8f8f',
      '#78aee8',
      '#6fc7ad',
      '#d394df'
    ])
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
})
