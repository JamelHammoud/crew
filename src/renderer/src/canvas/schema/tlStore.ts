import { createRecordType, Store, StoreSchema, getStoreSnapshot, type SerializedStore } from '../store'
import {
  assetValidator,
  bindingValidator,
  cameraValidator,
  documentValidator,
  instancePageStateValidator,
  instancePresenceValidator,
  instanceValidator,
  pageValidator,
  pointerValidator,
  shapeValidator,
  userValidator,
  type TLAsset,
  type TLBinding,
  type TLCamera,
  type TLDocument,
  type TLInstance,
  type TLInstancePageState,
  type TLInstancePresence,
  type TLPage,
  type TLPointer,
  type TLRecord,
  type TLShape,
  type TLUser
} from './records'
import { acceptSchema, SEQUENCES, type SerializedSchema } from './version'

const recordType = <Record extends TLRecord>(
  typeName: Record['typeName'],
  validator: { validate(value: unknown): Record },
  scope: 'document' | 'session' | 'presence'
) => createRecordType<Record>(typeName, { validator, scope })

export const DocumentRecordType = recordType<TLDocument>(
  'document',
  documentValidator,
  'document'
).withDefaultProperties(() => ({ gridSize: 10, name: '', meta: {} }))

export const PageRecordType = recordType<TLPage>('page', pageValidator, 'document').withDefaultProperties(() => ({
  meta: {}
}))

export const UserRecordType = recordType<TLUser>('user', userValidator, 'document').withDefaultProperties(() => ({
  name: '',
  color: '',
  imageUrl: '',
  meta: {}
}))

export const CameraRecordType = recordType<TLCamera>('camera', cameraValidator, 'session').withDefaultProperties(
  () => ({ x: 0, y: 0, z: 1, meta: {} })
)

export const PointerRecordType = recordType<TLPointer>('pointer', pointerValidator, 'session').withDefaultProperties(
  () => ({ x: 0, y: 0, lastActivityTimestamp: 0, meta: {} })
)

export const ShapeRecordType = recordType<TLShape>('shape', shapeValidator, 'document').withDefaultProperties(() => ({
  x: 0,
  y: 0,
  rotation: 0,
  isLocked: false,
  opacity: 1,
  meta: {}
}))

export const AssetRecordType = recordType<TLAsset>('asset', assetValidator, 'document').withDefaultProperties(() => ({
  meta: {}
}))

export const BindingRecordType = recordType<TLBinding>('binding', bindingValidator, 'document').withDefaultProperties(
  () => ({ meta: {} })
)

export const InstanceRecordType = recordType<TLInstance>(
  'instance',
  instanceValidator,
  'session'
).withDefaultProperties(() => ({
  followingUserId: null,
  opacityForNextShape: 1,
  stylesForNextShape: {},
  brush: null,
  scribbles: [],
  cursor: { type: 'default', rotation: 0 },
  isFocusMode: false,
  exportBackground: false,
  isDebugMode: false,
  isToolLocked: false,
  screenBounds: { x: 0, y: 0, w: 1080, h: 720 },
  insets: [false, false, false, false],
  zoomBrush: null,
  isGridMode: false,
  isPenMode: false,
  chatMessage: '',
  isChatting: false,
  highlightedUserIds: [],
  isFocused: false,
  devicePixelRatio: typeof window === 'undefined' ? 1 : window.devicePixelRatio,
  isCoarsePointer: false,
  isHoveringCanvas: null,
  openMenus: [],
  isChangingStyle: false,
  isReadonly: false,
  meta: {},
  duplicateProps: null,
  cameraState: 'idle'
}))

export const InstancePageStateRecordType = recordType<TLInstancePageState>(
  'instance_page_state',
  instancePageStateValidator,
  'session'
).withDefaultProperties(() => ({
  editingShapeId: null,
  croppingShapeId: null,
  selectedShapeIds: [],
  hoveredShapeId: null,
  erasingShapeIds: [],
  hintingShapeIds: [],
  focusedGroupId: null,
  meta: {}
}))

export const InstancePresenceRecordType = recordType<TLInstancePresence>(
  'instance_presence',
  instancePresenceValidator,
  'presence'
).withDefaultProperties(() => ({
  lastActivityTimestamp: null,
  followingUserId: null,
  color: '#FF0000',
  camera: null,
  cursor: null,
  screenBounds: null,
  selectedShapeIds: [],
  brush: null,
  scribbles: [],
  chatMessage: '',
  meta: {}
}))

const recordTypes = {
  asset: AssetRecordType,
  binding: BindingRecordType,
  camera: CameraRecordType,
  document: DocumentRecordType,
  instance: InstanceRecordType,
  instance_page_state: InstancePageStateRecordType,
  page: PageRecordType,
  instance_presence: InstancePresenceRecordType,
  pointer: PointerRecordType,
  shape: ShapeRecordType,
  user: UserRecordType
}

export type TLStore = Store<TLRecord>

export interface TLStoreOptions {
  initialData?: SerializedStore<TLRecord>
  id?: string
  shapeUtils?: readonly unknown[]
  bindingUtils?: readonly unknown[]
}

export interface TLStoreSnapshot {
  store: SerializedStore<TLRecord>
  schema: SerializedSchema
}

export interface TLEditorSnapshot {
  document: TLStoreSnapshot
  session?: TLStoreSnapshot
}

const loadedDocumentSchemas = new WeakMap<TLStore, SerializedSchema>()

export function createTLSchema(): StoreSchema<TLRecord> {
  return StoreSchema.create<TLRecord>(recordTypes, { sequences: { ...SEQUENCES } })
}

export function createTLStore(options: TLStoreOptions = {}): TLStore {
  return new Store<TLRecord>({
    id: options.id,
    schema: createTLSchema(),
    initialData: options.initialData
  })
}

export function getSnapshot(store: TLStore): TLEditorSnapshot {
  const document = getStoreSnapshot(store, 'document') as TLStoreSnapshot
  const loadedSchema = loadedDocumentSchemas.get(store)
  if (loadedSchema) document.schema = loadedSchema
  return {
    document,
    session: getStoreSnapshot(store, 'session') as TLStoreSnapshot
  }
}

export function loadSnapshot(store: TLStore, snapshot: TLStoreSnapshot | TLEditorSnapshot): void {
  const document = 'document' in snapshot ? snapshot.document : snapshot
  acceptSchema(document.schema)
  loadedDocumentSchemas.set(store, structuredClone(document.schema))
  const documentIds = store
    .records()
    .filter(record => store.scopedTypes.document.has(record.typeName))
    .map(record => record.id)
  store.atomic(() => {
    if (documentIds.length > 0) store.remove(documentIds)
    store.put(Object.values(document.store), 'initialize')
  }, false)
}
