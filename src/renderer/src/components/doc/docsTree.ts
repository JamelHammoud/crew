import { ROOT_PAGE } from '../../../../shared/docs'

export interface PageNode {
  slug: string
  children: PageNode[]
}

export function parentOf(slug: string): string {
  const idx = slug.lastIndexOf('/')
  return idx === -1 ? '' : slug.slice(0, idx)
}

export function lastSegment(slug: string): string {
  return slug.split('/').pop()!
}

export function trailOf(slug: string): string[] {
  const trail: string[] = []
  for (let parent = parentOf(slug); parent; parent = parentOf(parent)) trail.unshift(parent)
  return trail
}

export function buildTree(slugs: string[]): PageNode[] {
  const root: PageNode[] = []
  const byPath = new Map<string, PageNode>()
  const ensure = (slug: string): PageNode => {
    const found = byPath.get(slug)
    if (found) return found
    const node: PageNode = { slug, children: [] }
    byPath.set(slug, node)
    const parent = parentOf(slug)
    if (parent) ensure(parent).children.push(node)
    else root.push(node)
    return node
  }
  for (const slug of [...slugs].sort()) ensure(slug)
  root.sort((a, b) => (a.slug === ROOT_PAGE ? -1 : b.slug === ROOT_PAGE ? 1 : a.slug.localeCompare(b.slug)))
  return root
}
