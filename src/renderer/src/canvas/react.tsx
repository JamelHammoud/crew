import { createContext, useContext } from 'react'
import { Editor } from './editor/Editor'
import { useValue } from './signals'

export const EditorContext = createContext<Editor | null>(null)

export function useMaybeEditor(): Editor | null {
  return useContext(EditorContext)
}

export function useEditor(): Editor {
  const editor = useMaybeEditor()
  if (!editor) throw new Error('This component needs a canvas editor')
  return editor
}

export function useCanUndo(): boolean {
  const editor = useEditor()
  return useValue('canvas can undo', () => editor.history.getNumUndos() > 0, [editor])
}

export function useCanRedo(): boolean {
  const editor = useEditor()
  return useValue('canvas can redo', () => editor.history.getNumRedos() > 0, [editor])
}
