const HANDLE = 24
const TALL = 44
const LINE = '.bn-inline-content, pre'

function firstLine(content: Element): DOMRect | null {
  const text = content.querySelector(LINE)
  if (!text) return null
  const range = document.createRange()
  range.selectNodeContents(text)
  const rect = Array.from(range.getClientRects()).find(line => line.height > 0)
  return rect ?? null
}

export function blockHandleOffset(block: Element): number {
  const content = block.querySelector('.bn-block-content')
  if (!content) return 0
  const line = firstLine(content) ?? content.getBoundingClientRect()
  const center = line.top - block.getBoundingClientRect().top + Math.min(line.height, TALL) / 2
  return Math.max(0, Math.round(center - HANDLE / 2))
}
