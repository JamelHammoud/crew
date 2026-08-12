import { createElement, type ReactNode, type SVGProps } from 'react'
import {
  CubicBezier2d,
  Edge2d,
  Geometry2d,
  Group2d,
  getVerticesCountForArcLength,
  type Geometry2dFilters,
  type Geometry2dOptions
} from '../geometry'
import { Vec, type VecLike, type VecModel } from '../math/Vec'
import { approximately, clamp, toDomPrecision } from '../math/utils'
import { getPerfectDashProps, type PerfectDashTerminal } from './dash'
import { modulate, rng } from './rng'

export interface BasePathBuilderOpts {
  strokeWidth: number
  forceSolid?: boolean
  onlyFilled?: boolean
  props?: SVGProps<SVGPathElement & SVGGElement>
}

export interface SolidPathBuilderOpts extends BasePathBuilderOpts {
  style: 'solid'
}

export interface DashedPathBuilderOpts extends BasePathBuilderOpts {
  style: 'dashed' | 'dotted'
  snap?: number
  end?: PerfectDashTerminal
  start?: PerfectDashTerminal
  lengthRatio?: number
}

export interface DrawPathBuilderDOpts {
  strokeWidth: number
  randomSeed: string
  offset?: number
  roundness?: number
  passes?: number
  onlyFilled?: boolean
}

export interface DrawPathBuilderOpts extends BasePathBuilderOpts, DrawPathBuilderDOpts {
  style: 'draw'
}

export interface NonePathBuilderOpts extends BasePathBuilderOpts {
  style: 'none'
}

export type PathBuilderOpts = SolidPathBuilderOpts | DashedPathBuilderOpts | DrawPathBuilderOpts | NonePathBuilderOpts

export interface PathBuilderCommandOpts {
  offset?: number
  roundness?: number
  mergeWithPrevious?: boolean
}

interface PathBuilderCommandInfo {
  tangentStart: VecModel
  tangentEnd: VecModel
  length: number
}

interface PathBuilderCommandBase {
  opts?: PathBuilderCommandOpts
  x: number
  y: number
  isClose: boolean
  info?: PathBuilderCommandInfo
}

export interface PathBuilderLineOpts extends PathBuilderCommandOpts {
  geometry?: Omit<Geometry2dOptions, 'isClosed'> | false
  dashStart?: PerfectDashTerminal
  dashEnd?: PerfectDashTerminal
}

interface MoveToPathBuilderCommand extends PathBuilderCommandBase {
  type: 'move'
  closeIdx: number | null
  opts?: PathBuilderLineOpts
}

interface LineToPathBuilderCommand extends PathBuilderCommandBase {
  type: 'line'
}

interface CubicBezierToPathBuilderCommand extends PathBuilderCommandBase {
  type: 'cubic'
  cp1: VecModel
  cp2: VecModel
  resolution?: number
}

export type PathBuilderCommand = MoveToPathBuilderCommand | LineToPathBuilderCommand | CubicBezierToPathBuilderCommand

export interface PathBuilderToDOpts {
  startIdx?: number
  endIdx?: number
  onlyFilled?: boolean
}

const ROUNDABLE: Record<PathBuilderCommand['type'], boolean> = { line: true, move: true, cubic: false }

function isFilledMove(command: MoveToPathBuilderCommand): boolean {
  if (command.opts?.geometry === false) return false
  return command.opts?.geometry?.isFilled ?? false
}

export class PathBuilder {
  static lineThroughPoints(points: VecLike[], opts?: PathBuilderLineOpts & { endOffsets?: number }): PathBuilder {
    const path = new PathBuilder()
    path.moveTo(points[0].x, points[0].y, { ...opts, offset: opts?.endOffsets ?? opts?.offset })
    for (let i = 1; i < points.length; i++) {
      const isLast = i === points.length - 1
      path.lineTo(points[i].x, points[i].y, isLast ? { offset: opts?.endOffsets } : undefined)
    }
    return path
  }

  static cubicSplineThroughPoints(
    points: VecLike[],
    opts?: PathBuilderLineOpts & { endOffsets?: number }
  ): PathBuilder {
    const path = new PathBuilder()
    const len = points.length
    const last = len - 2
    const k = 1.25

    path.moveTo(points[0].x, points[0].y, { ...opts, offset: opts?.endOffsets ?? opts?.offset })

    for (let i = 0; i < len - 1; i++) {
      const p0 = i === 0 ? points[0] : points[i - 1]
      const p1 = points[i]
      const p2 = points[i + 1]
      const p3 = i === last ? p2 : points[i + 2]

      let cp1x: number
      let cp1y: number
      let cp2x: number
      let cp2y: number
      if (i === 0) {
        cp1x = p0.x
        cp1y = p0.y
      } else {
        cp1x = p1.x + ((p2.x - p0.x) / 6) * k
        cp1y = p1.y + ((p2.y - p0.y) / 6) * k
      }

      let pointOpts: PathBuilderCommandOpts | undefined
      if (i === last) {
        cp2x = p2.x
        cp2y = p2.y
        pointOpts = { offset: opts?.endOffsets }
      } else {
        cp2x = p2.x - ((p3.x - p1.x) / 6) * k
        cp2y = p2.y - ((p3.y - p1.y) / 6) * k
      }

      path.cubicBezierTo(p2.x, p2.y, cp1x, cp1y, cp2x, cp2y, pointOpts)
    }

    return path
  }

  commands: PathBuilderCommand[] = []

  private lastMoveTo: MoveToPathBuilderCommand | null = null

  private requireMoveTo(): MoveToPathBuilderCommand {
    if (!this.lastMoveTo) throw new Error('Start a PathBuilder with moveTo()')
    return this.lastMoveTo
  }

  moveTo(x: number, y: number, opts?: PathBuilderLineOpts): this {
    this.lastMoveTo = { type: 'move', x, y, closeIdx: null, isClose: false, opts }
    this.commands.push(this.lastMoveTo)
    return this
  }

  lineTo(x: number, y: number, opts?: PathBuilderCommandOpts): this {
    this.requireMoveTo()
    this.commands.push({ type: 'line', x, y, isClose: false, opts })
    return this
  }

  circularArcTo(
    radius: number,
    largeArcFlag: boolean,
    sweepFlag: boolean,
    x2: number,
    y2: number,
    opts?: PathBuilderCommandOpts
  ): this {
    return this.arcTo(radius, radius, largeArcFlag, sweepFlag, 0, x2, y2, opts)
  }

  arcTo(
    rx: number,
    ry: number,
    largeArcFlag: boolean,
    sweepFlag: boolean,
    xAxisRotationRadians: number,
    x2: number,
    y2: number,
    opts?: PathBuilderCommandOpts
  ): this {
    this.requireMoveTo()

    const x1 = this.commands[this.commands.length - 1].x
    const y1 = this.commands[this.commands.length - 1].y

    if (x1 === x2 && y1 === y2) return this
    if (rx === 0 || ry === 0) return this.lineTo(x2, y2, opts)

    const phi = xAxisRotationRadians
    const sinPhi = Math.sin(phi)
    const cosPhi = Math.cos(phi)

    let rx1 = Math.abs(rx)
    let ry1 = Math.abs(ry)

    const dx = (x1 - x2) / 2
    const dy = (y1 - y2) / 2
    const x1p = cosPhi * dx + sinPhi * dy
    const y1p = -sinPhi * dx + cosPhi * dy

    const lambda = (x1p * x1p) / (rx1 * rx1) + (y1p * y1p) / (ry1 * ry1)
    if (lambda > 1) {
      const sqrtLambda = Math.sqrt(lambda)
      rx1 *= sqrtLambda
      ry1 *= sqrtLambda
    }

    const sign = largeArcFlag !== sweepFlag ? 1 : -1
    const term = rx1 * rx1 * ry1 * ry1 - rx1 * rx1 * y1p * y1p - ry1 * ry1 * x1p * x1p
    const numerator = rx1 * rx1 * y1p * y1p + ry1 * ry1 * x1p * x1p

    let radicand = term / numerator
    radicand = radicand < 0 ? 0 : radicand

    const coef = sign * Math.sqrt(radicand)
    const cxp = coef * ((rx1 * y1p) / ry1)
    const cyp = coef * (-(ry1 * x1p) / rx1)

    const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2
    const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2

    const ux = (x1p - cxp) / rx1
    const uy = (y1p - cyp) / ry1
    const vx = (-x1p - cxp) / rx1
    const vy = (-y1p - cyp) / ry1

    const startAngle = Math.atan2(uy, ux)
    let endAngle = Math.atan2(vy, vx)

    if (!sweepFlag && endAngle > startAngle) {
      endAngle -= 2 * Math.PI
    } else if (sweepFlag && endAngle < startAngle) {
      endAngle += 2 * Math.PI
    }

    const sweepAngle = endAngle - startAngle
    const approximateArcLength = Math.max(rx1, ry1) * Math.abs(sweepAngle)
    const numSegments = Math.min(4, Math.ceil(Math.abs(sweepAngle) / (Math.PI / 2)))
    const resolutionPerSegment = Math.ceil(getVerticesCountForArcLength(approximateArcLength) / numSegments)
    const anglePerSegment = sweepAngle / numSegments

    const ellipsePoint = (angle: number) => ({
      x: cx + rx1 * Math.cos(angle) * cosPhi - ry1 * Math.sin(angle) * sinPhi,
      y: cy + rx1 * Math.cos(angle) * sinPhi + ry1 * Math.sin(angle) * cosPhi
    })

    const ellipseDerivative = (angle: number) => ({
      x: -rx1 * Math.sin(angle) * cosPhi - ry1 * Math.cos(angle) * sinPhi,
      y: -rx1 * Math.sin(angle) * sinPhi + ry1 * Math.cos(angle) * cosPhi
    })

    for (let i = 0; i < numSegments; i++) {
      const theta1 = startAngle + i * anglePerSegment
      const theta2 = startAngle + (i + 1) * anglePerSegment
      const deltaTheta = theta2 - theta1

      const start = ellipsePoint(theta1)
      const end = ellipsePoint(theta2)
      const d1 = ellipseDerivative(theta1)
      const d2 = ellipseDerivative(theta2)

      const handleScale = (4 / 3) * Math.tan(deltaTheta / 4)

      const cp1x = start.x + handleScale * d1.x
      const cp1y = start.y + handleScale * d1.y
      const cp2x = end.x - handleScale * d2.x
      const cp2y = end.y - handleScale * d2.y

      const bezierOpts = i === 0 ? opts : { ...opts, mergeWithPrevious: true }
      this.cubicBezierWithResolution(end.x, end.y, cp1x, cp1y, cp2x, cp2y, bezierOpts, resolutionPerSegment)
    }

    return this
  }

  cubicBezierTo(
    x: number,
    y: number,
    cp1X: number,
    cp1Y: number,
    cp2X: number,
    cp2Y: number,
    opts?: PathBuilderCommandOpts
  ): this {
    return this.cubicBezierWithResolution(x, y, cp1X, cp1Y, cp2X, cp2Y, opts)
  }

  private cubicBezierWithResolution(
    x: number,
    y: number,
    cp1X: number,
    cp1Y: number,
    cp2X: number,
    cp2Y: number,
    opts?: PathBuilderCommandOpts,
    resolution?: number
  ): this {
    this.requireMoveTo()
    this.commands.push({
      type: 'cubic',
      x,
      y,
      cp1: { x: cp1X, y: cp1Y },
      cp2: { x: cp2X, y: cp2Y },
      isClose: false,
      opts,
      resolution
    })
    return this
  }

  close(): this {
    const lastMoveTo = this.requireMoveTo()
    const lastCommand = this.commands[this.commands.length - 1]

    if (approximately(lastMoveTo.x, lastCommand.x) && approximately(lastMoveTo.y, lastCommand.y)) {
      lastCommand.isClose = true
    } else {
      this.commands.push({ type: 'line', x: lastMoveTo.x, y: lastMoveTo.y, isClose: true })
    }

    lastMoveTo.closeIdx = this.commands.length - 1
    this.lastMoveTo = null
    return this
  }

  toD(opts: PathBuilderToDOpts = {}): string {
    const { startIdx = 0, endIdx = this.commands.length, onlyFilled = false } = opts
    const parts: (string | number)[] = []

    let isSkippingCurrentLine = false
    let didAddMove = false
    let didAddNaturalMove = false

    const addMoveIfNeeded = (i: number) => {
      if (didAddMove || i === 0) return
      didAddMove = true
      const command = this.commands[i - 1]
      parts.push('M', toDomPrecision(command.x), toDomPrecision(command.y))
    }

    for (let i = startIdx; i < endIdx; i++) {
      const command = this.commands[i]
      switch (command.type) {
        case 'move': {
          if (onlyFilled && !isFilledMove(command)) {
            isSkippingCurrentLine = true
          } else {
            isSkippingCurrentLine = false
            didAddMove = true
            didAddNaturalMove = true
            parts.push('M', toDomPrecision(command.x), toDomPrecision(command.y))
          }
          break
        }
        case 'line':
          if (isSkippingCurrentLine) break
          addMoveIfNeeded(i)
          if (command.isClose && didAddNaturalMove) {
            parts.push('Z')
          } else {
            parts.push('L', toDomPrecision(command.x), toDomPrecision(command.y))
          }
          break
        case 'cubic':
          if (isSkippingCurrentLine) break
          addMoveIfNeeded(i)
          parts.push(
            'C',
            toDomPrecision(command.cp1.x),
            toDomPrecision(command.cp1.y),
            toDomPrecision(command.cp2.x),
            toDomPrecision(command.cp2.y),
            toDomPrecision(command.x),
            toDomPrecision(command.y)
          )
          break
      }
    }
    return parts.join(' ')
  }

  toSvg(opts: PathBuilderOpts): ReactNode {
    if (opts.style === 'none') return null
    if (opts.forceSolid) return this.toSolidSvg(opts)
    switch (opts.style) {
      case 'solid':
        return this.toSolidSvg(opts)
      case 'dashed':
      case 'dotted':
        return this.toDashedSvg(opts)
      case 'draw':
        return this.toDrawSvg(opts)
    }
  }

  toPath2D(opts: PathBuilderOpts): Path2D {
    if (typeof Path2D === 'undefined') return undefined as unknown as Path2D
    if (opts.style === 'none') return new Path2D()
    if (opts.forceSolid || opts.style === 'solid') return new Path2D(this.toD({ onlyFilled: opts.onlyFilled }))
    if (opts.style === 'draw') return new Path2D(this.toDrawD(opts))
    return new Path2D(this.toD({ onlyFilled: opts.onlyFilled }))
  }

  toGeometry(): Geometry2d {
    const geometries: Geometry2d[] = []

    let current: {
      startIdx: number
      moveCommand: MoveToPathBuilderCommand
      opts?: PathBuilderLineOpts
    } | null = null

    for (let i = 0; i < this.commands.length; i++) {
      const command = this.commands[i]
      if (command.type === 'move') {
        if (current && current.opts?.geometry !== false) {
          geometries.push(
            new PathBuilderGeometry2d(this, current.startIdx, i, {
              ...current.opts?.geometry,
              isFilled: current.opts?.geometry?.isFilled ?? false,
              isClosed: current.moveCommand.closeIdx !== null
            })
          )
        }
        current = { startIdx: i, moveCommand: command, opts: command.opts }
      }
    }

    if (current && current.opts?.geometry !== false) {
      geometries.push(
        new PathBuilderGeometry2d(this, current.startIdx, this.commands.length, {
          ...current.opts?.geometry,
          isFilled: current.opts?.geometry?.isFilled ?? false,
          isClosed: current.moveCommand.closeIdx !== null
        })
      )
    }

    if (geometries.length === 0) throw new Error('PathBuilder produced no geometry')
    if (geometries.length === 1) return geometries[0]
    return new Group2d({ children: geometries })
  }

  private toSolidSvg(opts: PathBuilderOpts): ReactNode {
    return createElement('path', {
      strokeWidth: opts.strokeWidth,
      d: this.toD({ onlyFilled: opts.onlyFilled }),
      ...opts.props
    })
  }

  private toDashedSvg(opts: DashedPathBuilderOpts): ReactNode {
    const { style, strokeWidth, snap, lengthRatio } = opts
    const { markerStart, markerEnd, ...props } = opts.props ?? {}

    const parts: ReactNode[] = []

    let isCurrentPathClosed = false
    let isSkippingCurrentLine = false
    let currentLineOpts: PathBuilderLineOpts | undefined

    let currentRun: {
      startIdx: number
      endIdx: number
      isFirst: boolean
      isLast: boolean
      length: number
      lineOpts: PathBuilderLineOpts | undefined
      pathIsClosed: boolean
    } | null = null

    const addCurrentRun = () => {
      if (!currentRun) return
      const { startIdx, endIdx, isFirst, isLast, length, lineOpts, pathIsClosed } = currentRun
      currentRun = null

      if (startIdx === endIdx && this.commands[startIdx].type === 'move') return

      const start = lineOpts?.dashStart ?? opts.start
      const end = lineOpts?.dashEnd ?? opts.end
      const { strokeDasharray, strokeDashoffset } = getPerfectDashProps(length, strokeWidth, {
        style,
        snap,
        lengthRatio,
        start: isFirst ? (start ?? (pathIsClosed ? 'outset' : 'none')) : 'outset',
        end: isLast ? (end ?? (pathIsClosed ? 'outset' : 'none')) : 'outset'
      })

      parts.push(
        createElement('path', {
          key: parts.length,
          d: this.toD({ startIdx, endIdx: endIdx + 1 }),
          strokeDasharray,
          strokeDashoffset,
          markerStart: isFirst ? markerStart : undefined,
          markerEnd: isLast ? markerEnd : undefined
        })
      )
    }

    for (let i = 0; i < this.commands.length; i++) {
      const command = this.commands[i]
      const lastCommand = this.commands[i - 1]
      if (command.type === 'move') {
        isCurrentPathClosed = command.closeIdx !== null
        if (opts.onlyFilled && !isFilledMove(command)) {
          isSkippingCurrentLine = true
        } else {
          isSkippingCurrentLine = false
          currentLineOpts = command.opts
        }
        continue
      }

      if (isSkippingCurrentLine) continue

      const segmentLength = this.segmentLength(lastCommand, command)
      const isFirst = lastCommand.type === 'move'
      const isLast = command.isClose || i === this.commands.length - 1 || this.commands[i + 1]?.type === 'move'

      if (currentRun && command.opts?.mergeWithPrevious) {
        currentRun.length += segmentLength
        currentRun.endIdx = i
        currentRun.isLast = isLast
      } else {
        addCurrentRun()
        currentRun = {
          startIdx: i,
          endIdx: i,
          isFirst,
          isLast,
          length: segmentLength,
          lineOpts: currentLineOpts,
          pathIsClosed: isCurrentPathClosed
        }
      }
    }

    addCurrentRun()

    return createElement('g', { strokeWidth, ...props }, parts)
  }

  private toDrawSvg(opts: DrawPathBuilderOpts): ReactNode {
    return createElement('path', { strokeWidth: opts.strokeWidth, d: this.toDrawD(opts), ...opts.props })
  }

  toDrawD(opts: DrawPathBuilderDOpts): string {
    const {
      strokeWidth,
      randomSeed,
      offset: defaultOffset = strokeWidth / 3,
      roundness: defaultRoundness = strokeWidth * 2,
      passes = 2,
      onlyFilled = false
    } = opts

    const parts: (string | number)[] = []
    const commandInfo = this.getCommandInfo()

    const drawCommands: {
      command: PathBuilderCommand
      offsetAmount: number
      roundnessBefore: number
      roundnessAfter: number
      tangentToPrev: VecModel | undefined
      tangentToNext: VecModel | undefined
    }[] = []

    let lastMoveCommandIdx: number | null = null
    for (let i = 0; i < this.commands.length; i++) {
      const command = this.commands[i]
      const offset = command.opts?.offset ?? defaultOffset
      const roundness = command.opts?.roundness ?? defaultRoundness

      if (command.type === 'move') lastMoveCommandIdx = i

      const nextIdx = command.isClose
        ? (lastMoveCommandIdx ?? 0) + 1
        : !this.commands[i + 1] || this.commands[i + 1].type === 'move'
          ? undefined
          : i + 1

      const nextInfo =
        nextIdx !== undefined && this.commands[nextIdx] && this.commands[nextIdx]?.type !== 'move'
          ? commandInfo[nextIdx]
          : undefined

      const currentSupportsRoundness = ROUNDABLE[command.type]
      const nextSupportsRoundness = nextIdx !== undefined ? ROUNDABLE[this.commands[nextIdx].type] : false

      const currentInfo = commandInfo[i]
      const tangentToPrev = currentInfo?.tangentEnd
      const tangentToNext = nextInfo?.tangentStart

      const roundnessClampedForAngle =
        currentSupportsRoundness &&
        nextSupportsRoundness &&
        tangentToPrev &&
        tangentToNext &&
        Vec.Len2(tangentToPrev) > 0.01 &&
        Vec.Len2(tangentToNext) > 0.01
          ? modulate(
              Math.abs(Vec.AngleBetween(tangentToPrev, tangentToNext)),
              [Math.PI / 2, Math.PI],
              [roundness, 0],
              true
            )
          : 0

      const shortestDistance = Math.min(currentInfo?.length ?? Infinity, nextInfo?.length ?? Infinity)
      const offsetLimit = shortestDistance - roundnessClampedForAngle * 2
      const offsetAmount = clamp(offset, 0, offsetLimit / 4)

      const roundnessBefore = Math.min(roundnessClampedForAngle, (currentInfo?.length ?? Infinity) / 4)
      const roundnessAfter = Math.min(roundnessClampedForAngle, (nextInfo?.length ?? Infinity) / 4)

      drawCommands.push({
        command,
        offsetAmount,
        roundnessBefore,
        roundnessAfter,
        tangentToPrev: commandInfo[i]?.tangentEnd,
        tangentToNext: nextInfo?.tangentStart
      })

      if (command.isClose && lastMoveCommandIdx !== null) {
        drawCommands[lastMoveCommandIdx].roundnessAfter = roundnessAfter
      } else if (command.type === 'move') {
        lastMoveCommandIdx = i
      }
    }

    for (let pass = 0; pass < passes; pass++) {
      const random = rng(randomSeed + pass)

      let lastMoveToOffset: VecLike = { x: 0, y: 0 }
      let isSkippingCurrentLine = false
      for (const {
        command,
        offsetAmount,
        roundnessBefore,
        roundnessAfter,
        tangentToNext,
        tangentToPrev
      } of drawCommands) {
        let offset: VecLike
        if (command.isClose) {
          offset = lastMoveToOffset
        } else {
          const direction = new Vec(random(), random()).uni()
          const magnitude = Math.sqrt(Math.abs(random())) * offsetAmount
          offset = Vec.Mul(direction, magnitude)
        }

        if (command.type === 'move') {
          lastMoveToOffset = offset
          isSkippingCurrentLine = onlyFilled && !isFilledMove(command)
        }

        if (isSkippingCurrentLine) continue

        const offsetPoint = Vec.Add(command, offset)

        const endPoint =
          tangentToNext && roundnessAfter > 0 ? Vec.Mul(tangentToNext, -roundnessAfter).add(offsetPoint) : offsetPoint

        const startPoint =
          tangentToPrev && roundnessBefore > 0 ? Vec.Mul(tangentToPrev, roundnessBefore).add(offsetPoint) : offsetPoint

        const isStraight = endPoint === offsetPoint || startPoint === offsetPoint

        switch (command.type) {
          case 'move':
            parts.push('M', toDomPrecision(endPoint.x), toDomPrecision(endPoint.y))
            break
          case 'line':
            if (isStraight) {
              parts.push('L', toDomPrecision(endPoint.x), toDomPrecision(endPoint.y))
            } else {
              parts.push(
                'L',
                toDomPrecision(startPoint.x),
                toDomPrecision(startPoint.y),
                'Q',
                toDomPrecision(offsetPoint.x),
                toDomPrecision(offsetPoint.y),
                toDomPrecision(endPoint.x),
                toDomPrecision(endPoint.y)
              )
            }
            break
          case 'cubic': {
            const offsetCp1 = Vec.Add(command.cp1, offset)
            const offsetCp2 = Vec.Add(command.cp2, offset)
            const target = isStraight ? endPoint : offsetPoint
            parts.push(
              'C',
              toDomPrecision(offsetCp1.x),
              toDomPrecision(offsetCp1.y),
              toDomPrecision(offsetCp2.x),
              toDomPrecision(offsetCp2.y),
              toDomPrecision(target.x),
              toDomPrecision(target.y)
            )
            break
          }
        }
      }
    }

    return parts.join(' ')
  }

  private segmentLength(lastPoint: VecLike, command: PathBuilderCommand): number {
    switch (command.type) {
      case 'move':
        return 0
      case 'line':
        return Vec.Dist(lastPoint, command)
      case 'cubic':
        return cubicLength(
          lastPoint.x,
          lastPoint.y,
          command.cp1.x,
          command.cp1.y,
          command.cp2.x,
          command.cp2.y,
          command.x,
          command.y
        )
    }
  }

  getCommands(): readonly PathBuilderCommand[] {
    return this.commands
  }

  getCommandInfo(): Array<PathBuilderCommandInfo | undefined> {
    const commandInfo: Array<PathBuilderCommandInfo | undefined> = []
    for (let i = 1; i < this.commands.length; i++) {
      const previous = this.commands[i - 1]
      const current = this.commands[i]

      if (current.info) {
        commandInfo[i] = current.info
        continue
      }
      if (current.type === 'move') continue

      let tangentStart: Vec
      let tangentEnd: Vec
      if (current.type === 'line') {
        tangentStart = Vec.Sub(previous, current).uni()
        tangentEnd = tangentStart
      } else {
        tangentStart = Vec.Sub(current.cp1, previous).uni()
        tangentEnd = Vec.Sub(current.cp2, current).uni()
      }

      current.info = { tangentStart, tangentEnd, length: this.segmentLength(previous, current) }
      commandInfo[i] = current.info
    }
    return commandInfo
  }
}

export class PathBuilderGeometry2d extends Geometry2d {
  private segmentCache: Geometry2d[] | null = null

  constructor(
    private readonly path: PathBuilder,
    private readonly startIdx: number,
    private readonly endIdx: number,
    options: Geometry2dOptions
  ) {
    super(options)
  }

  getSegments(): Geometry2d[] {
    if (this.segmentCache) return this.segmentCache

    this.segmentCache = []
    let last = this.path.commands[this.startIdx]

    for (let i = this.startIdx + 1; i < this.endIdx; i++) {
      const command = this.path.commands[i]
      if (command.type === 'move') continue

      if (command.type === 'line') {
        this.segmentCache.push(new Edge2d({ start: Vec.From(last), end: Vec.From(command) }))
      } else {
        this.segmentCache.push(
          new CubicBezier2d({
            start: Vec.From(last),
            cp1: Vec.From(command.cp1),
            cp2: Vec.From(command.cp2),
            end: Vec.From(command),
            resolution: command.resolution
          })
        )
      }

      last = command
    }

    return this.segmentCache
  }

  override getVertices(filters?: Geometry2dFilters): Vec[] {
    const vs = this.getSegments()
      .flatMap(s => s.getVertices(filters))
      .filter((vertex, i, vertices) => {
        const prev = vertices[i - 1]
        if (!prev) return true
        return !Vec.Equals(prev, vertex)
      })

    if (this.isClosed && vs.length > 0) {
      const last = vs[vs.length - 1]
      const first = vs[0]
      if (!Vec.Equals(last, first)) vs.push(first)
    }

    return vs
  }

  override nearestPoint(point: VecLike): Vec {
    let nearest: Vec | null = null
    let nearestDistance = Infinity

    for (const segment of this.getSegments()) {
      const candidate = segment.nearestPoint(point)
      const distance = Vec.Dist2(point, candidate)
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearest = candidate
      }
    }

    if (!nearest) throw new Error('nearest point not found')
    return nearest
  }

  override toSimpleSvgPath(): string {
    return this.path.toD({ startIdx: this.startIdx, endIdx: this.endIdx })
  }
}

const T_VALUES = [-0.1252, 0.1252, -0.3678, 0.3678, -0.5873, 0.5873, -0.7699, 0.7699, -0.9041, 0.9041, -0.9816, 0.9816]
const C_VALUES = [0.2491, 0.2491, 0.2335, 0.2335, 0.2032, 0.2032, 0.1601, 0.1601, 0.1069, 0.1069, 0.0472, 0.0472]

function base3(t: number, p1: number, p2: number, p3: number, p4: number): number {
  const t1 = -3 * p1 + 9 * p2 - 9 * p3 + 3 * p4
  const t2 = t * t1 + 6 * p1 - 12 * p2 + 6 * p3
  return t * t2 - 3 * p1 + 3 * p2
}

function cubicLength(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  x4: number,
  y4: number
): number {
  const z2 = 0.5
  let sum = 0
  for (let i = 0; i < 12; i++) {
    const ct = z2 * T_VALUES[i] + z2
    const xbase = base3(ct, x1, x2, x3, x4)
    const ybase = base3(ct, y1, y2, y3, y4)
    sum += C_VALUES[i] * Math.sqrt(xbase * xbase + ybase * ybase)
  }
  return z2 * sum
}
