import type { createCodeBlockSpec } from '@blocknote/core/blocks'
import { canonicalLanguage } from './docCode'

type CodeBlockSpec = ReturnType<typeof createCodeBlockSpec>

export function withAliases(spec: CodeBlockSpec): CodeBlockSpec {
  const draw = spec.implementation.render
  return {
    ...spec,
    implementation: {
      ...spec.implementation,
      render(block, editor) {
        const drawn = draw.call(this, block, editor)
        const select = drawn.dom.querySelector('select')
        const written = block.props.language
        if (select && written) select.value = canonicalLanguage(written)
        return drawn
      }
    }
  }
}
