import { describe, expect, it } from 'vitest'
import { carryTokens } from '../src/renderer/src/components/codeLine'
import { LANGUAGE_NAMES, THEME_NAMES, highlightLines, languageFor } from '../src/renderer/src/components/highlight'

describe('code highlighting', () => {
  it('uses the syntax palettes inherited by VS Code Modern', () => {
    expect(THEME_NAMES).toEqual({ dark: 'dark-plus', light: 'light-plus', oled: 'dark-plus' })
  })

  it('recognizes language and project file names across common stacks', () => {
    expect(LANGUAGE_NAMES).toMatchObject({
      html: 'HTML',
      css: 'CSS',
      python: 'Python',
      csharp: 'C#',
      dart: 'Dart',
      graphql: 'GraphQL',
      hcl: 'HCL',
      protobuf: 'Protocol Buffers',
      vue: 'Vue'
    })
    expect(Object.keys(LANGUAGE_NAMES).length).toBeGreaterThanOrEqual(50)
    expect(languageFor('src/App.vue')).toBe('vue')
    expect(languageFor('styles/site.scss')).toBe('scss')
    expect(languageFor('server/main.py')).toBe('python')
    expect(languageFor('infra/main.tf')).toBe('hcl')
    expect(languageFor('api/service.proto')).toBe('protobuf')
    expect(languageFor('Dockerfile.dev')).toBe('docker')
    expect(languageFor('Makefile.release')).toBe('make')
    expect(languageFor('.env.staging.local')).toBe('dotenv')
  })

  it('draws distinct VS Code colors for HTML, CSS, and Python', async () => {
    const samples = [
      ['page.html', '<main class="crew">Hello</main>', '#569CD6'],
      ['style.css', '.crew { color: white; display: grid; }', '#D7BA7D'],
      ['agent.py', 'def greet(name):\n    return f"Hello {name}"', '#C586C0']
    ] as const

    for (const [path, source, expected] of samples) {
      const highlighted = await highlightLines(path, source, 'dark')
      expect(highlighted, path).not.toBeNull()
      const colors = new Set(highlighted?.byLine.flatMap(line => line.map(token => token.color).filter(Boolean)))
      expect(colors.size, path).toBeGreaterThan(2)
      expect(
        [...colors].map(color => color?.toUpperCase()),
        path
      ).toContain(expected)
    }
  }, 20000)

  it('keeps the current token colors while a deferred pass catches up', () => {
    const carried = carryTokens('const agents = 12', [
      { content: 'const', color: '#569CD6', offset: 0 },
      { content: ' agent', color: '#9CDCFE', offset: 5 },
      { content: ' = ', color: '#D4D4D4', offset: 11 },
      { content: '12', color: '#B5CEA8', offset: 14 }
    ])
    expect(carried.map(token => token.content).join('')).toBe('const agents = 12')
    expect(carried.find(token => token.content === 'const')?.color).toBe('#569CD6')
    expect(carried.at(-1)?.color).toBe('#B5CEA8')
  })
})
