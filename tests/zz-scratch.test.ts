import { describe, it } from 'vitest'
import { InstancePresenceRecordType, createTLStore, type TLPageId, type TLUserId } from '../src/renderer/src/canvas'
import { designShapeUtils } from '../src/renderer/src/design/shapeUtils'

describe('scratch presence', () => {
  it('takes a presence record the way DesignCanvas writes one', () => {
    const store = createTLStore({ id: 'presence', shapeUtils: designShapeUtils })
    const id = InstancePresenceRecordType.createId('someone')
    try {
      store.mergeRemoteChanges(() => {
        store.put([
          InstancePresenceRecordType.create({
            id,
            userId: 'someone' as TLUserId,
            userName: 'Someone',
            color: '#ff0000',
            cursor: { x: 10, y: 20, type: 'default', rotation: 0 },
            selectedShapeIds: [],
            currentPageId: 'page:page' as TLPageId,
            lastActivityTimestamp: 1
          })
        ])
      })
      console.log('presence stored', !!store.get(id))
      console.log('record', JSON.stringify(store.get(id)))
    } catch (error) {
      console.log('presence threw', (error as Error).message)
    }
  })
})
