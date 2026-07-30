import { useEffect, useRef, useState } from 'react'

export interface Reading<T> {
  data: T | null
  failed: boolean
}

export function useRead<T>(url: string, read: (bytes: ArrayBuffer) => T | Promise<T>): Reading<T> {
  const [state, setState] = useState<Reading<T>>({ data: null, failed: false })
  const reader = useRef(read)
  reader.current = read

  useEffect(() => {
    let alive = true
    setState({ data: null, failed: false })
    fetch(url)
      .then(res => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(String(res.status)))))
      .then(bytes => reader.current(bytes))
      .then(data => {
        if (alive) setState({ data, failed: false })
      })
      .catch(() => {
        if (alive) setState({ data: null, failed: true })
      })
    return () => {
      alive = false
    }
  }, [url])

  return state
}
