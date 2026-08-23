import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const source = (file: string): string => readFileSync(path.join(root, file), 'utf8')

const fields = [
  source('src/renderer/src/components/TextField.tsx'),
  source('src/renderer/src/views/Plugins.tsx'),
  source('src/renderer/src/views/Scheduled.tsx')
]

describe('input focus strokes', () => {
  it('keeps every focus stroke inside its field', () => {
    for (const field of fields) {
      expect(field).not.toContain('focus:shadow-[0_0_0_1px')
      expect(field).toContain('focus:shadow-[inset_0_0_0_1px')
    }
  })
})
