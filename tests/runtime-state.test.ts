import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { runtimeStateDir } from '../src/main/runtime-state'

describe('runtime state', () => {
  it('keeps preview and shipping builds on the ordinary Crew state', () => {
    expect(runtimeStateDir('/state/Crew')).toBe('/state/Crew')
  })

  it('gives the live renderer independent process state', () => {
    expect(runtimeStateDir('/state/Crew', 'http://127.0.0.1:5173')).toBe(path.join('/state/Crew', 'dev'))
  })
})
