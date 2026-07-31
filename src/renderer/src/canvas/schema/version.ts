export const SCHEMA_VERSION = 2

export const SEQUENCES: Readonly<Record<string, number>> = {
  'com.crew.canvas.store': 1,
  'com.crew.canvas.asset': 1,
  'com.crew.canvas.camera': 1,
  'com.crew.canvas.document': 1,
  'com.crew.canvas.instance': 1,
  'com.crew.canvas.instance_page_state': 1,
  'com.crew.canvas.page': 1,
  'com.crew.canvas.instance_presence': 1,
  'com.crew.canvas.pointer': 1,
  'com.crew.canvas.shape': 1,
  'com.crew.canvas.user': 1,
  'com.crew.canvas.binding': 1
}

export interface SerializedSchema {
  schemaVersion: number
  sequences: Record<string, number>
}

export function baselineSchema(): SerializedSchema {
  return { schemaVersion: SCHEMA_VERSION, sequences: { ...SEQUENCES } }
}

export function isKnownSchema(schema: unknown): schema is SerializedSchema {
  const block = schema as SerializedSchema | null | undefined
  if (!block || typeof block !== 'object') return false
  if (block.schemaVersion !== SCHEMA_VERSION) return false
  if (!block.sequences || typeof block.sequences !== 'object') return false
  for (const version of Object.values(block.sequences)) if (!Number.isInteger(version) || version < 0) return false
  return true
}

export function acceptSchema(schema: unknown): SerializedSchema | null {
  if (schema === null || schema === undefined) return null
  if (!isKnownSchema(schema)) {
    throw new Error('This board was written by a newer Crew and cannot be opened here')
  }
  return schema
}
