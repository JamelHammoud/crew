import { isComputed } from './isComputed'
import type { Child, Parent } from './types'

type ChangeTree = { [name: string]: ChangeTree | null }

export function captureAncestorEpochs(child: Child, ancestorEpochs: Map<Parent, number>): Map<Parent, number> {
  for (let i = 0; i < child.parents.length; i++) {
    const parent = child.parents[i]
    ancestorEpochs.set(parent, child.parentEpochs[i])
    if (isComputed(parent)) captureAncestorEpochs(parent as unknown as Child, ancestorEpochs)
  }
  return ancestorEpochs
}

function collectChangedAncestors(child: Child, ancestorEpochs: Map<Parent, number>): ChangeTree {
  const changeTree: ChangeTree = {}
  for (let i = 0; i < child.parents.length; i++) {
    const parent = child.parents[i]
    if (!ancestorEpochs.has(parent)) continue
    if (parent.lastChangedEpoch === ancestorEpochs.get(parent)) continue
    if (isComputed(parent)) {
      changeTree[parent.name] = collectChangedAncestors(parent as unknown as Child, ancestorEpochs)
    } else {
      changeTree[parent.name] = null
    }
  }
  return changeTree
}

export function logChangedAncestors(child: Child, ancestorEpochs: Map<Parent, number>): void {
  const changeTree = collectChangedAncestors(child, ancestorEpochs)
  if (Object.keys(changeTree).length === 0) {
    console.log(`Effect(${child.name}) was executed manually.`)
    return
  }
  let str = isComputed(child)
    ? `Computed(${child.name}) is recomputing because:`
    : `Effect(${child.name}) is executing because:`
  const logParent = (tree: ChangeTree, indent: number): void => {
    const indentStr = '\n' + ' '.repeat(indent) + '↳ '
    for (const [name, val] of Object.entries(tree)) {
      if (val) {
        str += `${indentStr}Computed(${name}) changed`
        logParent(val, indent + 2)
      } else {
        str += `${indentStr}Atom(${name}) changed`
      }
    }
  }
  logParent(changeTree, 1)
  console.log(str)
}
