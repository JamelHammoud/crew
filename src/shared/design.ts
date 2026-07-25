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

export const DESIGN_COLOR_CHOICES = DESIGN_COLORS.filter(
  color => color !== 'violet' && color !== 'light-violet'
) as readonly DesignColor[]

export interface DesignSwatch {
  name: string
  hex: string
}

export const CREW_SWATCHES: readonly DesignSwatch[] = [
  { name: 'Sunken', hex: '#0d0d0d' },
  { name: 'Background', hex: '#141414' },
  { name: 'Raised', hex: '#222222' },
  { name: 'Border', hex: '#272727' },
  { name: 'Hairline', hex: '#ffffff14' },
  { name: 'White', hex: '#ffffff' },
  { name: 'Secondary', hex: '#b3b3b3' },
  { name: 'Muted', hex: '#707070' },
  { name: 'Faint', hex: '#4a4a4a' },
  { name: 'Positive', hex: '#4ade80' },
  { name: 'Danger', hex: '#f87171' }
]

export const NEW_FILL = '#222222'
export const NEW_STROKE = '#ffffff26'

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
  | ({ op: 'node'; x: number; y: number; parent?: string } & DesignNodeInput)
  | ({ op: 'set'; id: string; x?: number; y?: number } & DesignNodeInput)

export interface DesignNodeInput {
  w?: number
  h?: number
  name?: string
  text?: string
  radius?: number | number[]
  fills?: unknown[]
  strokes?: unknown[]
  effects?: unknown[]
  layout?: unknown
  type?: unknown
  clip?: boolean
  mask?: boolean
  blend?: string
}

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
    `Work in small batches of a few ops so people can watch the design come together. Read the board again after big changes to see real positions.`,
    ``,
    DESIGN_NODE_GUIDE
  ].join('\n')
}

export const DESIGN_NODE_GUIDE = [
  `## Designing real interfaces`,
  ``,
  `The shape kinds above are sketching tools. When you are asked to design an interface, a screen, a component, or anything that should look finished, use nodes instead. A node is a box with real design properties: any hex color, gradients, corner radius, borders, shadows, blur, typography, and auto layout.`,
  ``,
  `  {"op":"node","x":0,"y":0,"w":360,"h":220,"name":"Card",`,
  `   "radius":20,`,
  `   "fills":[{"type":"solid","color":"#141414","opacity":1}],`,
  `   "strokes":[{"color":"#ffffff14","weight":1,"align":"inside","style":"solid"}],`,
  `   "effects":[{"type":"shadow","x":0,"y":8,"blur":24,"spread":-4,"color":"#00000059"}],`,
  `   "layout":{"direction":"column","gap":12,"padding":[20,20,20,20],"align":"start","justify":"start"}}`,
  ``,
  `  {"op":"node","x":20,"y":20,"w":280,"name":"Title","text":"Weekly revenue",`,
  `   "fills":[],`,
  `   "type":{"family":"sans","size":20,"weight":600,"lineHeight":1.3,"color":"#ffffff"}}`,
  ``,
  `  {"op":"set","id":"shape:abc","radius":[20,20,0,0],"fills":[{"type":"linear","angle":160,"stops":[{"color":"#1e293b","at":0},{"color":"#0f172a","at":1}],"opacity":1}]}`,
  ``,
  `Paints: solid, linear, radial. Fills are a stack, first paint is on top.`,
  `Effects: shadow, inner-shadow, layer-blur, background-blur.`,
  `Radius takes one number or four: [topLeft, topRight, bottomRight, bottomLeft].`,
  `Layout direction row or column turns a node into an auto layout container: children flow with gap and padding instead of being placed by hand. Use it for anything stacked or in a row.`,
  `Colors are 6 or 8 digit hex. The 8th and 7th digits are alpha, so #ffffff14 is a faint white line.`,
  `Set "clip":true to hide anything overflowing, which is how you mask an image to a rounded corner.`,
  ``,
  `## Taste rules`,
  ``,
  `Follow these unless you are asked for something else. They are the difference between a wireframe and a design.`,
  ``,
  `1. Space on a scale of 4. Use 4, 8, 12, 16, 20, 24, 32, 48, 64. Never invent 13 or 27.`,
  `2. Pick one type ramp and stay in it. For example 32/600 display, 20/600 title, 14/400 body, 12/500 label, 11/500 caption. Body text is never bold. Long text sits at lineHeight 1.5, headings at 1.2.`,
  `3. Build depth with value, not with borders. Layer a slightly lighter surface on a darker one. Use one hairline border at most, around #ffffff14 on dark and #00000014 on light.`,
  `4. One accent color. Everything else is a neutral. If you use accent on a fill, do not also use it on text next to it.`,
  `5. Body text needs real contrast against its background. Secondary text is dimmer, never smaller than 12.`,
  `6. Corner radius is consistent across a screen. Nested radius is smaller than its parent, roughly parent radius minus the padding.`,
  `7. Shadows are soft, low opacity, and pushed down. y is positive, blur is large, spread is negative or zero. No hard black shadows.`,
  `8. A background blur needs something behind it. Put a gradient or an image under a blurred panel or it reads as flat grey.`,
  `9. Align to a grid. Things that belong together share an edge.`,
  `10. Give every node a name that says what it is, like "Nav" or "Price row", not "Rectangle 4".`,
  ``,
  `## How to work`,
  ``,
  `Start with the outermost frame and its background, then lay in the major regions, then the content inside them, then the detail. Read the board back after each stage so you are placing things against real positions rather than guesses. Do not draw a grey box and call it done.`
].join('\n')
