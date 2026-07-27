import type { MouseEvent, RefObject } from 'react'

export function clickToFocus<T extends HTMLElement>(ref: RefObject<T | null>) {
  return (event: MouseEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.target as Node)) return
    ref.current?.focus()
  }
}
