import { useEffect } from 'react'
import { EffectScheduler } from './effect'
import { EMPTY_ARRAY } from './graph'

export function useQuickReactor(name: string, reactFn: () => void, deps: unknown[] = EMPTY_ARRAY): void {
  useEffect(() => {
    const scheduler = new EffectScheduler(name, reactFn)
    scheduler.attach()
    scheduler.execute()
    return () => scheduler.detach()
  }, deps)
}
