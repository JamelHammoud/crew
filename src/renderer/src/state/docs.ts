import { create } from 'zustand'
import { ROOT_PAGE } from '../../../shared/docs'
import type { DocEditorHandle } from '../components/DocEditor'

type DocsState = {
  page: string
  fresh: boolean
  editor: DocEditorHandle | null
  open(page: string, fresh?: boolean): void
  took(): void
  hold(editor: DocEditorHandle | null): void
}

export const useDocs = create<DocsState>(set => ({
  page: ROOT_PAGE,
  fresh: false,
  editor: null,
  open: (page, fresh = false) => set({ page, fresh }),
  took: () => set(state => (state.fresh ? { fresh: false } : state)),
  hold: editor => set({ editor })
}))
