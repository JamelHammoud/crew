import { describe, expect, it } from 'vitest'
import {
  LANGUAGE_NAMES,
  THEME_NAMES,
  highlightLines,
  languageFor
} from '../src/renderer/src/components/highlight'

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
      ['page.html', '<main class="crew">Hello</main>'],
      ['style.css', '.crew { color: white; display: grid; }'],
      ['agent.py', 'def greet(name):\n    return f"Hello {name}"']
    ] as const

    for (const [path, source] of samples) {
      const highlighted = await highlightLines(path, source, 'dark')
      expect(highlighted, path).not.toBeNull()
      const colors = new Set(highlighted?.byLine.flatMap(line => line.map(token => token.color).filter(Boolean)))
      expect(colors.size, path).toBeGreaterThan(2)
      expect(colors.has('#569CD6') || colors.has('#569cd6'), path).toBe(true)
    }
  }, 20000)
})
