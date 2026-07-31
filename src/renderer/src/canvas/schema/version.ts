export const SCHEMA_VERSION = 2

export const SEQUENCES: Readonly<Record<string, number>> = {
  'com.tldraw.store': 5,
  'com.tldraw.asset': 1,
  'com.tldraw.camera': 1,
  'com.tldraw.document': 2,
  'com.tldraw.instance': 26,
  'com.tldraw.instance_page_state': 5,
  'com.tldraw.page': 1,
  'com.tldraw.instance_presence': 6,
  'com.tldraw.pointer': 1,
  'com.tldraw.shape': 4,
  'com.tldraw.user': 1,
  'com.tldraw.asset.image': 6,
  'com.tldraw.asset.video': 5,
  'com.tldraw.asset.bookmark': 2,
  'com.tldraw.shape.group': 0,
  'com.tldraw.shape.text': 4,
  'com.tldraw.shape.bookmark': 2,
  'com.tldraw.shape.draw': 5,
  'com.tldraw.shape.geo': 11,
  'com.tldraw.shape.note': 13,
  'com.tldraw.shape.line': 5,
  'com.tldraw.shape.frame': 1,
  'com.tldraw.shape.arrow': 8,
  'com.tldraw.shape.highlight': 4,
  'com.tldraw.shape.embed': 4,
  'com.tldraw.shape.image': 5,
  'com.tldraw.shape.video': 4,
  'com.tldraw.shape.design-node': 0,
  'com.tldraw.binding.arrow': 1
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
  for (const [id, version] of Object.entries(block.sequences)) {
    const known = SEQUENCES[id]
    if (known === undefined || known !== version) return false
  }
  return true
}

export function acceptSchema(schema: unknown): SerializedSchema | null {
  if (schema === null || schema === undefined) return null
  if (!isKnownSchema(schema)) {
    throw new Error('This board was written by a newer Crew and cannot be opened here')
  }
  return schema
}
