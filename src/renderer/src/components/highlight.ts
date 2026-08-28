import type { HighlighterCore, LanguageInput, ThemedToken } from 'shiki/core'
import { createHighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import type { Theme } from '../state/theme'

export type { ThemedToken }

const MAX_CHARS = 200_000

export const THEME_NAMES: Record<Theme, string> = {
  dark: 'dark-plus',
  light: 'light-plus',
  oled: 'dark-plus'
}

const languages: Record<string, LanguageInput> = {
  typescript: () => import('@shikijs/langs/typescript'),
  tsx: () => import('@shikijs/langs/tsx'),
  javascript: () => import('@shikijs/langs/javascript'),
  jsx: () => import('@shikijs/langs/jsx'),
  json: () => import('@shikijs/langs/json'),
  css: () => import('@shikijs/langs/css'),
  scss: () => import('@shikijs/langs/scss'),
  less: () => import('@shikijs/langs/less'),
  stylus: () => import('@shikijs/langs/stylus'),
  html: () => import('@shikijs/langs/html'),
  vue: () => import('@shikijs/langs/vue'),
  svelte: () => import('@shikijs/langs/svelte'),
  astro: () => import('@shikijs/langs/astro'),
  markdown: () => import('@shikijs/langs/markdown'),
  mdx: () => import('@shikijs/langs/mdx'),
  yaml: () => import('@shikijs/langs/yaml'),
  toml: () => import('@shikijs/langs/toml'),
  ini: () => import('@shikijs/langs/ini'),
  dotenv: () => import('@shikijs/langs/dotenv'),
  shellscript: () => import('@shikijs/langs/shellscript'),
  powershell: () => import('@shikijs/langs/powershell'),
  python: () => import('@shikijs/langs/python'),
  rust: () => import('@shikijs/langs/rust'),
  go: () => import('@shikijs/langs/go'),
  java: () => import('@shikijs/langs/java'),
  c: () => import('@shikijs/langs/c'),
  cpp: () => import('@shikijs/langs/cpp'),
  csharp: () => import('@shikijs/langs/csharp'),
  ruby: () => import('@shikijs/langs/ruby'),
  php: () => import('@shikijs/langs/php'),
  swift: () => import('@shikijs/langs/swift'),
  kotlin: () => import('@shikijs/langs/kotlin'),
  dart: () => import('@shikijs/langs/dart'),
  scala: () => import('@shikijs/langs/scala'),
  clojure: () => import('@shikijs/langs/clojure'),
  elixir: () => import('@shikijs/langs/elixir'),
  erlang: () => import('@shikijs/langs/erlang'),
  haskell: () => import('@shikijs/langs/haskell'),
  lua: () => import('@shikijs/langs/lua'),
  perl: () => import('@shikijs/langs/perl'),
  r: () => import('@shikijs/langs/r'),
  sql: () => import('@shikijs/langs/sql'),
  graphql: () => import('@shikijs/langs/graphql'),
  csv: () => import('@shikijs/langs/csv'),
  xml: () => import('@shikijs/langs/xml'),
  diff: () => import('@shikijs/langs/diff'),
  docker: () => import('@shikijs/langs/docker'),
  make: () => import('@shikijs/langs/make'),
  cmake: () => import('@shikijs/langs/cmake'),
  nginx: () => import('@shikijs/langs/nginx'),
  hcl: () => import('@shikijs/langs/hcl'),
  protobuf: () => import('@shikijs/langs/protobuf'),
  prisma: () => import('@shikijs/langs/prisma'),
  solidity: () => import('@shikijs/langs/solidity')
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
  scss: 'scss',
  sass: 'scss',
  less: 'less',
  styl: 'stylus',
  html: 'html',
  htm: 'html',
  vue: 'vue',
  svelte: 'svelte',
  astro: 'astro',
  md: 'markdown',
  markdown: 'markdown',
  mdx: 'mdx',
  yml: 'yaml',
  yaml: 'yaml',
  toml: 'toml',
  ini: 'ini',
  cfg: 'ini',
  conf: 'ini',
  env: 'dotenv',
  sh: 'shellscript',
  bash: 'shellscript',
  zsh: 'shellscript',
  fish: 'shellscript',
  ps1: 'powershell',
  psm1: 'powershell',
  py: 'python',
  pyw: 'python',
  rs: 'rust',
  go: 'go',
  java: 'java',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  cs: 'csharp',
  rb: 'ruby',
  php: 'php',
  swift: 'swift',
  kt: 'kotlin',
  kts: 'kotlin',
  dart: 'dart',
  scala: 'scala',
  sc: 'scala',
  clj: 'clojure',
  cljs: 'clojure',
  cljc: 'clojure',
  ex: 'elixir',
  exs: 'elixir',
  erl: 'erlang',
  hrl: 'erlang',
  hs: 'haskell',
  lhs: 'haskell',
  lua: 'lua',
  pl: 'perl',
  pm: 'perl',
  r: 'r',
  sql: 'sql',
  graphql: 'graphql',
  gql: 'graphql',
  csv: 'csv',
  xml: 'xml',
  svg: 'xml',
  diff: 'diff',
  patch: 'diff',
  cmake: 'cmake',
  nginx: 'nginx',
  hcl: 'hcl',
  tf: 'hcl',
  tfvars: 'hcl',
  proto: 'protobuf',
  prisma: 'prisma',
  sol: 'solidity'
}

const filenames: Record<string, string> = {
  dockerfile: 'docker',
  makefile: 'make',
  'cmakelists.txt': 'cmake'
}

export const LANGUAGE_NAMES: Record<string, string> = {
  typescript: 'TypeScript',
  tsx: 'TSX',
  javascript: 'JavaScript',
  jsx: 'JSX',
  json: 'JSON',
  css: 'CSS',
  scss: 'SCSS',
  less: 'Less',
  stylus: 'Stylus',
  html: 'HTML',
  vue: 'Vue',
  svelte: 'Svelte',
  astro: 'Astro',
  markdown: 'Markdown',
  mdx: 'MDX',
  yaml: 'YAML',
  toml: 'TOML',
  ini: 'INI',
  dotenv: 'Environment file',
  shellscript: 'Shell',
  powershell: 'PowerShell',
  python: 'Python',
  rust: 'Rust',
  go: 'Go',
  java: 'Java',
  c: 'C',
  cpp: 'C++',
  csharp: 'C#',
  ruby: 'Ruby',
  php: 'PHP',
  swift: 'Swift',
  kotlin: 'Kotlin',
  dart: 'Dart',
  scala: 'Scala',
  clojure: 'Clojure',
  elixir: 'Elixir',
  erlang: 'Erlang',
  haskell: 'Haskell',
  lua: 'Lua',
  perl: 'Perl',
  r: 'R',
  sql: 'SQL',
  graphql: 'GraphQL',
  csv: 'CSV',
  xml: 'XML',
  diff: 'Diff',
  docker: 'Dockerfile',
  make: 'Makefile',
  cmake: 'CMake',
  nginx: 'Nginx',
  hcl: 'HCL',
  protobuf: 'Protocol Buffers',
  prisma: 'Prisma',
  solidity: 'Solidity'
}

export function aliasesFor(lang: string): string[] {
  const from = (table: Record<string, string>) => Object.keys(table).filter(key => table[key] === lang)
  return [...from(extensions), ...from(filenames)]
}

export function languageFor(path: string): string | null {
  const name = (path.split('/').pop() ?? '').toLowerCase()
  const byName = filenames[name]
  if (byName) return byName
  if (name.startsWith('dockerfile.')) return 'docker'
  if (name.startsWith('makefile.')) return 'make'
  if (name === '.env' || name.startsWith('.env.')) return 'dotenv'
  const ext = name.includes('.') ? (name.split('.').pop() ?? '') : ''
  return extensions[ext] ?? null
}

let corePromise: Promise<HighlighterCore> | null = null
const loading = new Map<string, Promise<void>>()

const CACHE_CHARS = 4_000_000

export interface Highlighted {
  lines: string[]
  byLine: ThemedToken[][]
}

const cache = new Map<string, Map<string, Highlighted>>()
let cached = 0

function shelf(lang: string, theme: Theme): Map<string, Highlighted> {
  const key = `${theme} ${lang}`
  let found = cache.get(key)
  if (!found) {
    found = new Map()
    cache.set(key, found)
  }
  return found
}

function keep(shelved: Map<string, Highlighted>, text: string, byLine: ThemedToken[][]): Highlighted {
  const held: Highlighted = { lines: text.split('\n'), byLine }
  shelved.set(text, held)
  cached += text.length
  if (cached <= CACHE_CHARS) return held
  for (const other of cache.values()) {
    for (const [stale, gone] of other) {
      if (cached <= CACHE_CHARS) return held
      other.delete(stale)
      cached -= stale.length
      if (gone === held) return held
    }
  }
  return held
}

function core(): Promise<HighlighterCore> {
  corePromise ??= createHighlighterCore({
    themes: [import('@shikijs/themes/dark-plus'), import('@shikijs/themes/light-plus')],
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

export function shikiCore(): Promise<HighlighterCore> {
  return core()
}

export async function loadLanguage(lang: string): Promise<void> {
  if (!languages[lang]) return
  try {
    await withLanguage(lang)
  } catch {
    return
  }
}

export async function highlightLines(path: string, text: string, theme: Theme): Promise<Highlighted | null> {
  const lang = languageFor(path)
  if (!lang || text.length > MAX_CHARS) return null
  const shelved = shelf(lang, theme)
  const known = shelved.get(text)
  if (known) return known
  try {
    const highlighter = await withLanguage(lang)
    return keep(shelved, text, highlighter.codeToTokensBase(text, { lang, theme: THEME_NAMES[theme] }))
  } catch {
    return null
  }
}
