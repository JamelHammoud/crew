export interface DesignBoardMeta {
  id: string
  name: string
}

export interface DesignDocument {
  store: Record<string, unknown>
  schema: unknown
}

export interface DesignPresence {
  userId: string
  name: string
  kind: 'human' | 'agent'
  cursor: { x: number; y: number } | null
  selection: string[]
  pageId: string | null
  ts: number
}

export type DesignShapeKind =
  | 'rectangle'
  | 'ellipse'
  | 'triangle'
  | 'diamond'
  | 'star'
  | 'cloud'
  | 'hexagon'
  | 'oval'
  | 'x-box'
  | 'check-box'
  | 'text'
  | 'note'
  | 'frame'
  | 'arrow'
  | 'line'

export type DesignFill = 'none' | 'semi' | 'solid' | 'pattern'

export const DESIGN_COLORS = [
  'black',
  'grey',
  'light-violet',
  'violet',
  'blue',
  'light-blue',
  'yellow',
  'orange',
  'green',
  'light-green',
  'light-red',
  'red',
  'white'
] as const

export type DesignColor = (typeof DESIGN_COLORS)[number]

export type DesignOp =
  | {
      op: 'create'
      kind: DesignShapeKind
      x: number
      y: number
      w?: number
      h?: number
      text?: string
      color?: DesignColor
      fill?: DesignFill
      name?: string
      parent?: string
      endX?: number
      endY?: number
    }
  | {
      op: 'update'
      id: string
      x?: number
      y?: number
      w?: number
      h?: number
      text?: string
      color?: DesignColor
      fill?: DesignFill
      name?: string
    }
  | { op: 'delete'; id: string }
  | { op: 'point'; x: number; y: number }

export interface DesignOpResult {
  id?: string
  error?: string
}

export const BOARD_ID = /^[a-z0-9][a-z0-9-]*$/

export function boardCode(): string {
  const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz'
  let code = alphabet[Math.floor(Math.random() * 10)]
  for (let i = 0; i < 3; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)]
  return code
}

export function richTextOf(text: string): unknown {
  const content = text.split('\n').map(line => {
    if (!line) return { type: 'paragraph' }
    return { type: 'paragraph', content: [{ type: 'text', text: line }] }
  })
  return { type: 'doc', content }
}

export function plainTextOf(richText: unknown): string {
  const doc = richText as { content?: Array<{ content?: Array<{ text?: string }> }> } | undefined
  if (!doc?.content) return ''
  return doc.content.map(p => (p.content ?? []).map(s => s.text ?? '').join('')).join('\n')
}

export function designPreamble(apiBase: string, board: DesignBoardMeta, agentId: string): string {
  return [
    `This thread is attached to the design board "${board.name}". You can see and edit the board through a small HTTP API. Everyone watching the board sees your edits live, with your cursor moving as you work.`,
    ``,
    `Read the board first:`,
    `  curl -s ${apiBase}/design/${board.id}`,
    `That returns every shape with its id, kind, position, size, text, and color.`,
    ``,
    `Edit the board by posting a batch of ops:`,
    `  curl -s -X POST ${apiBase}/design/${board.id}/ops -H 'content-type: application/json' -d '{"agent":"${agentId}","ops":[...]}'`,
    ``,
    `Ops:`,
    `  {"op":"create","kind":"rectangle","x":0,"y":0,"w":200,"h":120,"text":"Label","color":"blue","fill":"semi"}`,
    `  {"op":"create","kind":"text","x":0,"y":-40,"w":300,"text":"Heading","color":"black"}`,
    `  {"op":"create","kind":"note","x":300,"y":0,"text":"Sticky note","color":"yellow"}`,
    `  {"op":"create","kind":"frame","x":-20,"y":-80,"w":600,"h":400,"name":"Hero section"}`,
    `  {"op":"create","kind":"arrow","x":100,"y":60,"endX":320,"endY":60,"color":"grey"}`,
    `  {"op":"update","id":"shape:abc","x":40,"w":240,"text":"New label","color":"red"}`,
    `  {"op":"delete","id":"shape:abc"}`,
    `  {"op":"point","x":150,"y":90}  (just moves your cursor)`,
    ``,
    `Shape kinds: rectangle, ellipse, triangle, diamond, star, cloud, hexagon, oval, x-box, check-box, text, note, frame, arrow, line.`,
    `Colors: ${DESIGN_COLORS.join(', ')}. Fills: none, semi, solid, pattern.`,
    `Coordinates are page pixels, y grows downward. Set "parent" to a frame id to place a shape inside that frame, using coordinates relative to the frame.`,
    `The response lists a result per op, with the new shape id for creates and an error string for anything invalid. Fix and retry only the failed ops.`,
    `Keep the agent field set to "${agentId}" so your cursor is attributed to you.`,
    `Work in small batches of a few ops so people can watch the design come together. Read the board again after big changes to see real positions.`
  ].join('\n')
}
