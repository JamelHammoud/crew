export interface FileSearchOptions {
  query: string
  matchCase: boolean
  wholeWord: boolean
  regex: boolean
  include: string
  exclude: string
}

export interface FileReplaceTarget {
  path: string
  line: number
  column: number
  endColumn: number
}

export interface FileReplaceRequest extends FileSearchOptions {
  replacement: string
  preserveCase: boolean
  target?: FileReplaceTarget
}

export interface FileReplaceResult {
  files: number
  replacements: number
  failed: string[]
  error: string | null
}

export interface TextRange {
  start: number
  end: number
}

export interface CompiledFileSearch {
  find(text: string): TextRange[]
  accepts(path: string): boolean
}

const WORD = /[\p{L}\p{N}_]/u

function wordAt(text: string, at: number): boolean {
  const char = text[at]
  return char !== undefined && WORD.test(char)
}

function splitPatterns(value: string): string[] {
  const patterns: string[] = []
  let depth = 0
  let start = 0
  for (let at = 0; at <= value.length; at++) {
    const char = value[at]
    if (char === '{') depth++
    if (char === '}') depth = Math.max(0, depth - 1)
    if ((char === ',' && depth === 0) || at === value.length) {
      const pattern = value.slice(start, at).trim()
      if (pattern) patterns.push(pattern)
      start = at + 1
    }
  }
  return patterns
}

function braceSource(pattern: string): string {
  let source = ''
  for (let at = 0; at < pattern.length; at++) {
    if (pattern[at] !== '{') {
      source += pattern[at]
      continue
    }
    const end = pattern.indexOf('}', at + 1)
    if (end < 0) {
      source += pattern[at]
      continue
    }
    const choices = pattern.slice(at + 1, end).split(',')
    source += `(${choices.map(choice => globSource(choice)).join('|')})`
    at = end
  }
  return source
}

function globSource(pattern: string): string {
  const braced = braceSource(pattern)
  let source = ''
  for (let at = 0; at < braced.length; at++) {
    const char = braced[at]
    if (char === '(' || char === ')' || char === '|') {
      source += char
      continue
    }
    if (char === '*') {
      if (braced[at + 1] === '*') {
        source += '.*'
        at++
      } else source += '[^/]*'
      continue
    }
    if (char === '?') {
      source += '[^/]'
      continue
    }
    if (char === '[') {
      const end = braced.indexOf(']', at + 1)
      if (end >= 0) {
        const body = braced.slice(at + 1, end).replace(/^!/, '^')
        source += `[${body}]`
        at = end
        continue
      }
    }
    source += char.replace(/[\\^$+?.()|{}]/g, '\\$&')
  }
  return source
}

function glob(pattern: string): RegExp {
  const normalized = pattern.replace(/^\.\//, '').replace(/\\/g, '/')
  const source = globSource(normalized)
  return normalized.includes('/') ? new RegExp(`^${source}$`, 'i') : new RegExp(`(?:^|/)${source}(?:$|/)`, 'i')
}

function patternList(value: string): RegExp[] {
  return splitPatterns(value).map(glob)
}

export function compileFileSearch(options: FileSearchOptions): { search: CompiledFileSearch | null; error: string | null } {
  const query = options.query.slice(0, 200)
  if (!query) return { search: null, error: null }
  let expression: RegExp
  try {
    const source = options.regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    expression = new RegExp(source, `gu${options.matchCase ? '' : 'i'}`)
  } catch (error) {
    return { search: null, error: error instanceof Error ? error.message : 'Invalid expression' }
  }
  const included = patternList(options.include)
  const excluded = patternList(options.exclude)
  return {
    search: {
      accepts(path) {
        const normalized = path.replace(/\\/g, '/')
        return (included.length === 0 || included.some(rule => rule.test(normalized))) &&
          !excluded.some(rule => rule.test(normalized))
      },
      find(text) {
        const ranges: TextRange[] = []
        expression.lastIndex = 0
        for (let match = expression.exec(text); match; match = expression.exec(text)) {
          const start = match.index
          const end = start + match[0].length
          const whole = !options.wholeWord || (!wordAt(text, start - 1) && !wordAt(text, end))
          if (whole) ranges.push({ start, end })
          if (match[0].length === 0) expression.lastIndex++
        }
        return ranges
      }
    },
    error: null
  }
}

export function replacementFor(replacement: string, found: string, preserveCase: boolean): string {
  if (!preserveCase || !found) return replacement
  if (found === found.toLocaleUpperCase()) return replacement.toLocaleUpperCase()
  if (found === found.toLocaleLowerCase()) return replacement.toLocaleLowerCase()
  const title = found[0]?.toLocaleUpperCase() + found.slice(1).toLocaleLowerCase()
  if (found === title) return replacement[0]?.toLocaleUpperCase() + replacement.slice(1).toLocaleLowerCase()
  return replacement
}
