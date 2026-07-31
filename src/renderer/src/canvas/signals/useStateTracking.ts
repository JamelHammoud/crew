import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { EffectScheduler } from './effect'

export function useStateTracking<Value>(name: string, render: () => Value, deps: unknown[] = []): Value {
  const renderRef = useRef(render)
  renderRef.current = render

  const [scheduler, subscribe, getSnapshot] = useMemo(() => {
    let scheduleUpdate: null | (() => void) = null

    const subscribe = (cb: () => void) => {
      scheduleUpdate = cb
      return () => {
        scheduleUpdate = null
      }
    }

    const scheduler = new EffectScheduler<Value>(`useStateTracking(${name})`, () => renderRef.current(), {
      scheduleEffect() {
        scheduleUpdate?.()
      }
    })

    return [scheduler, subscribe, () => scheduler.scheduleCount] as const
  }, [name, ...deps])

  useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  useEffect(() => {
    scheduler.attach()
    scheduler.maybeScheduleEffect()
    return () => scheduler.detach()
  }, [scheduler])

  return scheduler.execute()
}
