import type { RecordType, UnknownRecord } from './RecordType'
import type { Store } from './Store'

export type RecordValidationPhase = 'initialize' | 'createRecord' | 'updateRecord'

export interface SerializedSchema {
  schemaVersion: 2
  sequences: { [sequenceId: string]: number }
}

export interface ValidationFailure<R extends UnknownRecord> {
  store: Store<R>
  record: R
  phase: RecordValidationPhase
  recordBefore: R | null
  error: unknown
}

export interface StoreSchemaOptions<R extends UnknownRecord> {
  sequences?: { [sequenceId: string]: number }
  onValidationFailure?(failure: ValidationFailure<R>): R
}

export type StoreSchemaTypes<R extends UnknownRecord> = {
  [TypeName in R['typeName']]: RecordType<Extract<R, { typeName: TypeName }>, never>
}

export class StoreSchema<R extends UnknownRecord> {
  static create<R extends UnknownRecord>(types: StoreSchemaTypes<R>, options?: StoreSchemaOptions<R>): StoreSchema<R> {
    return new StoreSchema<R>(types, options ?? {})
  }

  constructor(
    readonly types: StoreSchemaTypes<R>,
    readonly options: StoreSchemaOptions<R>
  ) {}

  getType(typeName: string): RecordType<R, never> {
    const type = (this.types as Record<string, RecordType<R, never> | undefined>)[typeName]
    if (!type) throw new Error(`Missing definition for record type ${typeName}`)
    return type
  }

  validateRecord(store: Store<R>, record: R, phase: RecordValidationPhase, recordBefore: R | null): R {
    try {
      return this.getType(record.typeName).validate(record, recordBefore ?? undefined)
    } catch (error) {
      if (this.options.onValidationFailure) {
        return this.options.onValidationFailure({ store, record, phase, recordBefore, error })
      }
      throw error
    }
  }

  serialize(): SerializedSchema {
    return { schemaVersion: 2, sequences: { ...(this.options.sequences ?? {}) } }
  }
}
