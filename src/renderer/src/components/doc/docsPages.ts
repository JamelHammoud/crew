import { pageCode, pageCodeOf, pageSlug } from '../../../../shared/docs'
import { useDocs } from '../../state/docs'
import { useCrew } from '../../state/store'

export function freshSlug(docs: Record<string, unknown>, parent: string, base: string): string {
  const taken = new Set(Object.keys(docs).map(pageCodeOf))
  let code = pageCode()
  while (taken.has(code)) code = pageCode()
  return pageSlug(parent, base, code)
}

export function createDocPage(parent: string): string {
  const { docs, updateDoc } = useCrew.getState()
  const slug = freshSlug(docs, parent, 'untitled')
  updateDoc(slug, '', '')
  useDocs.getState().open(slug, true)
  return slug
}
