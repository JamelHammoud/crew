export {
  createEmptyRecordsDiff,
  hasAnyKey,
  isRecordsDiffEmpty,
  reverseRecordsDiff,
  squashRecordDiffs,
  squashRecordDiffsMutable
} from './RecordsDiff'
export type { RecordsDiff } from './RecordsDiff'

export { assertIdType, createRecordType, RecordType } from './RecordType'
export type {
  BaseRecord,
  EphemeralKeys,
  IdOf,
  RecordId,
  RecordScope,
  RecordTypeConfig,
  StoreValidator,
  UnknownRecord
} from './RecordType'

export { StoreSchema } from './StoreSchema'
export type {
  RecordValidationPhase,
  SerializedSchema,
  StoreSchemaOptions,
  StoreSchemaTypes,
  ValidationFailure
} from './StoreSchema'

export { Store } from './Store'
export type {
  ChangeSource,
  HistoryEntry,
  SerializedStore,
  StoreConfig,
  StoreListener,
  StoreListenerFilters
} from './Store'

export { SideEffectManager } from './SideEffectManager'
export type {
  AfterChangeHandler,
  AfterCreateHandler,
  AfterDeleteHandler,
  BeforeChangeHandler,
  BeforeCreateHandler,
  BeforeDeleteHandler,
  OperationCompleteHandler
} from './SideEffectManager'

export { getStoreSnapshot, loadStoreSnapshot } from './snapshot'
export type { StoreSnapshot } from './snapshot'

export { HistoryManager } from './HistoryManager'
export type { HistoryStackEntry } from './HistoryManager'

export { uniqueId } from './uniqueId'
