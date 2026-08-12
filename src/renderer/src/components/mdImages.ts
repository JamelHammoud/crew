import { useEffect, useMemo, useRef, useState } from 'react'

const LINKED = /!\[[^\]]*\]\(\s*<?([^)\s>]+)/g
const TAGGED = /<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi

const elsewhere = (src: string): boolean => /^[a-z][a-z0-9+.-]*:/i.test(src) || src.startsWith('//')

// Every picture a page points at on this machine. What it finds is generous on
// purpose: a src picked out of a code fence is read and never used, because the
// swap lands on a drawn picture rather than on the words.
export function imagesIn(text: string): string[] {
  const found: string[] = []
  for (const pattern of [LINKED, TAGGED]) {
    for (const [, src] of text.matchAll(pattern)) {
      if (!src || src.startsWith('#') || elsewhere(src) || found.includes(src)) continue
      found.push(src)
    }
  }
  return found
}

const bare = (src: string): string => {
  const cut = src.split(/[?#]/)[0] ?? ''
  try {
    return decodeURI(cut)
  } catch {
    return cut
  }
}

// Where a picture a page points at really sits. Beside the page, unless it is
// written from the top, which is the project for a page inside it and this
// machine for one that is not.
export function imagePath(file: string, src: string): string {
  const target = bare(src)
  const local = file.startsWith('/')
  const parts = target.startsWith('/') ? target.split('/') : [...file.split('/').slice(0, -1), ...target.split('/')]
  const stack: string[] = []
  for (const part of parts) {
    if (part === '' || part === '.') continue
    if (part === '..') stack.pop()
    else stack.push(part)
  }
  const joined = stack.join('/')
  return local ? `/${joined}` : joined
}

// A page drawn in the app cannot reach a file by its path, so every picture
// beside it is read off this machine and handed over as itself.
export function useLocalImages(file: string, text: string): Record<string, string> {
  const [found, setFound] = useState<Record<string, string>>({})
  const asked = useRef(new Set<string>())
  const key = useMemo(() => imagesIn(text).join('\n'), [text])

  useEffect(() => {
    asked.current = new Set()
    setFound({})
  }, [file])

  useEffect(() => {
    let alive = true
    for (const src of key ? key.split('\n') : []) {
      if (asked.current.has(src)) continue
      asked.current.add(src)
      void window.crew
        .readFile(imagePath(file, src))
        .then(result => {
          if (alive && result?.kind === 'image') setFound(all => ({ ...all, [src]: result.url }))
        })
        .catch(() => undefined)
    }
    return () => {
      alive = false
    }
  }, [file, key])

  return found
}
