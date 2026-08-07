import type { createCodeBlockSpec } from '@blocknote/core/blocks'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import CopyButton from '../CopyButton'

type CodeBlockSpec = ReturnType<typeof createCodeBlockSpec>

function controlsIn(dom: HTMLElement | DocumentFragment) {
  const found = dom.querySelector('div')
  if (found) return found
  const row = document.createElement('div')
  row.contentEditable = 'false'
  dom.prepend(row)
  return row
}

export function withCopy(spec: CodeBlockSpec): CodeBlockSpec {
  const draw = spec.implementation.render
  return {
    ...spec,
    implementation: {
      ...spec.implementation,
      render(block, editor) {
        const drawn = draw.call(this, block, editor)
        const code = drawn.contentDOM
        if (!code || !('renderType' in this) || this.renderType !== 'nodeView') return drawn
        const slot = document.createElement('span')
        slot.className = 'doc-code-copy'
        slot.contentEditable = 'false'
        controlsIn(drawn.dom).append(slot)
        const root = createRoot(slot)
        root.render(createElement(CopyButton, { text: () => code.textContent ?? '', className: 'flex' }))
        return {
          ...drawn,
          ignoreMutation: mutation => slot.contains(mutation.target) || (drawn.ignoreMutation?.(mutation) ?? false),
          destroy: () => {
            queueMicrotask(() => root.unmount())
            drawn.destroy?.()
          }
        }
      }
    }
  }
}
