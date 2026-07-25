import { createContext, useContext } from 'react'
import type { Editor } from 'tldraw'

export const DesignEditorContext = createContext<Editor | null>(null)

export function useDesignEditor(): Editor | null {
  return useContext(DesignEditorContext)
}
