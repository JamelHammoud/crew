import {
  ArrowLeftIcon,
  DocumentDuplicateIcon,
  EllipsisHorizontalIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  SparklesIcon,
  StarIcon,
  TrashIcon
} from '@heroicons/react/24/outline'
import { useMemo, useState } from 'react'
import type { StudioMeta, StudioNode } from '../../../shared/studio'
import { useCrew } from '../state/store'
import StudioEditor from '../components/studio/StudioEditor'

type Template = { name: string; eyebrow: string; colors: string[]; nodes: () => StudioNode[] }

const id = () => crypto.randomUUID()

const templates: Template[] = [
  {
    name: 'SaaS Dashboard',
    eyebrow: 'Desktop · 1440',
    colors: ['#111827', '#7c3aed', '#f8fafc'],
    nodes: () => {
      const frame = id()
      return [
        { id: frame, type: 'frame', name: 'Dashboard', x: 80, y: 80, w: 1120, h: 720, fill: '#f8fafc', radius: 24 },
        { id: id(), type: 'rect', name: 'Navigation', parentId: frame, x: 24, y: 24, w: 220, h: 672, fill: '#111827', radius: 18 },
        { id: id(), type: 'text', name: 'Heading', parentId: frame, x: 284, y: 54, w: 460, h: 58, text: 'Good morning, Ali', fontSize: 34, fontWeight: 700, fill: '#111827' },
        ...[0, 1, 2].map((n): StudioNode => ({ id: id(), type: 'rect', name: `Metric ${n + 1}`, parentId: frame, x: 284 + n * 254, y: 142, w: 226, h: 142, fill: n === 1 ? '#7c3aed' : '#ffffff', radius: 18, shadow: { x: 0, y: 8, blur: 28, color: 'rgba(15,23,42,0.10)' } })),
        { id: id(), type: 'rect', name: 'Analytics', parentId: frame, x: 284, y: 316, w: 734, h: 340, fill: '#ffffff', radius: 18 }
      ]
    }
  },
  {
    name: 'Mobile Onboarding',
    eyebrow: 'Mobile · 3 screens',
    colors: ['#fef3c7', '#f97316', '#292524'],
    nodes: () => [0, 1, 2].map((n): StudioNode => ({
      id: id(), type: 'frame', name: `Onboarding ${n + 1}`, x: 80 + n * 390, y: 80, w: 350, h: 720,
      fill: n === 1 ? '#292524' : '#fef3c7', radius: 34
    }))
  },
  {
    name: 'Landing Page',
    eyebrow: 'Web · Conversion',
    colors: ['#07111f', '#38bdf8', '#f8fafc'],
    nodes: () => {
      const frame = id()
      return [
        { id: frame, type: 'frame', name: 'Landing page', x: 80, y: 80, w: 1200, h: 760, fill: '#07111f', radius: 24 },
        { id: id(), type: 'text', name: 'Hero', parentId: frame, x: 110, y: 160, w: 760, h: 170, text: 'Build what comes next.', fontSize: 72, fontWeight: 700, lineHeight: 1.02, fill: '#f8fafc' },
        { id: id(), type: 'text', name: 'Subhead', parentId: frame, x: 116, y: 366, w: 560, h: 80, text: 'One collaborative space for ideas, design, and production code.', fontSize: 22, lineHeight: 1.45, fill: '#94a3b8' },
        { id: id(), type: 'rect', name: 'Primary action', parentId: frame, x: 116, y: 482, w: 180, h: 58, fill: '#38bdf8', radius: 29 }
      ]
    }
  },
  {
    name: 'Blank Canvas',
    eyebrow: 'Start from scratch',
    colors: ['#18181b', '#27272a', '#a1a1aa'],
    nodes: () => []
  }
]

export default function Studio() {
  const activeStudioId = useCrew(s => s.activeStudioId)
  const studioDoc = useCrew(s => s.studioDoc)
  if (activeStudioId) return studioDoc ? <StudioEditor /> : <StudioLoading />
  return <StudioHome />
}

function StudioLoading() {
  const closeStudio = useCrew(s => s.closeStudio)
  return (
    <div className="studio-shell h-full flex items-center justify-center">
      <button onClick={closeStudio} className="absolute left-6 top-24 studio-icon-button" aria-label="Back">
        <ArrowLeftIcon />
      </button>
      <div className="studio-loading-mark"><span /><span /><span /></div>
    </div>
  )
}

function StudioHome() {
  const studios = useCrew(s => s.studios)
  const selfName = useCrew(s => s.selfName)
  const createStudio = useCrew(s => s.createStudio)
  const openStudio = useCrew(s => s.openStudio)
  const favoriteStudio = useCrew(s => s.favoriteStudio)
  const duplicateStudio = useCrew(s => s.duplicateStudio)
  const deleteStudio = useCrew(s => s.deleteStudio)
  const renameStudio = useCrew(s => s.renameStudio)
  const [query, setQuery] = useState('')
  const [section, setSection] = useState<'recent' | 'favorites' | 'shared' | 'templates'>('recent')
  const [menu, setMenu] = useState<string | null>(null)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...studios]
      .filter(file => !q || file.name.toLowerCase().includes(q))
      .filter(file => section !== 'favorites' || file.favorite)
      .filter(file => section !== 'shared' || file.createdBy !== selfName)
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }, [studios, query, section, selfName])

  const make = (template?: Template) => createStudio(template?.name === 'Blank Canvas' ? 'Untitled Studio' : template?.name ?? 'Untitled Studio', template?.nodes())

  return (
    <div className="studio-home h-full overflow-y-auto px-8 pb-16 pt-[104px]">
      <div className="mx-auto max-w-[1240px]">
        <section className="studio-hero">
          <div>
            <p className="studio-kicker"><SparklesIcon /> AI-native design workspace</p>
            <h1>Make the idea<br /><span>feel real.</span></h1>
            <p>Design with your crew, bring in multiple agents, then build directly into your project.</p>
          </div>
          <button className="studio-new-button" onClick={() => make()}>
            <span><PlusIcon /></span>
            <div><strong>New Studio</strong><small>Blank infinite canvas</small></div>
          </button>
        </section>

        <div className="studio-home-controls">
          <nav>
            {(['recent', 'favorites', 'shared', 'templates'] as const).map(item => (
              <button key={item} className={section === item ? 'active' : ''} onClick={() => setSection(item)}>
                {item[0].toUpperCase() + item.slice(1)}
              </button>
            ))}
          </nav>
          <label className="studio-search"><MagnifyingGlassIcon /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search studios" /></label>
        </div>

        {section === 'templates' ? (
          <section className="studio-grid">
            {templates.map(template => <TemplateCard key={template.name} template={template} onOpen={() => make(template)} />)}
          </section>
        ) : visible.length > 0 ? (
          <section className="studio-grid">
            {visible.map(file => (
              <StudioCard
                key={file.id}
                file={file}
                menu={menu === file.id}
                onOpen={() => openStudio(file.id)}
                onMenu={() => setMenu(current => current === file.id ? null : file.id)}
                onFavorite={() => favoriteStudio(file.id, !file.favorite)}
                onDuplicate={() => duplicateStudio(file.id)}
                onRename={() => {
                  const next = window.prompt('Rename Studio', file.name)?.trim()
                  if (next) renameStudio(file.id, next)
                  setMenu(null)
                }}
                onDelete={() => {
                  if (window.confirm(`Delete “${file.name}”? This cannot be undone.`)) deleteStudio(file.id)
                  setMenu(null)
                }}
              />
            ))}
          </section>
        ) : (
          <button className="studio-empty" onClick={() => make()}>
            <span><PlusIcon /></span><strong>No studios here yet</strong><small>Create one and invite your agents in.</small>
          </button>
        )}
      </div>
    </div>
  )
}

function StudioCard({ file, menu, onOpen, onMenu, onFavorite, onDuplicate, onRename, onDelete }: {
  file: StudioMeta; menu: boolean; onOpen: () => void; onMenu: () => void; onFavorite: () => void; onDuplicate: () => void; onRename: () => void; onDelete: () => void
}) {
  return (
    <article className="studio-file-card">
      <button className="studio-preview" onClick={onOpen} aria-label={`Open ${file.name}`}><Preview file={file} /></button>
      <div className="studio-file-info">
        <button onClick={onOpen}><strong>{file.name}</strong><small>{timeAgo(file.updatedAt)} · {file.nodeCount} layers</small></button>
        <button className={`studio-star ${file.favorite ? 'active' : ''}`} onClick={onFavorite} aria-label="Favorite"><StarIcon /></button>
        <button className="studio-more" onClick={onMenu} aria-label="File menu"><EllipsisHorizontalIcon /></button>
      </div>
      {menu && <div className="studio-file-menu">
        <button onClick={onRename}>Rename</button>
        <button onClick={onDuplicate}><DocumentDuplicateIcon /> Duplicate</button>
        <button onClick={onDelete} className="danger"><TrashIcon /> Delete</button>
      </div>}
    </article>
  )
}

function Preview({ file }: { file: StudioMeta }) {
  const bounds = file.preview.reduce((b, n) => ({ minX: Math.min(b.minX, n.x), minY: Math.min(b.minY, n.y), maxX: Math.max(b.maxX, n.x + n.w), maxY: Math.max(b.maxY, n.y + n.h) }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity })
  if (file.preview.length === 0) return <div className="studio-preview-empty"><span /><span /><span /></div>
  const width = Math.max(1, bounds.maxX - bounds.minX)
  const height = Math.max(1, bounds.maxY - bounds.minY)
  const scale = Math.min(260 / width, 150 / height)
  return <div className="studio-preview-art">{file.preview.map((node, index) => <span key={index} style={{ left: (node.x - bounds.minX) * scale, top: (node.y - bounds.minY) * scale, width: Math.max(2, node.w * scale), height: Math.max(2, node.h * scale), background: node.fill ?? 'transparent', borderRadius: Math.min(12, node.radius * scale) }} />)}</div>
}

function TemplateCard({ template, onOpen }: { template: Template; onOpen: () => void }) {
  return <button className="studio-template-card" onClick={onOpen}>
    <div className="studio-template-art" style={{ '--c1': template.colors[0], '--c2': template.colors[1], '--c3': template.colors[2] } as React.CSSProperties}><span /><span /><i /><b /></div>
    <div><strong>{template.name}</strong><small>{template.eyebrow}</small></div>
  </button>
}

function timeAgo(ts: number): string {
  const minutes = Math.floor((Date.now() - ts) / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
