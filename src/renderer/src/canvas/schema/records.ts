import { validateIndexKey, type IndexKey } from './indices'
import {
  ASSET_PROPS,
  BINDING_PROPS,
  SHAPE_PROPS,
  vecModelValidator,
  type PropsConfig,
  type TLAssetPropsMap,
  type TLAssetType,
  type TLBindingPropsMap,
  type TLBindingType,
  type TLShapePropsMap,
  type TLShapeType,
  type VecModel
} from './shapeProps'
import { T, ValidationError, type JsonObject, type Validator } from './validate'

export type { VecModel }

export type RecordScope = 'document' | 'session' | 'presence'

export type RecordId<Prefix extends string> = string & { __recordPrefix: Prefix }

export type TLShapeId = RecordId<'shape'>
export type TLPageId = RecordId<'page'>
export type TLParentId = TLShapeId | TLPageId
export type TLAssetId = RecordId<'asset'>
export type TLBindingId = RecordId<'binding'>
export type TLUserId = RecordId<'user'>
export type TLDocumentId = RecordId<'document'>
export type TLCameraId = RecordId<'camera'>
export type TLInstanceId = RecordId<'instance'>
export type TLInstancePageStateId = RecordId<'instance_page_state'>
export type TLInstancePresenceId = RecordId<'instance_presence'>
export type TLPointerId = RecordId<'pointer'>

export const TLDOCUMENT_ID = 'document:document' as TLDocumentId
export const TLPOINTER_ID = 'pointer:pointer' as TLPointerId

function idValidator<Id extends string>(prefix: string): Validator<Id> {
  return T.string.refine(id => {
    if (!id.startsWith(`${prefix}:`)) throw new ValidationError(`${prefix} ID must start with "${prefix}:"`)
    return id as Id
  })
}

export const shapeIdValidator = idValidator<TLShapeId>('shape')
export const pageIdValidator = idValidator<TLPageId>('page')
export const assetIdValidator = idValidator<TLAssetId>('asset')
export const bindingIdValidator = idValidator<TLBindingId>('binding')
export const userIdValidator = idValidator<TLUserId>('user')

export const parentIdValidator = T.string.refine(id => {
  if (!id.startsWith('page:') && !id.startsWith('shape:')) {
    throw new ValidationError('Parent ID must start with "page:" or "shape:"')
  }
  return id as TLParentId
})

export const indexKeyValidator = T.string.refine(key => {
  try {
    validateIndexKey(key)
  } catch {
    throw new ValidationError(`Expected an index key, got ${JSON.stringify(key)}`)
  }
  return key as IndexKey
})

export interface BoxModel {
  x: number
  y: number
  w: number
  h: number
}

export const boxModelValidator = T.object<BoxModel>({
  x: T.number,
  y: T.number,
  w: T.number,
  h: T.number
})

export const CURSOR_TYPES = new Set([
  'none',
  'default',
  'pointer',
  'cross',
  'grab',
  'rotate',
  'grabbing',
  'resize-edge',
  'resize-corner',
  'text',
  'move',
  'ew-resize',
  'ns-resize',
  'nesw-resize',
  'nwse-resize',
  'nesw-rotate',
  'nwse-rotate',
  'swne-rotate',
  'senw-rotate',
  'zoom-in',
  'zoom-out'
])

export type TLCursorType = string

export interface TLCursor {
  type: TLCursorType
  rotation: number
}

export const cursorTypeValidator = T.setEnum(CURSOR_TYPES)

export const cursorValidator = T.object<TLCursor>({
  type: cursorTypeValidator,
  rotation: T.number
})

export const SCRIBBLE_STATES = new Set(['starting', 'paused', 'active', 'complete', 'stopping'])

export interface TLScribble {
  id: string
  points: VecModel[]
  size: number
  color: string
  opacity: number
  state: string
  delay: number
  shrink: number
  taper: boolean
}

export const scribbleValidator = T.object<TLScribble>({
  id: T.string,
  points: T.arrayOf(vecModelValidator),
  size: T.positiveNumber,
  color: T.string,
  opacity: T.number,
  state: T.setEnum(SCRIBBLE_STATES),
  delay: T.number,
  shrink: T.number,
  taper: T.boolean
})

export interface TLDocument {
  id: TLDocumentId
  typeName: 'document'
  gridSize: number
  name: string
  meta: JsonObject
}

export interface TLPage {
  id: TLPageId
  typeName: 'page'
  name: string
  index: IndexKey
  meta: JsonObject
}

export interface TLUser {
  id: TLUserId
  typeName: 'user'
  name: string
  color: string
  imageUrl: string
  meta: JsonObject
}

export interface TLCamera {
  id: TLCameraId
  typeName: 'camera'
  x: number
  y: number
  z: number
  meta: JsonObject
}

export interface TLPointer {
  id: TLPointerId
  typeName: 'pointer'
  x: number
  y: number
  lastActivityTimestamp: number
  meta: JsonObject
}

export interface TLBaseShape<Type extends string, Props> {
  id: TLShapeId
  typeName: 'shape'
  type: Type
  x: number
  y: number
  rotation: number
  index: IndexKey
  parentId: TLParentId
  isLocked: boolean
  opacity: number
  props: Props
  meta: JsonObject
}

export type TLShape<Type extends TLShapeType = TLShapeType> = Type extends TLShapeType
  ? TLBaseShape<Type, TLShapePropsMap[Type]>
  : never

export interface TLBaseAsset<Type extends string, Props> {
  id: TLAssetId
  typeName: 'asset'
  type: Type
  props: Props
  meta: JsonObject
}

export type TLAsset<Type extends TLAssetType = TLAssetType> = Type extends TLAssetType
  ? TLBaseAsset<Type, TLAssetPropsMap[Type]>
  : never

export interface TLBaseBinding<Type extends string, Props> {
  id: TLBindingId
  typeName: 'binding'
  type: Type
  fromId: TLShapeId
  toId: TLShapeId
  props: Props
  meta: JsonObject
}

export type TLBinding<Type extends TLBindingType = TLBindingType> = Type extends TLBindingType
  ? TLBaseBinding<Type, TLBindingPropsMap[Type]>
  : never

export interface TLInstance {
  id: TLInstanceId
  typeName: 'instance'
  currentPageId: TLPageId
  opacityForNextShape: number
  stylesForNextShape: Record<string, unknown>
  followingUserId: TLUserId | null
  highlightedUserIds: TLUserId[]
  brush: BoxModel | null
  cursor: TLCursor
  scribbles: TLScribble[]
  isFocusMode: boolean
  isDebugMode: boolean
  isToolLocked: boolean
  exportBackground: boolean
  screenBounds: BoxModel
  insets: boolean[]
  zoomBrush: BoxModel | null
  chatMessage: string
  isChatting: boolean
  isPenMode: boolean
  isGridMode: boolean
  isFocused: boolean
  devicePixelRatio: number
  isCoarsePointer: boolean
  isHoveringCanvas: boolean | null
  openMenus: string[]
  isChangingStyle: boolean
  isReadonly: boolean
  meta: JsonObject
  duplicateProps: { shapeIds: TLShapeId[]; offset: { x: number; y: number } } | null
  cameraState: 'idle' | 'moving'
}

export interface TLInstancePageState {
  id: TLInstancePageStateId
  typeName: 'instance_page_state'
  pageId: TLPageId
  selectedShapeIds: TLShapeId[]
  hintingShapeIds: TLShapeId[]
  erasingShapeIds: TLShapeId[]
  hoveredShapeId: TLShapeId | null
  editingShapeId: TLShapeId | null
  croppingShapeId: TLShapeId | null
  focusedGroupId: TLShapeId | null
  meta: JsonObject
}

export interface TLInstancePresence {
  id: TLInstancePresenceId
  typeName: 'instance_presence'
  userId: TLUserId
  userName: string
  lastActivityTimestamp: number | null
  color: string
  camera: { x: number; y: number; z: number } | null
  selectedShapeIds: TLShapeId[]
  currentPageId: TLPageId
  brush: BoxModel | null
  scribbles: TLScribble[]
  screenBounds: BoxModel | null
  followingUserId: TLUserId | null
  cursor: { x: number; y: number; type: TLCursorType; rotation: number } | null
  chatMessage: string
  meta: JsonObject
}

export type TLRecord =
  | TLDocument
  | TLPage
  | TLUser
  | TLShape
  | TLAsset
  | TLBinding
  | TLCamera
  | TLPointer
  | TLInstance
  | TLInstancePageState
  | TLInstancePresence

export type TLRecordType = TLRecord['typeName']

const meta = T.jsonValue as unknown as Validator<JsonObject>

export const documentValidator = T.model<TLDocument>(
  'document',
  T.object<TLDocument>({
    typeName: T.literal('document'),
    id: T.literal(TLDOCUMENT_ID),
    gridSize: T.number,
    name: T.string,
    meta
  })
)

export const pageValidator = T.model<TLPage>(
  'page',
  T.object<TLPage>({
    typeName: T.literal('page'),
    id: pageIdValidator,
    name: T.string,
    index: indexKeyValidator,
    meta
  })
)

export const userValidator = T.model<TLUser>(
  'user',
  T.object<TLUser>({
    typeName: T.literal('user'),
    id: userIdValidator,
    name: T.string,
    color: T.string,
    imageUrl: T.string,
    meta
  })
)

export const cameraValidator = T.model<TLCamera>(
  'camera',
  T.object<TLCamera>({
    typeName: T.literal('camera'),
    id: idValidator<TLCameraId>('camera'),
    x: T.number,
    y: T.number,
    z: T.number,
    meta
  })
)

export const pointerValidator = T.model<TLPointer>(
  'pointer',
  T.object<TLPointer>({
    typeName: T.literal('pointer'),
    id: idValidator<TLPointerId>('pointer'),
    x: T.number,
    y: T.number,
    lastActivityTimestamp: T.number,
    meta
  })
)

export function createShapeValidator<Type extends string, Props extends object>(type: Type, props: PropsConfig<Props>) {
  return T.object<TLBaseShape<Type, Props>>({
    id: shapeIdValidator,
    typeName: T.literal('shape'),
    type: T.literal(type),
    x: T.number,
    y: T.number,
    rotation: T.number,
    index: indexKeyValidator,
    parentId: parentIdValidator,
    isLocked: T.boolean,
    opacity: T.unitInterval,
    props: T.object<Props>(props),
    meta
  })
}

export function createAssetValidator<Type extends string, Props extends object>(type: Type, props: PropsConfig<Props>) {
  return T.object<TLBaseAsset<Type, Props>>({
    id: assetIdValidator,
    typeName: T.literal('asset'),
    type: T.literal(type),
    props: T.object<Props>(props),
    meta
  })
}

export function createBindingValidator<Type extends string, Props extends object>(
  type: Type,
  props: PropsConfig<Props>
) {
  return T.object<TLBaseBinding<Type, Props>>({
    id: bindingIdValidator,
    typeName: T.literal('binding'),
    type: T.literal(type),
    fromId: shapeIdValidator,
    toId: shapeIdValidator,
    props: T.object<Props>(props),
    meta
  })
}

function variantsOf<Map extends Record<string, unknown>>(
  props: { [K in keyof Map]: PropsConfig<Map[K]> },
  make: (type: string, config: PropsConfig<never>) => unknown
): Record<string, Validator<unknown>> {
  const out: Record<string, Validator<unknown>> = {}
  for (const type of Object.keys(props)) {
    out[type] = make(type, props[type] as PropsConfig<never>) as Validator<unknown>
  }
  return out
}

export const shapeValidator = T.model<TLShape>(
  'shape',
  T.union('type', variantsOf(SHAPE_PROPS, createShapeValidator)) as unknown as Validator<TLShape>
)

export const assetValidator = T.model<TLAsset>(
  'asset',
  T.union('type', variantsOf(ASSET_PROPS, createAssetValidator)) as unknown as Validator<TLAsset>
)

export const bindingValidator = T.model<TLBinding>(
  'binding',
  T.union('type', variantsOf(BINDING_PROPS, createBindingValidator)) as unknown as Validator<TLBinding>
)

export const instanceValidator = T.model<TLInstance>(
  'instance',
  T.object<TLInstance>({
    typeName: T.literal('instance'),
    id: idValidator<TLInstanceId>('instance'),
    currentPageId: pageIdValidator,
    followingUserId: userIdValidator.nullable(),
    brush: boxModelValidator.nullable(),
    opacityForNextShape: T.unitInterval,
    stylesForNextShape: T.object({}).allowUnknownProperties() as unknown as Validator<Record<string, unknown>>,
    cursor: cursorValidator,
    scribbles: T.arrayOf(scribbleValidator),
    isFocusMode: T.boolean,
    isDebugMode: T.boolean,
    isToolLocked: T.boolean,
    exportBackground: T.boolean,
    screenBounds: boxModelValidator,
    insets: T.arrayOf(T.boolean),
    zoomBrush: boxModelValidator.nullable(),
    isPenMode: T.boolean,
    isGridMode: T.boolean,
    chatMessage: T.string,
    isChatting: T.boolean,
    highlightedUserIds: T.arrayOf(userIdValidator),
    isFocused: T.boolean,
    devicePixelRatio: T.number,
    isCoarsePointer: T.boolean,
    isHoveringCanvas: T.boolean.nullable(),
    openMenus: T.arrayOf(T.string),
    isChangingStyle: T.boolean,
    isReadonly: T.boolean,
    meta,
    duplicateProps: T.object({
      shapeIds: T.arrayOf(shapeIdValidator),
      offset: T.object({ x: T.number, y: T.number })
    }).nullable(),
    cameraState: T.literalEnum('idle', 'moving')
  })
)

export const instancePageStateValidator = T.model<TLInstancePageState>(
  'instance_page_state',
  T.object<TLInstancePageState>({
    typeName: T.literal('instance_page_state'),
    id: idValidator<TLInstancePageStateId>('instance_page_state'),
    pageId: pageIdValidator,
    selectedShapeIds: T.arrayOf(shapeIdValidator),
    hintingShapeIds: T.arrayOf(shapeIdValidator),
    erasingShapeIds: T.arrayOf(shapeIdValidator),
    hoveredShapeId: shapeIdValidator.nullable(),
    editingShapeId: shapeIdValidator.nullable(),
    croppingShapeId: shapeIdValidator.nullable(),
    focusedGroupId: shapeIdValidator.nullable(),
    meta
  })
)

export const instancePresenceValidator = T.model<TLInstancePresence>(
  'instance_presence',
  T.object<TLInstancePresence>({
    typeName: T.literal('instance_presence'),
    id: idValidator<TLInstancePresenceId>('instance_presence'),
    userId: userIdValidator,
    userName: T.string,
    lastActivityTimestamp: T.number.nullable(),
    followingUserId: userIdValidator.nullable(),
    cursor: T.object({
      x: T.number,
      y: T.number,
      type: cursorTypeValidator,
      rotation: T.number
    }).nullable(),
    color: T.string,
    camera: T.object({ x: T.number, y: T.number, z: T.number }).nullable(),
    screenBounds: boxModelValidator.nullable(),
    selectedShapeIds: T.arrayOf(shapeIdValidator),
    currentPageId: pageIdValidator,
    brush: boxModelValidator.nullable(),
    scribbles: T.arrayOf(scribbleValidator),
    chatMessage: T.string,
    meta
  })
)

export const RECORD_VALIDATORS = {
  document: documentValidator,
  page: pageValidator,
  user: userValidator,
  shape: shapeValidator,
  asset: assetValidator,
  binding: bindingValidator,
  camera: cameraValidator,
  pointer: pointerValidator,
  instance: instanceValidator,
  instance_page_state: instancePageStateValidator,
  instance_presence: instancePresenceValidator
} as const

export const RECORD_SCOPES: { [K in TLRecordType]: RecordScope } = {
  document: 'document',
  page: 'document',
  user: 'document',
  shape: 'document',
  asset: 'document',
  binding: 'document',
  camera: 'session',
  pointer: 'session',
  instance: 'session',
  instance_page_state: 'session',
  instance_presence: 'presence'
}

export const RECORD_PREFIXES: { [K in TLRecordType]: string } = {
  document: 'document:',
  page: 'page:',
  user: 'user:',
  shape: 'shape:',
  asset: 'asset:',
  binding: 'binding:',
  camera: 'camera:',
  pointer: 'pointer:',
  instance: 'instance:',
  instance_page_state: 'instance_page_state:',
  instance_presence: 'instance_presence:'
}

export function isRecordType(typeName: unknown): typeName is TLRecordType {
  return typeof typeName === 'string' && typeName in RECORD_VALIDATORS
}

export function validateRecord(record: unknown): TLRecord {
  const typeName = (record as { typeName?: unknown })?.typeName
  if (!isRecordType(typeName)) {
    throw new ValidationError(`Unknown record type: ${JSON.stringify(typeName)}`)
  }
  return RECORD_VALIDATORS[typeName].validate(record) as TLRecord
}

export function scopeOf(record: TLRecord): RecordScope {
  return RECORD_SCOPES[record.typeName]
}
