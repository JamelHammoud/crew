export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }
export type JsonObject = { [key: string]: JsonValue }

export type AnyValue = ReturnType<typeof JSON.parse>

export type ValidatorFn<Value> = (value: unknown) => Value
export type KnownGoodFn<Value> = (knownGoodValue: Value, newValue: unknown) => Value

export interface Validatable<Value> {
  validate(value: unknown): Value
}

export type TypeOf<V extends Validatable<unknown>> = V extends Validatable<infer Value> ? Value : never

export class ValidationError extends Error {
  constructor(
    readonly rawMessage: string,
    readonly path: ReadonlyArray<string | number> = []
  ) {
    super(path.length > 0 ? `At ${path.join('.')}: ${rawMessage}` : rawMessage)
    this.name = 'ValidationError'
  }
}

function describe(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'an array'
  return typeof value
}

function rethrow(key: string | number, error: unknown): never {
  if (error instanceof ValidationError) throw new ValidationError(error.rawMessage, [key, ...error.path])
  throw new ValidationError(error instanceof Error ? error.message : String(error), [key])
}

function owns(object: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, key)
}

export class Validator<Value> implements Validatable<Value> {
  constructor(
    readonly validationFn: ValidatorFn<Value>,
    readonly knownGoodFn?: KnownGoodFn<Value>
  ) {}

  validate(value: unknown): Value {
    return this.validationFn(value)
  }

  validateUsingKnownGoodVersion(knownGoodValue: Value, newValue: unknown): Value {
    if (Object.is(knownGoodValue, newValue)) return knownGoodValue
    if (this.knownGoodFn) return this.knownGoodFn(knownGoodValue, newValue)
    return this.validate(newValue)
  }

  isValid(value: unknown): value is Value {
    try {
      this.validate(value)
      return true
    } catch {
      return false
    }
  }

  nullable(): Validator<Value | null> {
    return new Validator(value => (value === null ? null : this.validate(value)))
  }

  optional(): Validator<Value | undefined> {
    return new Validator(value => (value === undefined ? undefined : this.validate(value)))
  }

  refine<Out>(refineFn: (value: Value) => Out): Validator<Out> {
    return new Validator(value => refineFn(this.validate(value)))
  }

  check(name: string, checkFn: (value: Value) => void): Validator<Value>
  check(checkFn: (value: Value) => void): Validator<Value>
  check(nameOrCheckFn: string | ((value: Value) => void), checkFn?: (value: Value) => void): Validator<Value> {
    const run = typeof nameOrCheckFn === 'string' ? checkFn! : nameOrCheckFn
    const label = typeof nameOrCheckFn === 'string' ? nameOrCheckFn : null
    return new Validator(value => {
      const validated = this.validate(value)
      if (label === null) run(validated)
      else {
        try {
          run(validated)
        } catch (error) {
          rethrow(`(check ${label})`, error)
        }
      }
      return validated
    })
  }
}

export class ArrayOfValidator<Item> extends Validator<Item[]> {
  constructor(readonly itemValidator: Validatable<Item>) {
    super(value => {
      if (!Array.isArray(value)) throw new ValidationError(`Expected an array, got ${describe(value)}`)
      for (let at = 0; at < value.length; at++) {
        try {
          itemValidator.validate(value[at])
        } catch (error) {
          rethrow(at, error)
        }
      }
      return value as Item[]
    })
  }

  nonEmpty(): Validator<Item[]> {
    return this.check(value => {
      if (value.length === 0) throw new ValidationError('Expected a non-empty array')
    })
  }
}

export class ObjectValidator<Shape extends object> extends Validator<Shape> {
  constructor(
    readonly config: { readonly [K in keyof Shape]: Validatable<Shape[K]> },
    readonly allowsUnknownProperties = false
  ) {
    super(value => {
      if (typeof value !== 'object' || value === null) {
        throw new ValidationError(`Expected an object, got ${describe(value)}`)
      }
      for (const key of Object.keys(config)) {
        try {
          ;(config as Record<string, Validatable<unknown>>)[key].validate((value as Record<string, unknown>)[key])
        } catch (error) {
          rethrow(key, error)
        }
      }
      if (!allowsUnknownProperties) {
        for (const key of Object.keys(value)) {
          if (!owns(config, key)) throw new ValidationError('Unexpected property', [key])
        }
      }
      return value as Shape
    })
  }

  allowUnknownProperties(): ObjectValidator<Shape> {
    return new ObjectValidator(this.config, true)
  }

  extend<Extension extends object>(
    extension: {
      readonly [K in keyof Extension]: Validatable<Extension[K]>
    }
  ): ObjectValidator<Shape & Extension> {
    return new ObjectValidator({ ...this.config, ...extension } as never) as ObjectValidator<Shape & Extension>
  }
}

export class DictValidator<Key extends string, Value> extends Validator<Record<Key, Value>> {
  constructor(
    readonly keyValidator: Validatable<Key>,
    readonly valueValidator: Validatable<Value>
  ) {
    super(value => {
      if (typeof value !== 'object' || value === null) {
        throw new ValidationError(`Expected an object, got ${describe(value)}`)
      }
      for (const key of Object.keys(value)) {
        try {
          keyValidator.validate(key)
          valueValidator.validate((value as Record<string, unknown>)[key])
        } catch (error) {
          rethrow(key, error)
        }
      }
      return value as Record<Key, Value>
    })
  }
}

export class UnionValidator<Key extends string, Config extends Record<string, Validatable<unknown>>> extends Validator<
  TypeOf<Config[keyof Config]>
> {
  constructor(
    readonly key: Key,
    readonly config: Config
  ) {
    super(value => {
      if (typeof value !== 'object' || value === null) {
        throw new ValidationError(`Expected an object, got ${describe(value)}`)
      }
      const variant = (value as Record<string, unknown>)[key]
      if (typeof variant !== 'string') {
        throw new ValidationError(`Expected a string, got ${describe(variant)}`, [key])
      }
      if (!owns(config, variant)) {
        throw new ValidationError(
          `Expected one of ${Object.keys(config)
            .map(name => JSON.stringify(name))
            .join(' or ')}, got ${JSON.stringify(variant)}`,
          [key]
        )
      }
      try {
        config[variant].validate(value)
      } catch (error) {
        rethrow(variant, error)
      }
      return value as TypeOf<Config[keyof Config]>
    })
  }
}

function typeofValidator<Value>(expected: string): Validator<Value> {
  return new Validator(value => {
    if (typeof value !== expected) throw new ValidationError(`Expected ${expected}, got ${describe(value)}`)
    return value as Value
  })
}

const unknown = new Validator(value => value)
const any: Validator<AnyValue> = new Validator(value => value as AnyValue)
const string = typeofValidator<string>('string')
const boolean = typeofValidator<boolean>('boolean')

const number = new Validator<number>(value => {
  if (typeof value !== 'number') throw new ValidationError(`Expected a number, got ${describe(value)}`)
  if (Number.isNaN(value)) throw new ValidationError('Expected a number, got NaN')
  return value
})

const finiteNumber = number.check(value => {
  if (!Number.isFinite(value)) throw new ValidationError(`Expected a finite number, got ${value}`)
})

const positiveNumber = number.check(value => {
  if (value < 0) throw new ValidationError(`Expected a positive number, got ${value}`)
})

const nonZeroNumber = number.check(value => {
  if (value <= 0) throw new ValidationError(`Expected a non-zero positive number, got ${value}`)
})

const nonZeroFiniteNumber = finiteNumber.check(value => {
  if (value === 0) throw new ValidationError('Expected a non-zero number, got 0')
})

const unitInterval = number.check(value => {
  if (value < 0 || value > 1) throw new ValidationError(`Expected a number between 0 and 1, got ${value}`)
})

const integer = number.check(value => {
  if (!Number.isInteger(value)) throw new ValidationError(`Expected an integer, got ${value}`)
})

const positiveInteger = integer.check(value => {
  if (value < 0) throw new ValidationError(`Expected a positive integer, got ${value}`)
})

const array = new Validator<unknown[]>(value => {
  if (!Array.isArray(value)) throw new ValidationError(`Expected an array, got ${describe(value)}`)
  return value
})

const unknownObject = new Validator<Record<string, unknown>>(value => {
  if (typeof value !== 'object' || value === null) {
    throw new ValidationError(`Expected an object, got ${describe(value)}`)
  }
  return value as Record<string, unknown>
})

const jsonValue: Validator<JsonValue> = new Validator<JsonValue>(value => {
  if (value === null) return value
  if (typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new ValidationError(`Expected a finite number, got ${value}`)
    return value
  }
  if (Array.isArray(value)) {
    for (let at = 0; at < value.length; at++) {
      try {
        jsonValue.validate(value[at])
      } catch (error) {
        rethrow(at, error)
      }
    }
    return value as JsonValue
  }
  if (typeof value === 'object') {
    for (const key of Object.keys(value)) {
      try {
        jsonValue.validate((value as Record<string, unknown>)[key])
      } catch (error) {
        rethrow(key, error)
      }
    }
    return value as JsonValue
  }
  throw new ValidationError(`Expected a json value, got ${describe(value)}`)
})

function literal<Value extends string | number | boolean>(expected: Value): Validator<Value> {
  return new Validator(value => {
    if (value !== expected)
      throw new ValidationError(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(value)}`)
    return value as Value
  })
}

function literalEnum<const Values extends readonly unknown[]>(...values: Values): Validator<Values[number]> {
  return setEnum(new Set(values))
}

function setEnum<Value>(values: ReadonlySet<Value>): Validator<Value> {
  return new Validator(value => {
    if (!values.has(value as Value)) {
      const allowed = Array.from(values)
        .map(one => JSON.stringify(one))
        .join(' or ')
      throw new ValidationError(`Expected ${allowed}, got ${JSON.stringify(value)}`)
    }
    return value as Value
  })
}

function object<Shape extends object>(
  config: {
    readonly [K in keyof Shape]: Validatable<Shape[K]>
  }
): ObjectValidator<Shape> {
  return new ObjectValidator(config)
}

function arrayOf<Item>(itemValidator: Validatable<Item>): ArrayOfValidator<Item> {
  return new ArrayOfValidator(itemValidator)
}

function dict<Key extends string, Value>(
  keyValidator: Validatable<Key>,
  valueValidator: Validatable<Value>
): DictValidator<Key, Value> {
  return new DictValidator(keyValidator, valueValidator)
}

function union<Key extends string, Config extends Record<string, Validatable<unknown>>>(
  key: Key,
  config: Config
): UnionValidator<Key, Config> {
  return new UnionValidator(key, config)
}

function optional<Value>(validator: Validatable<Value>): Validator<Value | undefined> {
  return new Validator(value => (value === undefined ? undefined : validator.validate(value)))
}

function nullable<Value>(validator: Validatable<Value>): Validator<Value | null> {
  return new Validator(value => (value === null ? null : validator.validate(value)))
}

function model<Value extends { readonly id: string }>(name: string, validator: Validatable<Value>): Validator<Value> {
  return new Validator(
    value => {
      try {
        return validator.validate(value)
      } catch (error) {
        const id = (value as { id?: unknown })?.id
        rethrow(typeof id === 'string' ? `${name}(id = ${id})` : name, error)
      }
    },
    (knownGoodValue, newValue) => {
      try {
        if (validator instanceof Validator) return validator.validateUsingKnownGoodVersion(knownGoodValue, newValue)
        return validator.validate(newValue)
      } catch (error) {
        const id = (newValue as { id?: unknown })?.id
        rethrow(typeof id === 'string' ? `${name}(id = ${id})` : name, error)
      }
    }
  )
}

function urlWithProtocol(protocols: ReadonlySet<string>): Validator<string> {
  return string.check(value => {
    if (value === '') return
    let url: URL
    try {
      url = new URL(value)
    } catch {
      throw new ValidationError(`Expected a valid url, got ${JSON.stringify(value)}`)
    }
    if (!protocols.has(url.protocol.toLowerCase())) {
      throw new ValidationError(`Expected a valid url, got ${JSON.stringify(value)} (invalid protocol)`)
    }
  })
}

const linkUrl = urlWithProtocol(new Set(['http:', 'https:', 'mailto:']))
const srcUrl = urlWithProtocol(new Set(['http:', 'https:', 'data:', 'asset:']))
const httpUrl = urlWithProtocol(new Set(['http:', 'https:']))

export const T = {
  Validator,
  ArrayOfValidator,
  ObjectValidator,
  DictValidator,
  UnionValidator,
  ValidationError,
  unknown,
  any,
  string,
  boolean,
  number,
  finiteNumber,
  positiveNumber,
  nonZeroNumber,
  nonZeroFiniteNumber,
  unitInterval,
  integer,
  positiveInteger,
  array,
  unknownObject,
  jsonValue,
  literal,
  literalEnum,
  setEnum,
  object,
  arrayOf,
  dict,
  union,
  optional,
  nullable,
  model,
  linkUrl,
  srcUrl,
  httpUrl
}
