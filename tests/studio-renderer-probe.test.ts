// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { emptyStudioDoc } from '../src/shared/studio'
import { applyOps } from '../src/shared/studio-ops'
import { useCrew } from '../src/renderer/src/state/store'
import Studio from '../src/renderer/src/views/Studio'

describe('Studio renderer', () => {
  it('opens the file browser and a populated canvas without going black', () => {
    useCrew.setState({ activeStudioId: null, studioDoc: null, studios: [], studioPresence: [], agents: [], threads: {}, threadPrompts: {}, steps: {}, pending: {}, selfId: 'ali', selfName: 'ALI' })
    const home = render(createElement(Studio))
    expect(screen.getByText('Make the idea')).toBeTruthy()
    expect(screen.getByText('New Studio')).toBeTruthy()
    home.unmount()

    const doc = emptyStudioDoc('studio-probe', 'Launch dashboard', 'ALI')
    applyOps(doc, [{ kind: 'upsert', pageId: doc.pages[0].id, nodes: [{ id: 'frame-probe', type: 'frame', name: 'Dashboard', x: 80, y: 80, w: 900, h: 620, fill: '#ffffff', radius: 24 }] }])
    useCrew.setState({ activeStudioId: doc.id, studioDoc: doc })
    const editor = render(createElement(Studio))
    expect(screen.getByText('Launch dashboard')).toBeTruthy()
    expect(screen.getAllByText('Dashboard')).toHaveLength(2)
    fireEvent.click(screen.getAllByText('Dashboard')[0])
    expect(screen.getByText('Geometry')).toBeTruthy()
    expect(editor.container.querySelector('.studio-canvas')).toBeTruthy()
  })
})
