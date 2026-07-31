import { forwardRef, memo } from 'react'
import type { ComponentProps, FunctionComponent, NamedExoticComponent } from 'react'
import { useStateTracking } from './useStateTracking'

export const ReactMemoSymbol = Symbol.for('react.memo')
export const ReactForwardRefSymbol = Symbol.for('react.forward_ref')

export const ProxyHandlers: ProxyHandler<FunctionComponent<any>> = {
  apply(Component, thisArg, argumentsList) {
    return useStateTracking(Component.displayName ?? Component.name ?? 'tracked(???)', () =>
      Component.apply(thisArg, argumentsList as [any, any])
    )
  }
}

export function track<T extends FunctionComponent<any>>(baseComponent: T): NamedExoticComponent<ComponentProps<T>> {
  let compare: ((a: any, b: any) => boolean) | null = null
  const kind = (baseComponent as any)['$$typeof']

  if (kind === ReactMemoSymbol) {
    baseComponent = (baseComponent as any).type
    compare = (baseComponent as any).compare
  }

  if (kind === ReactForwardRefSymbol) {
    const render = (baseComponent as any).render as FunctionComponent<any>
    return memo(forwardRef(new Proxy(render, ProxyHandlers) as any)) as unknown as NamedExoticComponent<
      ComponentProps<T>
    >
  }

  return memo(new Proxy(baseComponent, ProxyHandlers), compare ?? undefined) as unknown as NamedExoticComponent<
    ComponentProps<T>
  >
}
