import type { StudioChatEntry, StudioDoc, StudioNode, StudioPage } from '../shared/studio'

const NODE_DEFAULTS: Record<string, unknown> = {
  parentId: null,
  rotation: 0,
  opacity: 1,
  hidden: false,
  locked: false,
  fill2: null,
  gradientAngle: 180,
  stroke: null,
  strokeWidth: 1,
  radius: 0,
  shadow: null,
  blur: 0,
  text: '',
  fontSize: 16,
  fontWeight: 400,
  font: 'sans',
  align: 'left',
  lineHeight: 1.3,
  letterSpacing: 0,
  flip: false,
  src: null,
  layout: 'none',
  gap: 0,
  padding: 0,
  clip: false
}

const PAGE_JSON_LIMIT = 90000
const CHAT_TAIL = 12

function compactNode(node: StudioNode): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(node)) {
    if (value === undefined) continue
    if (key in NODE_DEFAULTS && NODE_DEFAULTS[key] === value) continue
    if (key === 'src' && typeof value === 'string' && value.startsWith('data:')) {
      out[key] = 'data:image (kept as is)'
      continue
    }
    out[key] = value
  }
  return out
}

function pageNodes(doc: StudioDoc, page: StudioPage): Array<Record<string, unknown>> {
  return page.order
    .map(id => doc.nodes[id])
    .filter((n): n is StudioNode => n !== undefined)
    .map(compactNode)
}

export function serializePage(doc: StudioDoc, page: StudioPage): string {
  const nodes = pageNodes(doc, page)
  const json = JSON.stringify(nodes)
  if (json.length <= PAGE_JSON_LIMIT) return json
  return JSON.stringify(nodes.slice(0, 250)) + ` (${nodes.length - 250} more nodes not shown)`
}

export function serializeDoc(doc: StudioDoc): string {
  return JSON.stringify(
    doc.pages.map(page => ({ id: page.id, name: page.name, nodes: pageNodes(doc, page).slice(0, 400) }))
  )
}

function chatTail(doc: StudioDoc): string {
  const tail = doc.chat.slice(-CHAT_TAIL)
  if (tail.length === 0) return '(nothing yet)'
  return tail.map(entry => `${entry.authorName}: ${entry.text}`).join('\n')
}

export interface StudioPromptInput {
  agentLabel: string
  doc: StudioDoc
  page: StudioPage
  text: string
  byName: string
  people: string[]
  others: string[]
}

export function designPrompt(input: StudioPromptInput): string {
  const { agentLabel, doc, page, people, others } = input
  const lines = [
    `You are ${agentLabel}, a design agent working in "${doc.name}", a shared studio canvas in a crew session with ${people.join(', ')}.`,
    `You design directly on the canvas by emitting edit operations. Humans and other agents see your changes live.`
  ]
  if (others.length > 0) {
    lines.push(
      `Other agents may be designing here at the same time: ${others.join(', ')}. Only touch nodes that belong to your task.`
    )
  }
  lines.push(
    ``,
    `The canvas holds pages of nodes. Node fields:`,
    `id, type (frame | group | rect | ellipse | line | arrow | text | image | svg | icon), name, parentId, x, y, w, h, rotation, opacity (0..1), hidden, locked, fill (hex or null), fill2 (second gradient stop, makes a linear gradient with fill), gradientAngle, stroke, strokeWidth, radius (corner radius), shadow ({x, y, blur, color} or null), blur, text, fontSize, fontWeight (100..900), font (sans | mono), align (left | center | right), lineHeight, letterSpacing, src (image url or data url), layout (none | row | column), gap, padding, clip, constraints, componentId, componentProps.`,
    `A child's x and y are relative to its parent frame or group. Text nodes use fill as the text color. Lines and arrows run across their box from corner to corner.`,
    ``,
    `Current page "${page.name}" (pageId "${page.id}") nodes in paint order:`,
    serializePage(doc, page),
    ``,
    `To edit the canvas, include exactly one fenced block in your reply, shaped like this:`,
    '```studio-ops',
    `[`,
    `  { "kind": "upsert", "pageId": "${page.id}", "nodes": [ { "id": "hero", "type": "frame", "name": "Hero", "x": 0, "y": 0, "w": 1440, "h": 900, "fill": "#0e1014", "radius": 24 } ] },`,
    `  { "kind": "update", "id": "hero", "patch": { "fill": "#111318" } },`,
    `  { "kind": "remove", "ids": ["old-node-id"] }`,
    `]`,
    '```',
    `Op kinds: upsert (create or fully replace nodes), update (patch fields on one node), remove, order (full z order list for a page), page.add, page.rename, page.remove, asset.add, asset.remove, variable.set, variable.remove.`,
    ``,
    `Design rules:`,
    `- Put each screen inside one frame named after the screen. Desktop screens are 1440x900, mobile screens are 390x844.`,
    `- Leave at least 120px of empty canvas between top level frames and never overlap frames you did not create.`,
    `- Use a consistent 8px spacing scale, real copy instead of placeholder text, few colors, and strong contrast.`,
    `- Build hierarchy with nested frames and groups so every element has a sensible parent.`,
    `- Give nodes short descriptive kebab-case ids and readable names. Prefix your ids with a slug of your task so ids from different agents never collide.`,
    `- To restyle or move an existing node prefer update. To rework a section, remove it and upsert the replacement.`,
    ``,
    `Reply with one or two short sentences about what you did, plus the studio-ops block. Use no other fenced code blocks.`,
    ``,
    `Studio chat so far:`,
    chatTail(doc)
  )
  return lines.join('\n')
}

export function buildCodePrompt(input: StudioPromptInput): string {
  const { agentLabel, doc, byName, people, others } = input
  const lines = [
    `You are ${agentLabel}, an agent in a crew session with ${people.join(', ')}.`,
    `${byName} finished a design in the studio "${doc.name}" and asked for it to be built as real code.`
  ]
  if (others.length > 0) {
    lines.push(`Other agents may be building parts of this too: ${others.join(', ')}. Coordinate by keeping to your part.`)
  }
  lines.push(
    ``,
    `The design, as pages of nodes (child x and y are relative to the parent, text nodes use fill as text color):`,
    serializeDoc(doc),
    ``,
    `Turn this design into production code in the repository you are running in.`,
    `- Read AGENTS.md or CLAUDE.md first and follow the project's conventions, stack, and design tokens.`,
    `- Preserve the design's layout structure, spacing, colors, type scale, and copy.`,
    `- Reuse existing components where they fit. Create real files and wire them into the app.`,
    `- Make it responsive where the design implies it.`,
    ``,
    `Studio chat so far:`,
    chatTail(doc),
    ``,
    `When you are done, reply with a short summary of what you changed. Do not include a studio-ops block.`
  )
  return lines.join('\n')
}

export function summaryFallback(opsApplied: number): string {
  if (opsApplied === 0) return ''
  return opsApplied === 1 ? 'Made one change to the canvas.' : `Made ${opsApplied} changes to the canvas.`
}

export function agentChatEntry(
  agentId: string,
  agentLabel: string,
  text: string,
  opsApplied: number
): Omit<StudioChatEntry, 'id' | 'ts'> {
  return {
    kind: 'agent',
    authorId: agentId,
    authorName: agentLabel,
    text: text || summaryFallback(opsApplied),
    opsApplied: opsApplied > 0 ? opsApplied : undefined
  }
}
