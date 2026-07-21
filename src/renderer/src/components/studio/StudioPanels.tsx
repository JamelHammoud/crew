import {
  ChevronDownIcon,
  ChevronRightIcon,
  EyeIcon,
  EyeSlashIcon,
  LockClosedIcon,
  LockOpenIcon,
  PlusIcon,
  Squares2X2Icon,
  TrashIcon
} from '@heroicons/react/24/outline'
import { useMemo, useState } from 'react'
import type { StudioNode } from '../../../../shared/studio'
import type { StudioOp } from '../../../../shared/studio-ops'
import { useCrew } from '../../state/store'

type Commit = (ops: StudioOp[], remember?: boolean) => void

export function StudioSidebar({ pageId, setPageId, selection, setSelection, commit }: { pageId: string; setPageId: (id: string) => void; selection: string[]; setSelection: (ids: string[]) => void; commit: Commit }) {
  const doc = useCrew(s => s.studioDoc)!
  const studios = useCrew(s => s.studios)
  const openStudio = useCrew(s => s.openStudio)
  const [tab, setTab] = useState<'layers' | 'assets' | 'pages' | 'files' | 'shared'>('layers')
  const page = doc.pages.find(item => item.id === pageId) ?? doc.pages[0]
  const nodes = useMemo(() => [...page.order].reverse().map(id => doc.nodes[id]).filter((node): node is StudioNode => Boolean(node)), [page.order, doc.nodes])

  const reorder = (id: string, delta: number) => {
    const order = [...page.order]; const at = order.indexOf(id); const to = Math.max(0, Math.min(order.length - 1, at + delta))
    if (at < 0 || at === to) return
    order.splice(at, 1); order.splice(to, 0, id); commit([{ kind: 'order', pageId, order }])
  }

  const makeComponent = () => {
    const picked = selection.map(id => doc.nodes[id]).filter((node): node is StudioNode => Boolean(node))
    if (!picked.length) return
    const name = window.prompt('Component name', picked[0].name ?? 'Component')?.trim()
    if (!name) return
    commit([{ kind: 'asset.add', asset: { id: crypto.randomUUID(), name, rootId: picked[0].id, nodes: structuredClone(picked) } }])
    setTab('assets')
  }

  const insertAsset = (assetId: string) => {
    const asset = doc.assets.find(item => item.id === assetId); if (!asset) return
    const ids = new Map(asset.nodes.map(node => [node.id, crypto.randomUUID()]))
    const nodes = asset.nodes.map((node, index) => ({ ...node, id: ids.get(node.id)!, parentId: node.parentId && ids.has(node.parentId) ? ids.get(node.parentId)! : null, componentId: asset.id, x: node.x + 40 + index * 2, y: node.y + 40 + index * 2 }))
    commit([{ kind: 'upsert', nodes, pageId }]); setSelection(nodes.map(node => node.id))
  }

  return <aside className="studio-sidebar">
    <nav className="studio-panel-tabs">
      {(['layers', 'assets', 'pages', 'files', 'shared'] as const).map(item => <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)} title={item}>{item.slice(0, 1).toUpperCase()}</button>)}
    </nav>
    <div className="studio-panel-heading"><strong>{tab}</strong>{tab === 'assets' && <button onClick={makeComponent} title="Create component"><PlusIcon /></button>}{tab === 'pages' && <button onClick={() => { const id = crypto.randomUUID(); commit([{ kind: 'page.add', page: { id, name: `Page ${doc.pages.length + 1}`, order: [] } }]); setPageId(id) }}><PlusIcon /></button>}</div>
    <div className="studio-panel-scroll">
      {tab === 'layers' && <div className="studio-layers">
        {nodes.length === 0 && <PanelEmpty icon="◇" text="Your layers will appear here" />}
        {nodes.map(node => <div key={node.id} className={`studio-layer ${selection.includes(node.id) ? 'selected' : ''}`} onClick={() => setSelection([node.id])}>
          <span className="layer-kind">{kindGlyph(node.type)}</span>
          <button className="layer-name" onDoubleClick={() => { const name = window.prompt('Rename layer', node.name ?? node.type)?.trim(); if (name) commit([{ kind: 'update', id: node.id, patch: { name } }]) }}>{node.name ?? node.type}</button>
          <button onClick={event => { event.stopPropagation(); commit([{ kind: 'update', id: node.id, patch: { hidden: !node.hidden } }]) }}>{node.hidden ? <EyeSlashIcon /> : <EyeIcon />}</button>
          <button onClick={event => { event.stopPropagation(); commit([{ kind: 'update', id: node.id, patch: { locked: !node.locked } }]) }}>{node.locked ? <LockClosedIcon /> : <LockOpenIcon />}</button>
          <span className="layer-order"><button onClick={event => { event.stopPropagation(); reorder(node.id, 1) }}>↑</button><button onClick={event => { event.stopPropagation(); reorder(node.id, -1) }}>↓</button></span>
        </div>)}
      </div>}
      {tab === 'assets' && <div className="studio-assets">
        <button className="studio-component-create" onClick={makeComponent}><Squares2X2Icon /><span><strong>Create component</strong><small>Save selected layers for reuse</small></span></button>
        {doc.assets.map(asset => <button key={asset.id} className="studio-asset" onClick={() => insertAsset(asset.id)}><span>◇</span><div><strong>{asset.name}</strong><small>{asset.nodes.length} layers</small></div><i>+</i></button>)}
      </div>}
      {tab === 'pages' && <div className="studio-pages">{doc.pages.map((item, index) => <button key={item.id} className={pageId === item.id ? 'active' : ''} onClick={() => { setPageId(item.id); setSelection([]) }} onDoubleClick={() => { const name = window.prompt('Rename page', item.name)?.trim(); if (name) commit([{ kind: 'page.rename', pageId: item.id, name }]) }}><span>{String(index + 1).padStart(2, '0')}</span><strong>{item.name}</strong>{doc.pages.length > 1 && <i onClick={event => { event.stopPropagation(); commit([{ kind: 'page.remove', pageId: item.id }]); if (pageId === item.id) setPageId(doc.pages.find(page => page.id !== item.id)!.id) }}><TrashIcon /></i>}</button>)}</div>}
      {tab === 'files' && <div className="studio-files-list">{studios.map(file => <button key={file.id} className={file.id === doc.id ? 'active' : ''} onClick={() => file.id !== doc.id && openStudio(file.id)}><span><i />{file.name}</span><small>{file.pageCount}p · {file.nodeCount} layers</small></button>)}</div>}
      {tab === 'shared' && <div className="studio-shared-assets"><PanelEmpty icon="⌁" text="Team components and libraries will live here" /><button onClick={() => commit([{ kind: 'variable.set', name: 'brand-accent', value: '#6d5dfc' }])}>Add starter design tokens</button></div>}
    </div>
  </aside>
}

function PanelEmpty({ icon, text }: { icon: string; text: string }) { return <div className="studio-panel-empty"><span>{icon}</span><p>{text}</p></div> }

function kindGlyph(type: StudioNode['type']): string { return ({ frame: '⌗', group: '◫', rect: '□', ellipse: '○', line: '╱', arrow: '→', text: 'T', image: '▧', svg: '⌘', icon: '✦' })[type] }

export function StudioInspector({ nodes, commit }: { nodes: StudioNode[]; commit: Commit }) {
  const doc = useCrew(s => s.studioDoc)!
  const [open, setOpen] = useState<Record<string, boolean>>({ design: true, appearance: true, layout: true, typography: true, effects: true, variables: true })
  const node = nodes[0]
  const patch = (value: Partial<StudioNode>) => commit(nodes.map(item => ({ kind: 'update', id: item.id, patch: value })))
  const align = (mode: 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom') => {
    if (nodes.length < 2) return
    const left = Math.min(...nodes.map(item => item.x)); const right = Math.max(...nodes.map(item => item.x + item.w)); const top = Math.min(...nodes.map(item => item.y)); const bottom = Math.max(...nodes.map(item => item.y + item.h))
    commit(nodes.map(item => ({ kind: 'update', id: item.id, patch: mode === 'left' ? { x: left } : mode === 'hcenter' ? { x: (left + right - item.w) / 2 } : mode === 'right' ? { x: right - item.w } : mode === 'top' ? { y: top } : mode === 'vcenter' ? { y: (top + bottom - item.h) / 2 } : { y: bottom - item.h } })))
  }
  const autoLayout = (value: Partial<Pick<StudioNode, 'layout' | 'gap' | 'padding'>>) => {
    const layout = value.layout ?? node.layout ?? 'none'; const gap = value.gap ?? node.gap ?? 0; const padding = value.padding ?? node.padding ?? 0
    const ops: StudioOp[] = [{ kind: 'update', id: node.id, patch: value }]
    if (layout !== 'none') {
      const page = doc.pages.find(item => item.order.includes(node.id)); const children = (page?.order ?? []).map(id => doc.nodes[id]).filter((item): item is StudioNode => Boolean(item) && item.parentId === node.id)
      let cursor = padding
      for (const child of children) {
        ops.push({ kind: 'update', id: child.id, patch: layout === 'row' ? { x: cursor, y: padding } : { x: padding, y: cursor } })
        cursor += (layout === 'row' ? child.w : child.h) + gap
      }
    }
    commit(ops)
  }
  const section = (id: string, title: string, body: React.ReactNode) => <section className="studio-inspector-section"><button className="studio-inspector-title" onClick={() => setOpen(state => ({ ...state, [id]: !state[id] }))}>{open[id] ? <ChevronDownIcon /> : <ChevronRightIcon />}<strong>{title}</strong></button>{open[id] && <div className="studio-inspector-body">{body}</div>}</section>

  if (!node) return <aside className="studio-inspector"><div className="studio-inspector-empty"><span>◇</span><strong>Nothing selected</strong><p>Select a layer to inspect its properties.</p></div>{section('variables', 'Local variables', <Variables variables={doc.variables ?? {}} commit={commit} />)}</aside>

  return <aside className="studio-inspector">
    <div className="studio-inspector-selection"><span>{kindGlyph(node.type)}</span><div><strong>{nodes.length > 1 ? `${nodes.length} layers` : node.name ?? node.type}</strong><small>{node.type}</small></div></div>
    {nodes.length > 1 && section('align', 'Align selection', <div className="inspector-align"><button onClick={() => align('left')}>⇤</button><button onClick={() => align('hcenter')}>↔</button><button onClick={() => align('right')}>⇥</button><button onClick={() => align('top')}>↥</button><button onClick={() => align('vcenter')}>↕</button><button onClick={() => align('bottom')}>↧</button></div>)}
    {section('design', 'Geometry', <>
      <div className="inspector-grid"><Field label="X" value={node.x} onChange={x => patch({ x })} /><Field label="Y" value={node.y} onChange={y => patch({ y })} /><Field label="W" value={node.w} min={0} onChange={w => patch({ w })} /><Field label="H" value={node.h} min={0} onChange={h => patch({ h })} /></div>
      <div className="inspector-grid"><Field label="↻" value={node.rotation ?? 0} onChange={rotation => patch({ rotation })} /><Field label="%" value={Math.round((node.opacity ?? 1) * 100)} min={0} max={100} onChange={opacity => patch({ opacity: opacity / 100 })} /></div>
      <div className="inspector-actions"><button onClick={() => patch({ locked: !node.locked })}>{node.locked ? <LockClosedIcon /> : <LockOpenIcon />}{node.locked ? 'Locked' : 'Lock'}</button><button onClick={() => patch({ hidden: !node.hidden })}>{node.hidden ? <EyeSlashIcon /> : <EyeIcon />}{node.hidden ? 'Hidden' : 'Visible'}</button></div>
    </>)}
    {section('appearance', 'Appearance', <>
      <ColorField label="Fill" value={node.fill} onChange={fill => patch({ fill })} />
      <ColorField label="Gradient" value={node.fill2} optional onChange={fill2 => patch({ fill2 })} />
      {node.fill2 && <Field label="Angle" value={node.gradientAngle ?? 180} min={0} max={360} onChange={gradientAngle => patch({ gradientAngle })} />}
      <ColorField label="Stroke" value={node.stroke} optional onChange={stroke => patch({ stroke })} />
      <div className="inspector-grid"><Field label="Stroke" value={node.strokeWidth ?? 1} min={0} onChange={strokeWidth => patch({ strokeWidth })} /><Field label="Radius" value={node.radius ?? 0} min={0} onChange={radius => patch({ radius })} /></div>
    </>)}
    {(node.type === 'frame' || node.type === 'group') && section('layout', 'Auto layout', <>
      <div className="segmented"><button className={(node.layout ?? 'none') === 'none' ? 'active' : ''} onClick={() => autoLayout({ layout: 'none' })}>Free</button><button className={node.layout === 'row' ? 'active' : ''} onClick={() => autoLayout({ layout: 'row' })}>Row</button><button className={node.layout === 'column' ? 'active' : ''} onClick={() => autoLayout({ layout: 'column' })}>Column</button></div>
      <div className="inspector-grid"><Field label="Gap" value={node.gap ?? 0} min={0} onChange={gap => autoLayout({ gap })} /><Field label="Pad" value={node.padding ?? 0} min={0} onChange={padding => autoLayout({ padding })} /></div>
      <label className="inspector-check"><input type="checkbox" checked={node.clip ?? false} onChange={event => patch({ clip: event.target.checked })} /> Clip content</label>
      <div className="inspector-label">Constraints</div><div className="inspector-grid"><Select value={node.constraints?.horizontal ?? 'left'} values={['left', 'right', 'center', 'stretch', 'scale']} onChange={horizontal => patch({ constraints: { horizontal: horizontal as NonNullable<StudioNode['constraints']>['horizontal'], vertical: node.constraints?.vertical ?? 'top' } })} /><Select value={node.constraints?.vertical ?? 'top'} values={['top', 'bottom', 'center', 'stretch', 'scale']} onChange={vertical => patch({ constraints: { horizontal: node.constraints?.horizontal ?? 'left', vertical: vertical as NonNullable<StudioNode['constraints']>['vertical'] } })} /></div>
    </>)}
    {node.type === 'text' && section('typography', 'Typography', <>
      <textarea className="inspector-textarea" value={node.text ?? ''} onChange={event => patch({ text: event.target.value })} />
      <div className="inspector-grid"><Field label="Size" value={node.fontSize ?? 16} min={1} onChange={fontSize => patch({ fontSize })} /><Field label="Weight" value={node.fontWeight ?? 400} min={100} max={900} step={100} onChange={fontWeight => patch({ fontWeight })} /></div>
      <div className="inspector-grid"><Field label="Line" value={node.lineHeight ?? 1.3} min={.5} max={4} step={.1} onChange={lineHeight => patch({ lineHeight })} /><Field label="Track" value={node.letterSpacing ?? 0} step={.1} onChange={letterSpacing => patch({ letterSpacing })} /></div>
      <div className="segmented"><button className={node.align === 'left' || !node.align ? 'active' : ''} onClick={() => patch({ align: 'left' })}>Left</button><button className={node.align === 'center' ? 'active' : ''} onClick={() => patch({ align: 'center' })}>Center</button><button className={node.align === 'right' ? 'active' : ''} onClick={() => patch({ align: 'right' })}>Right</button></div>
    </>)}
    {node.componentId && section('component', 'Component properties', <ComponentProperties node={node} commit={commit} />)}
    {section('effects', 'Effects', <>
      <Field label="Blur" value={node.blur ?? 0} min={0} max={200} onChange={blur => patch({ blur })} />
      <label className="inspector-check"><input type="checkbox" checked={Boolean(node.shadow)} onChange={event => patch({ shadow: event.target.checked ? { x: 0, y: 10, blur: 32, color: 'rgba(0,0,0,0.28)' } : null })} /> Drop shadow</label>
      {node.shadow && <div className="inspector-grid"><Field label="X" value={node.shadow.x} onChange={x => patch({ shadow: { ...node.shadow!, x } })} /><Field label="Y" value={node.shadow.y} onChange={y => patch({ shadow: { ...node.shadow!, y } })} /><Field label="Blur" value={node.shadow.blur} min={0} onChange={blur => patch({ shadow: { ...node.shadow!, blur } })} /></div>}
    </>)}
    {section('variables', 'Local variables', <Variables variables={doc.variables ?? {}} commit={commit} />)}
    <button className="inspector-delete" onClick={() => commit([{ kind: 'remove', ids: nodes.map(item => item.id) }])}><TrashIcon /> Delete selection</button>
  </aside>
}

function Field({ label, value, onChange, min, max, step = 1 }: { label: string; value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number }) { return <label className="inspector-field"><span>{label}</span><input type="number" value={Number.isFinite(value) ? Math.round(value * 100) / 100 : 0} min={min} max={max} step={step} onChange={event => onChange(Number(event.target.value))} /></label> }
function Select({ value, values, onChange }: { value: string; values: string[]; onChange: (value: string) => void }) { return <select className="inspector-select" value={value} onChange={event => onChange(event.target.value)}>{values.map(item => <option key={item}>{item}</option>)}</select> }
function ColorField({ label, value, optional, onChange }: { label: string; value?: string | null; optional?: boolean; onChange: (value: string | null) => void }) { const safe = value && /^#[0-9a-f]{6}$/i.test(value) ? value : '#6d5dfc'; return <div className="inspector-color"><span>{label}</span><input type="color" value={safe} onChange={event => onChange(event.target.value)} /><input value={value ?? ''} placeholder={optional ? 'None' : '#000000'} onChange={event => onChange(event.target.value || null)} />{optional && value && <button onClick={() => onChange(null)}>×</button>}</div> }

function Variables({ variables, commit }: { variables: Record<string, string>; commit: Commit }) {
  const add = () => { const name = window.prompt('Variable name', 'brand-accent')?.trim(); if (!name) return; const value = window.prompt('Variable value', '#6d5dfc'); if (value !== null) commit([{ kind: 'variable.set', name, value }]) }
  return <div className="inspector-variables">{Object.entries(variables).map(([name, value]) => <div key={name}><i style={{ background: /^#/.test(value) ? value : '#666' }} /><span>{name}</span><code>{value}</code><button onClick={() => commit([{ kind: 'variable.remove', name }])}>×</button></div>)}<button className="inspector-add-variable" onClick={add}><PlusIcon /> Add variable</button></div>
}

function ComponentProperties({ node, commit }: { node: StudioNode; commit: Commit }) {
  const props = node.componentProps ?? {}
  const update = (componentProps: Record<string, string>) => commit([{ kind: 'update', id: node.id, patch: { componentProps } }])
  const add = () => { const name = window.prompt('Property name', 'variant')?.trim(); if (name) update({ ...props, [name]: 'Default' }) }
  return <div className="component-props">{Object.entries(props).map(([name, value]) => <label key={name}><span>{name}</span><input value={value} onChange={event => update({ ...props, [name]: event.target.value })} /></label>)}<button onClick={add}><PlusIcon /> Add property</button></div>
}
