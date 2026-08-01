// @vitest-environment jsdom
import os from 'node:os'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
describe('os under jsdom', () => {
  it('says which import works', () => {
    console.log('default.tmpdir:', typeof os.tmpdir, 'named tmpdir:', typeof tmpdir)
    expect(typeof tmpdir).toBe('function')
  })
})
