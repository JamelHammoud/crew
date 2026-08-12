// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false
})) as typeof window.matchMedia

const { BlockNoteEditor } = await import('@blocknote/core')
const { docSchema } = await import('../src/renderer/src/components/doc/docSchema')
const { CODE_LANGUAGES, canonicalLanguage } = await import('../src/renderer/src/components/doc/docCode')

interface Editor {
  document: Array<{ type: string; props: Record<string, unknown> }>
  replaceBlocks: (a: unknown[], b: unknown[]) => void
  tryParseMarkdownToBlocks: (markdown: string) => unknown[]
  blocksToMarkdownLossy: (blocks: unknown[]) => string
  mount: (el: HTMLElement) => void
}

const fence = (written: string, code: string) => `\`\`\`${written}\n${code}\n\`\`\`\n`

function opened(markdown: string) {
  const editor = BlockNoteEditor.create({ schema: docSchema as never }) as never as Editor
  const host = document.createElement('div')
  document.body.append(host)
  editor.mount(host)
  editor.replaceBlocks(editor.document, editor.tryParseMarkdownToBlocks(markdown))
  return { editor, host }
}

const selectIn = (host: HTMLElement) => host.querySelector('select') as HTMLSelectElement | null

const pairs = Object.entries(CODE_LANGUAGES).flatMap(([canonical, one]) =>
  (one.aliases ?? []).map(alias => [alias, canonical] as const)
)

const settle = (ms: number) => new Promise(done => setTimeout(done, ms))

const spansIn = (host: HTMLElement) =>
  (host.querySelector('[data-content-type="codeBlock"] code') as HTMLElement | null)?.querySelectorAll('span.shiki')
    .length ?? 0

describe('a code block written under a short language name', () => {
  it('names every alias crew knows', () => {
    expect(pairs.length).toBeGreaterThan(20)
    expect(pairs).toContainEqual(['bash', 'shellscript'])
    expect(pairs).toContainEqual(['ts', 'typescript'])
    expect(pairs).toContainEqual(['py', 'python'])
    expect(pairs).toContainEqual(['yml', 'yaml'])
  })

  it('resolves an alias onto the language it belongs to', () => {
    for (const [alias, canonical] of pairs) expect(canonicalLanguage(alias), alias).toBe(canonical)
    for (const key of Object.keys(CODE_LANGUAGES)) expect(canonicalLanguage(key), key).toBe(key)
  })

  it('reads the proper name in the selector for every alias', () => {
    for (const [alias, canonical] of pairs) {
      const { host } = opened(fence(alias, 'crew'))
      const select = selectIn(host)
      expect(select, alias).toBeTruthy()
      expect(select?.selectedIndex, `${alias} landed on no option`).toBeGreaterThanOrEqual(0)
      expect(select?.value, alias).toBe(canonical)
      expect(select?.selectedOptions[0]?.text, alias).toBe(CODE_LANGUAGES[canonical].name)
    }
  })

  it('reads the proper name for a language written out in full', () => {
    for (const key of Object.keys(CODE_LANGUAGES)) {
      const { host } = opened(fence(key, 'crew'))
      expect(selectIn(host)?.value, key).toBe(key)
      expect(selectIn(host)?.selectedOptions[0]?.text, key).toBe(CODE_LANGUAGES[key].name)
    }
  })

  it('leaves the fence in the file as it was written', () => {
    for (const [alias] of pairs) {
      const { editor } = opened(fence(alias, 'crew'))
      expect(editor.document[0].props.language, alias).toBe(alias)
      expect(editor.blocksToMarkdownLossy(editor.document), alias).toContain(`\`\`\`${alias}`)
    }
  })

  it('highlights an alias block the way it highlights the language written out', async () => {
    const code = 'echo "hi" | grep hi'
    const short = opened(fence('bash', code))
    const long = opened(fence('shellscript', code))
    await settle(800)
    expect(spansIn(short.host)).toBeGreaterThan(1)
    expect(spansIn(short.host)).toBe(spansIn(long.host))
  }, 20000)

  it('highlights under every alias, including the ones shiki does not answer to itself', async () => {
    const code = 'one two three'
    const under = pairs
      .filter(([, canonical]) => canonical !== 'text')
      .map(([alias, canonical]) => ({ alias, canonical, short: opened(fence(alias, code)) }))
    const full = new Map([...new Set(under.map(one => one.canonical))].map(key => [key, opened(fence(key, code))]))
    await settle(2000)
    for (const { alias, canonical, short } of under) {
      expect(spansIn(short.host), `${alias} drew nothing`).toBeGreaterThan(0)
      expect(spansIn(short.host), `${alias} against ${canonical}`).toBe(spansIn(full.get(canonical)!.host))
    }
  }, 30000)
})
