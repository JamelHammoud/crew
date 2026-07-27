import { MAX_ATTACHMENT_BYTES } from '../../../shared/attachments'

// Klipy is what a GIF picker can still be built on. Tenor closed its API to
// everyone in June 2026 and Giphy stopped being free, so the choice is one
// service and this is it. The key is a client key rather than a secret, and
// written here it rides in the repo the crew already shares, which is how
// everyone who joined gets GIFs without being handed anything of their own. One
// free key from partner.klipy.com goes here, or in VITE_KLIPY_KEY for a machine
// that would rather keep it out of the project.
const CREW_KEY = ''

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

// The grid wants the small copy and the message wants the large one, and both
// fall back down the sizes rather than coming back empty: a GIF the service only
// holds one copy of is still a GIF.
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

// The message carries the picture itself rather than a link to it, the way every
// other image in the chat does, so it is still there when the service is not.
export async function gifFile(gif: Gif): Promise<File> {
  const res = await fetch(gif.file)
  if (!res.ok) throw new Error(`GIF answered ${res.status}`)
  const blob = await res.blob()
  if (blob.size > MAX_ATTACHMENT_BYTES) throw new Error('GIF is too large')
  return new File([blob], `${gif.id}.gif`, { type: 'image/gif' })
}
