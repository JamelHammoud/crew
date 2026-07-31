import { uniqueId } from './uniqueId'

export type RecordId<R extends UnknownRecord> = string & { __type__: R }

export interface BaseRecord<TypeName extends string, Id extends string> {
  readonly id: Id
  readonly typeName: TypeName
}

export type UnknownRecord = BaseRecord<string, string>

export type IdOf<R extends UnknownRecord> = R['id']

export type RecordScope = 'document' | 'session' | 'presence'

export interface StoreValidator<R extends UnknownRecord> {
  validate(record: unknown): R
  validateUsingKnownGoodVersion?(knownGoodVersion: R, record: unknown): R
}

export type EphemeralKeys<R extends UnknownRecord> = {
  [K in Exclude<keyof R, 'id' | 'typeName'>]?: boolean
}

export interface RecordTypeConfig<R extends UnknownRecord> {
  createDefaultProperties(): Omit<R, 'id' | 'typeName'>
  validator?: StoreValidator<R>
  scope?: RecordScope
  ephemeralKeys?: EphemeralKeys<R>
}

export class RecordType<R extends UnknownRecord, RequiredProperties extends keyof Omit<R, 'id' | 'typeName'>> {
  readonly typeName: R['typeName']
  readonly createDefaultProperties: () => Omit<R, 'id' | 'typeName'>
  readonly validator: StoreValidator<R>
  readonly scope: RecordScope
  readonly ephemeralKeys?: EphemeralKeys<R>
  readonly ephemeralKeySet: ReadonlySet<string>

  constructor(typeName: R['typeName'], config: RecordTypeConfig<R>) {
    this.typeName = typeName
    this.createDefaultProperties = config.createDefaultProperties
    this.validator = config.validator ?? { validate: record => record as R }
    this.scope = config.scope ?? 'document'
    this.ephemeralKeys = config.ephemeralKeys
    const ephemeralKeySet = new Set<string>()
    for (const [key, isEphemeral] of Object.entries(config.ephemeralKeys ?? {})) {
      if (isEphemeral) ephemeralKeySet.add(key)
    }
    this.ephemeralKeySet = ephemeralKeySet
  }

  create(properties: Pick<R, RequiredProperties> & Omit<Partial<R>, RequiredProperties>): R {
    const result = {
      ...this.createDefaultProperties(),
      id: (properties as Partial<R>).id ?? this.createId()
    } as Record<string, unknown>
    for (const [key, value] of Object.entries(properties)) {
      if (value !== undefined) result[key] = value
    }
    result.typeName = this.typeName
    return result as unknown as R
  }

  clone(record: R): R {
    return { ...structuredClone(record), id: this.createId() }
  }

  createId(customPart?: string): IdOf<R> {
    return (this.typeName + ':' + (customPart ?? uniqueId())) as IdOf<R>
  }

  parseId(id: IdOf<R>): string {
    if (!this.isId(id)) {
      throw new Error(`ID "${id}" is not a valid ID for type "${this.typeName}"`)
    }
    return id.slice(this.typeName.length + 1)
  }

  isId(id?: string): id is IdOf<R> {
    if (!id) return false
    for (let i = 0; i < this.typeName.length; i++) {
      if (id[i] !== this.typeName[i]) return false
    }
    return id[this.typeName.length] === ':'
  }

  isInstance(record?: UnknownRecord): record is R {
    return record?.typeName === this.typeName
  }

  withDefaultProperties<DefaultProperties extends Partial<Omit<R, 'id' | 'typeName'>>>(
    createDefaultProperties: () => DefaultProperties
  ): RecordType<R, Exclude<RequiredProperties, keyof DefaultProperties>> {
    return new RecordType<R, Exclude<RequiredProperties, keyof DefaultProperties>>(this.typeName, {
      createDefaultProperties: createDefaultProperties as () => Omit<R, 'id' | 'typeName'>,
      validator: this.validator,
      scope: this.scope,
      ephemeralKeys: this.ephemeralKeys
    })
  }

  validate(record: unknown, recordBefore?: R): R {
    if (recordBefore && this.validator.validateUsingKnownGoodVersion) {
      return this.validator.validateUsingKnownGoodVersion(recordBefore, record)
    }
    return this.validator.validate(record)
  }
}

export function createRecordType<R extends UnknownRecord>(
  typeName: R['typeName'],
  config: {
    validator?: StoreValidator<R>
    scope?: RecordScope
    ephemeralKeys?: EphemeralKeys<R>
  }
): RecordType<R, keyof Omit<R, 'id' | 'typeName'>> {
  return new RecordType<R, keyof Omit<R, 'id' | 'typeName'>>(typeName, {
    createDefaultProperties: () => ({}) as Omit<R, 'id' | 'typeName'>,
    validator: config.validator,
    scope: config.scope,
    ephemeralKeys: config.ephemeralKeys
  })
}

export function assertIdType<R extends UnknownRecord>(
  id: string | undefined,
  type: RecordType<R, never>
): asserts id is IdOf<R> {
  if (!id || !type.isId(id)) {
    throw new Error(`string ${JSON.stringify(id)} is not a valid ${type.typeName} id`)
  }
}
