import type { Connection } from '../state/store'

export type FirstBoard = 'have' | 'wait' | 'make'

export function firstBoard(connection: Connection, boards: number, asked: boolean): FirstBoard {
  if (boards > 0) return 'have'
  if (connection !== 'online' || asked) return 'wait'
  return 'make'
}
