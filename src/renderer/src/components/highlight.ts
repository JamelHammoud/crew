import type { HighlighterCore, LanguageInput, ThemedToken } from 'shiki/core'
import { createHighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import type { Theme } from '../state/theme'

export type { ThemedToken }

const MAX_CHARS = 200_000

const themeNames: Record<Theme, string> = {
  dark: 'github-dark-default',
  light: 'github-light-default'
}

const languages: Record<string, LanguageInput> = {
  typescript: () => import('@shikijs/langs/typescript'),
  tsx: () => import('@shikijs/langs/tsx'),
  javascript: () => import('@shikijs/langs/javascript'),
  jsx: () => import('@shikijs/langs/jsx'),
  json: () => import('@shikijs/langs/json'),
  css: () => import('@shikijs/langs/css'),
  html: () => import('@shikijs/langs/html'),
  markdown: () => import('@shikijs/langs/markdown'),
  yaml: () => import('@shikijs/langs/yaml'),
  toml: () => import('@shikijs/langs/toml'),
  shellscript: () => import('@shikijs/langs/shellscript'),
  python: () => import('@shikijs/langs/python'),
  rust: () => import('@shikijs/langs/rust'),
  go: () => import('@shikijs/langs/go'),
  java: () => import('@shikijs/langs/java'),
  c: () => import('@shikijs/langs/c'),
  cpp: () => import('@shikijs/langs/cpp'),
  ruby: () => import('@shikijs/langs/ruby'),
  php: () => import('@shikijs/langs/php'),
  swift: () => import('@shikijs/langs/swift'),
  kotlin: () => import('@shikijs/langs/kotlin'),
  sql: () => import('@shikijs/langs/sql'),
  xml: () => import('@shikijs/langs/xml'),
  diff: () => import('@shikijs/langs/diff'),
  docker: () => import('@shikijs/langs/docker'),
  make: () => import('@shikijs/langs/make')
}

const extensions: Record<string, string> = {
  ts: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'jsx',
  json: 'json',
  css: 'css',
  html: 'html',
  htm: 'html',
  md: 'markdown',
  markdown: 'markdown',
  yml: 'yaml',
  yaml: 'yaml',
  toml: 'toml',
  sh: 'shellscript',
  bash: 'shellscript',
  zsh: 'shellscript',
  py: 'python',
  rs: 'rust',
  go: 'go',
  java: 'java',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  hpp: 'cpp',
  rb: 'ruby',
  php: 'php',
  swift: 'swift',
  kt: 'kotlin',
  sql: 'sql',
  xml: 'xml',
  svg: 'xml',
  diff: 'diff',
  patch: 'diff'
}

const filenames: Record<string, string> = {
  dockerfile: 'docker',
  makefile: 'make'
}

export function languageFor(path: string): string | null {
  const name = (path.split('/').pop() ?? '').toLowerCase()
  const byName = filenames[name]
  if (byName) return byName
  const ext = name.includes('.') ? (name.split('.').pop() ?? '') : ''
  return extensions[ext] ?? null
}

let corePromise: Promise<HighlighterCore> | null = null
const loading = new Map<string, Promise<void>>()

function core(): Promise<HighlighterCore> {
  corePromise ??= createHighlighterCore({
    themes: [import('@shikijs/themes/github-dark-default'), import('@shikijs/themes/github-light-default')],
    langs: [],
    engine: createJavaScriptRegexEngine({ forgiving: true })
  })
  return corePromise
}

async function withLanguage(lang: string): Promise<HighlighterCore> {
  const highlighter = await core()
  if (!highlighter.getLoadedLanguages().includes(lang)) {
    let pending = loading.get(lang)
    if (!pending) {
      pending = highlighter.loadLanguage(languages[lang])
      loading.set(lang, pending)
    }
    await pending
  }
  return highlighter
}

export async function highlightLines(
  path: string,
  text: string,
  theme: Theme
): Promise<ThemedToken[][] | null> {
  const lang = languageFor(path)
  if (!lang || text.length > MAX_CHARS) return null
  try {
    const highlighter = await withLanguage(lang)
    return highlighter.codeToTokensBase(text, { lang, theme: themeNames[theme] })
  } catch {
    return null
  }
}
