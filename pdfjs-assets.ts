import { createRequire } from 'node:module'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Plugin } from 'vite'

export const PDFJS_AT = 'pdfjs/'
export const PDFJS_DIRS = ['cmaps', 'iccs', 'standard_fonts', 'wasm'] as const

const TYPES: Record<string, string> = {
  '.wasm': 'application/wasm',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript'
}

export function pdfjsRoot(): string {
  return path.dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json'))
}

export async function pdfjsFiles(): Promise<string[]> {
  const root = pdfjsRoot()
  const found: string[] = []
  for (const dir of PDFJS_DIRS) {
    for (const name of await readdir(path.join(root, dir))) found.push(`${dir}/${name}`)
  }
  return found
}

function under(rest: string): string | null {
  const root = pdfjsRoot()
  const dir = rest.split('/')[0]
  if (!PDFJS_DIRS.some(known => known === dir)) return null
  const full = path.resolve(root, rest)
  return full.startsWith(path.join(root, dir) + path.sep) ? full : null
}

export default function pdfjsAssets(): Plugin {
  return {
    name: 'crew-pdfjs-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const at = req.url?.split('?')[0]
        if (!at || !at.startsWith(`/${PDFJS_AT}`)) return next()
        const full = under(decodeURIComponent(at.slice(PDFJS_AT.length + 1)))
        if (!full) return next()
        void readFile(full).then(
          body => {
            res.setHeader('content-type', TYPES[path.extname(full)] ?? 'application/octet-stream')
            res.end(body)
          },
          () => next()
        )
      })
    },
    async generateBundle() {
      const root = pdfjsRoot()
      for (const name of await pdfjsFiles()) {
        this.emitFile({
          type: 'asset',
          fileName: `${PDFJS_AT}${name}`,
          source: await readFile(path.join(root, name))
        })
      }
    }
  }
}
