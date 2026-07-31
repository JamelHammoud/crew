import type { RecordScope, UnknownRecord } from './RecordType'
import type { SerializedSchema } from './StoreSchema'
import type { SerializedStore, Store } from './Store'

export interface StoreSnapshot<R extends UnknownRecord> {
  store: SerializedStore<R>
  schema: SerializedSchema
}

export function getStoreSnapshot<R extends UnknownRecord>(
  store: Store<R>,
  scope: RecordScope | 'all' = 'document'
): StoreSnapshot<R> {
  return { store: store.serialize(scope), schema: store.schema.serialize() }
}

export function loadStoreSnapshot<R extends UnknownRecord>(store: Store<R>, snapshot: StoreSnapshot<R>): void {
  const wasEnabled = store.sideEffects.isEnabled()
  try {
    store.sideEffects.setIsEnabled(false)
    store.atomic(() => {
      store.clear()
      store.put(Object.values(snapshot.store) as R[], 'initialize')
    }, false)
  } finally {
    store.sideEffects.setIsEnabled(wasEnabled)
  }
}
