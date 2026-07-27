import { useEffect, useState, type RefObject } from 'react'

export interface SelectedRange {
  start: number
  end: number
}

export interface Spanned<T> {
  token: T
  start: number
  end: number
}

export function spanned<T extends { text: string }>(tokens: T[], at: number): Spanned<T>[] {
  let offset = at
  return tokens.map(token => {
    const start = offset
    offset += token.text.length
    return { token, start, end: offset }
  })
}

export function covers(selection: SelectedRange | null, start: number, end: number): boolean {
  return selection !== null && selection.start < end && selection.end > start
}

function sameRange(a: SelectedRange | null, b: SelectedRange | null): boolean {
  if (a === null || b === null) return a === b
  return a.start === b.start && a.end === b.end
}

export function useSelectedRange(inputRef: RefObject<HTMLTextAreaElement>): SelectedRange | null {
  const [range, setRange] = useState<SelectedRange | null>(null)
  useEffect(() => {
    const read = (): void => {
      const field = inputRef.current
      const next =
        field && document.activeElement === field && field.selectionStart !== field.selectionEnd
          ? { start: field.selectionStart, end: field.selectionEnd }
          : null
      setRange(prev => (sameRange(prev, next) ? prev : next))
    }
    read()
    document.addEventListener('selectionchange', read)
    document.addEventListener('focusin', read)
    document.addEventListener('focusout', read)
    return () => {
      document.removeEventListener('selectionchange', read)
      document.removeEventListener('focusin', read)
      document.removeEventListener('focusout', read)
    }
  }, [inputRef])
  return range
}
