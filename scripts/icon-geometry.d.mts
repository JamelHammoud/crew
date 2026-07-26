export type Box = {
  x: number
  y: number
  width: number
  height: number
  cx: number
  cy: number
  ink: number
  reach: number
  body: { area: number; width: number; height: number } | null
  round: boolean
}

export function samplePath(d: string, steps?: number): Array<Array<[number, number]>>
export function shapesOf(markup: string): Array<{ d: string; filled: boolean; weight: number | null }>
export function measure(markup: string, stroke?: number): Box | null
