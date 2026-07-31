import { useState } from 'react'
import { atom } from './atom'
import type { Atom, AtomOptions } from './types'

export function useAtom<Value, Diff = unknown>(
  name: string,
  valueOrInitialiser: Value | (() => Value),
  options?: AtomOptions<Value, Diff>
): Atom<Value, Diff> {
  return useState(() => {
    const initialValue =
      typeof valueOrInitialiser === 'function' ? (valueOrInitialiser as () => Value)() : valueOrInitialiser
    return atom(`useAtom(${name})`, initialValue, options)
  })[0]
}
