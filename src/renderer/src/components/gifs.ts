import { MAX_ATTACHMENT_BYTES } from '../../../shared/attachments'

const CREW_KEY = 'TOP7yoza1zBCxyNiGqTUSTRXrmK3T75F8jhYbwEnI1KeBqoQZp8RcasjsNYk36OC'

const key = (): string => (import.meta.env.VITE_KLIPY_KEY as string | undefined) || CREW_KEY

const BASE = 'https://api.klipy.com/api/v1'
const PER_PAGE = 24

export interface Gif {
  id: string
  title: string
  preview: string
  file: string
  width: number
  height: number
}

export interface GifPage {
  gifs: Gif[]
  page: number
  more: boolean
}

interface Media {
  url?: string
  width?: number
  height?: number
  size?: number
}

type Sizes = Record<string, Record<string, Media | undefined> | undefined>

const PREVIEW = ['sm', 'xs', 'md', 'hd']
const SEND = ['md', 'sm', 'hd', 'xs']

function pick(sizes: Sizes, order: string[], cap: number): Media | null {
  for (const name of order) {
    const media = sizes?.[name]?.['gif']
    if (media?.url && (media.size ?? 0) <= cap) return media
  }
  return null
}

function read(item: Record<string, unknown>): Gif | null {
  const sizes = (item['file'] ?? {}) as Sizes
  const preview = pick(sizes, PREVIEW, MAX_ATTACHMENT_BYTES)
  const file = pick(sizes, SEND, MAX_ATTACHMENT_BYTES)
  if (!preview || !file) return null
  const id = String(item['slug'] ?? item['id'] ?? '')
  if (!id) return null
  return {
    id,
    title: String(item['title'] ?? 'GIF'),
    preview: preview.url as string,
    file: file.url as string,
    width: preview.width || 1,
    height: preview.height || 1
  }
}

export const gifsReady = (): boolean => key().length > 0

async function load(path: string, page: number, extra: Record<string, string> = {}): Promise<GifPage> {
  const query = new URLSearchParams({
    page: String(page),
    per_page: String(PER_PAGE),
    format_filter: 'gif',
    content_filter: 'medium',
    ...extra
  })
  const res = await fetch(`${BASE}/${key()}/gifs/${path}?${query}`)
  if (!res.ok) throw new Error(`GIFs answered ${res.status}`)
  const body = (await res.json()) as { data?: { data?: unknown[]; has_next?: boolean } }
  const items = Array.isArray(body.data?.data) ? body.data.data : []
  return {
    gifs: items.map(item => read(item as Record<string, unknown>)).filter((gif): gif is Gif => gif !== null),
    page,
    more: Boolean(body.data?.has_next)
  }
}

export const trendingGifs = (page = 1): Promise<GifPage> => load('trending', page)

export const searchGifs = (query: string, page = 1): Promise<GifPage> => load('search', page, { q: query })

export async function gifFile(gif: Gif): Promise<File> {
  const res = await fetch(gif.file)
  if (!res.ok) throw new Error(`GIF answered ${res.status}`)
  const blob = await res.blob()
  if (blob.size > MAX_ATTACHMENT_BYTES) throw new Error('GIF is too large')
  return new File([blob], `${gif.id}.gif`, { type: 'image/gif' })
}
