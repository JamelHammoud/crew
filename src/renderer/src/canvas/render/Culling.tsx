import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import { EffectScheduler } from '../signals'
import { setStyle } from './style'

interface MountedShape {
  foreground: HTMLElement
  background: HTMLElement | null
  culled: boolean
}

export class MountedShapeCulling {
  private shapes = new Map<string, MountedShape>()
  private culled: ReadonlySet<string> = new Set()

  register(id: string, foreground: HTMLElement, background: HTMLElement | null): void {
    const culled = this.culled.has(id)
    const shape = { foreground, background, culled }
    this.shapes.set(id, shape)
    this.write(shape, culled)
  }

  unregister(id: string): void {
    this.shapes.delete(id)
  }

  update(culledIds: ReadonlySet<string>): void {
    this.culled = culledIds
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
  register(id: string, foreground: HTMLElement, background: HTMLElement | null): void
  unregister(id: string): void
  update(culledIds: ReadonlySet<string>): void
} {
  const culling = useContext(CullingContext)
  if (!culling) throw new Error('useMountedShapeCulling requires MountedShapeCullingProvider')
  const register = useCallback(
    (id: string, foreground: HTMLElement, background: HTMLElement | null) =>
      culling.register(id, foreground, background),
    [culling]
  )
  const unregister = useCallback((id: string) => culling.unregister(id), [culling])
  const update = useCallback((ids: ReadonlySet<string>) => culling.update(ids), [culling])
  return useMemo(() => ({ register, unregister, update }), [register, unregister, update])
}

export function useCullingReactor(name: string, reactFn: () => void, deps: unknown[]): void {
  useLayoutEffect(() => {
    const scheduler = new EffectScheduler(name, reactFn)
    scheduler.attach()
    scheduler.execute()
    return () => scheduler.detach()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
