// Node 26 declares its own localStorage, which is undefined unless the process
// was started with a file for it, and it stands in front of the one jsdom
// makes. Anything that remembers something needs one put back.
export function installLocalStorage(): Storage {
  if (globalThis.localStorage) return globalThis.localStorage
  const store = new Map<string, string>()
  const storage: Storage = {
    get length() {
      return store.size
    },
    key: index => [...store.keys()][index] ?? null,
    getItem: key => store.get(key) ?? null,
    setItem: (key, value) => void store.set(key, String(value)),
    removeItem: key => void store.delete(key),
    clear: () => store.clear()
  }
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
  return storage
}
