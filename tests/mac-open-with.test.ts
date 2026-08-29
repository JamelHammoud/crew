import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

interface DocumentType {
  CFBundleTypeName: string
  CFBundleTypeRole: string
  CFBundleTypeExtensions: string[]
  LSItemContentTypes?: string[]
}

describe('the macOS app registration', () => {
  it('offers Crew for the code documents and folders offered by VS Code', async () => {
    const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
    const documents = pkg.build.mac.extendInfo.CFBundleDocumentTypes as DocumentType[]
    const code = documents.find(type => type.CFBundleTypeName === 'Code document')
    const folder = documents.find(type => type.CFBundleTypeName === 'Folder')
    expect(code?.CFBundleTypeRole).toBe('Editor')
    expect(code?.CFBundleTypeExtensions).toHaveLength(153)
    expect(code?.CFBundleTypeExtensions).toEqual(
      expect.arrayContaining(['c', 'cpp', 'go', 'java', 'js', 'json', 'md', 'py', 'rs', 'swift', 'ts', 'tsx', 'vue'])
    )
    expect(folder).toMatchObject({ CFBundleTypeRole: 'Editor', LSItemContentTypes: ['public.folder'] })
  })
})
