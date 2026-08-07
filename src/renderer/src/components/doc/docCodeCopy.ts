import type { createCodeBlockSpec } from '@blocknote/core/blocks'

type CodeBlockSpec = ReturnType<typeof createCodeBlockSpec>

const SAID_MS = 1200

function copyPill(read: () => string) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'doc-code-copy'
  button.textContent = 'Copy'
  let said = 0
  const hold = (event: MouseEvent) => event.preventDefault()
  const press = (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    void navigator.clipboard?.writeText(read()).then(() => {
      button.textContent = 'Copied'
      window.clearTimeout(said)
      said = window.setTimeout(() => {
        button.textContent = 'Copy'
      }, SAID_MS)
    })
  }
  button.addEventListener('mousedown', hold)
  button.addEventListener('click', press)
  return {
    button,
    stop: () => {
      window.clearTimeout(said)
      button.removeEventListener('mousedown', hold)
      button.removeEventListener('click', press)
    }
  }
}

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
        const { button, stop } = copyPill(() => code.textContent ?? '')
        controlsIn(drawn.dom).append(button)
        return {
          ...drawn,
          ignoreMutation: mutation =>
            button.contains(mutation.target) || (drawn.ignoreMutation?.(mutation) ?? false),
          destroy: () => {
            stop()
            drawn.destroy?.()
          }
        }
      }
    }
  }
}
