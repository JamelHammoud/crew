import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react'
import { setStyle } from './style'

interface MountedShape {
  foreground: HTMLElement
  background: HTMLElement | null
  culled: boolean
}

export class MountedShapeCulling {
  private shapes = new Map<string, MountedShape>()

  register(id: string, foreground: HTMLElement, background: HTMLElement | null, culled: boolean): void {
    this.shapes.set(id, { foreground, background, culled })
    this.write(this.shapes.get(id)!, culled)
  }

  unregister(id: string): void {
    this.shapes.delete(id)
  }

  update(culledIds: ReadonlySet<string>): void {
    for (const [id, shape] of this.shapes) {
      const culled = culledIds.has(id)
      if (culled === shape.culled) continue
      shape.culled = culled
      this.write(shape, culled)
    }
  }

  private write(shape: MountedShape, culled: boolean): void {
    const display = culled ? 'none' : 'block'
    setStyle(shape.foreground, 'display', display)
    setStyle(shape.background, 'display', display)
  }
}

const CullingContext = createContext<MountedShapeCulling | null>(null)

export function MountedShapeCullingProvider({ children }: { children: ReactNode }) {
  const culling = useRef<MountedShapeCulling>()
  if (!culling.current) culling.current = new MountedShapeCulling()
  return <CullingContext.Provider value={culling.current}>{children}</CullingContext.Provider>
}

export function useMountedShapeCulling(): {
  register(id: string, foreground: HTMLElement, background: HTMLElement | null, culled: boolean): void
  unregister(id: string): void
  update(culledIds: ReadonlySet<string>): void
} {
  const culling = useContext(CullingContext)
  if (!culling) throw new Error('useMountedShapeCulling requires MountedShapeCullingProvider')
  const register = useCallback(
    (id: string, foreground: HTMLElement, background: HTMLElement | null, culled: boolean) =>
      culling.register(id, foreground, background, culled),
    [culling]
  )
  const unregister = useCallback((id: string) => culling.unregister(id), [culling])
  const update = useCallback((ids: ReadonlySet<string>) => culling.update(ids), [culling])
  return useMemo(() => ({ register, unregister, update }), [register, unregister, update])
}
