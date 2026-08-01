import { describe, expect, it } from 'vitest'
import { windowForAlert } from '../src/shared/alerts'

const app = (place: string | null) => ({ place, popped: false })
const thread = (place: string | null) => ({ place, popped: true })

describe('where a banner opens', () => {
  it('is the one window there is', () => {
    expect(windowForAlert([app('project:one')], 'project:one')).toBe(0)
  })

  it('is never a thread standing in a window of its own', () => {
    expect(windowForAlert([thread('project:one'), app('project:one')], 'project:one')).toBe(1)
  })

  it('is the window already in the project the banner came from', () => {
    const windows = [app('project:one'), app('project:two')]
    expect(windowForAlert(windows, 'project:two')).toBe(1)
  })

  it('is a window that has to move first when none of them is there', () => {
    const windows = [app('project:one'), app('project:two')]
    expect(windowForAlert(windows, 'project:three')).toBe(0)
  })

  it('is the first window when the banner names no project', () => {
    expect(windowForAlert([app('project:one'), app('project:two')], null)).toBe(0)
  })

  it('is nowhere when every window is a thread of its own', () => {
    expect(windowForAlert([thread('project:one')], 'project:one')).toBe(-1)
  })

  it('is nowhere when there are no windows at all', () => {
    expect(windowForAlert([], 'project:one')).toBe(-1)
  })
})
