// @vitest-environment jsdom
import { describe, it } from 'vitest'
describe('fs under jsdom', () => {
  it('reports what is available', async () => {
    const fs = await import('node:fs')
    console.log('keys', Object.keys(fs).slice(0, 8), 'default?', typeof (fs as never as { default: unknown }).default)
    console.log('readFileSync', typeof fs.readFileSync, typeof (fs as never as { default: { readFileSync: unknown } }).default?.readFileSync)
    console.log('cwd', process.cwd())
  })
})
