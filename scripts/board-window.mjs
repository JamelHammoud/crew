import { spawn } from 'node:child_process'
import { mkdtemp, readFile, readdir, realpath, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import electron from 'electron'

const here = path.dirname(fileURLToPath(import.meta.url))
export const root = path.resolve(here, '..')
const resolve = createRequire(path.join(root, 'package.json')).resolve

async function boardsIn(directory) {
  const found = []
  let entries = []
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch {
    return found
  }
  for (const entry of entries) {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) found.push(...(await boardsIn(target)))
    else if (
      entry.isFile() &&
      entry.name.endsWith('.json') &&
      target.includes(`${path.sep}.crew${path.sep}designs${path.sep}`)
    )
      found.push(target)
  }
  return found
}

export const byShapeTypes = store =>
  new Set(
    Object.values(store)
      .filter(record => record.typeName === 'shape')
      .map(record => record.type)
  ).size

export const byShapeCount = store =>
  Object.values(store).filter(record => record.typeName === 'shape').length

export async function boardFile(score = byShapeTypes) {
  if (process.env.CREW_BOARD_CHECK) return realpath(process.env.CREW_BOARD_CHECK)
  const projects = path.join(homedir(), 'Library', 'Application Support', 'Crew', 'projects')
  const files = await boardsIn(projects)
  if (files.length === 0) throw new Error('No saved Crew board was found')
  const scored = await Promise.all(
    files.map(async file => {
      const saved = JSON.parse(await readFile(file, 'utf8'))
      return { file, score: score(saved.document?.store ?? {}) }
    })
  )
  return scored.sort((a, b) => b.score - a.score)[0].file
}

export function probeSource(snapshot) {
  const from = file => JSON.stringify(path.join(root, 'src/renderer/src', file))
  const react = JSON.stringify(resolve('react'))
  const reactDom = JSON.stringify(resolve('react-dom/client'))
  return `import React from ${react}
import { createRoot } from ${reactDom}
import { createTLStore, defaultBindingUtils, EditorContext, loadSnapshot, useValue } from ${from('canvas/index.ts')}
import { CrewCanvas } from ${from('canvas/CrewCanvas.tsx')}
import DesignLeftPanel from ${from('components/DesignLeftPanel.tsx')}
import { commandForKey } from ${from('design/commands.ts')}
import { applyDesignCursors, DESIGN_CURSORS } from ${from('design/cursors.tsx')}
import { applyDesignDefaults } from ${from('design/defaults.ts')}
import { DesignNodeTool } from ${from('design/DesignNodeTool.ts')}
import SelectionOverlay from ${from('design/SelectionOverlay.tsx')}
import { selectionStroke } from ${from('design/selectionColor.ts')}
import { designShapeUtils } from ${from('design/shapeUtils.ts')}
import { keepWholePixels } from ${from('design/wholePixels.ts')}
import './probe.css'

const store = createTLStore({ id: 'board-check' })
loadSnapshot(store, ${JSON.stringify(snapshot)})

window.__probe = { canvasCommits: 0, appCommits: 0, renamed: 0, asked: 0 }

function Board() {
  const [editor, setEditor] = React.useState(null)
  const selected = useValue('design selected color', () => (editor ? selectionStroke(editor) : null), [editor])
  const mounted = React.useCallback(editor => {
    applyDesignDefaults(editor)
    applyDesignCursors(editor.getContainer())
    editor.user.updateUserPreferences({ isSnapMode: true, colorScheme: 'light' })
    const stopRounding = keepWholePixels(editor)
    setEditor(editor)
    window.canvasEditor = editor
    requestAnimationFrame(() => {
      editor.zoomToFit({ immediate: true })
      window.canvasReady = true
    })
    return () => stopRounding()
  }, [])

  React.useEffect(() => {
    if (!editor) return
    const ctx = {
      editor,
      point: null,
      ask: () => {
        window.__probe.asked += 1
      },
      rename: () => {
        window.__probe.renamed += 1
      }
    }
    window.canvasCommands = ctx
    const onKeyDown = event => {
      const command = commandForKey(event, ctx)
      if (!command) return
      event.preventDefault()
      event.stopPropagation()
      command.run(ctx)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [editor])

  const onCanvasRender = React.useCallback(() => {
    window.__probe.canvasCommits += 1
  }, [])
  const onAppRender = React.useCallback(() => {
    window.__probe.appCommits += 1
  }, [])

  return React.createElement(
    React.Profiler,
    { id: 'app', onRender: onAppRender },
    React.createElement(
      'div',
      {
        className: 'absolute inset-0 flex design',
        style: { ...DESIGN_CURSORS, cursor: 'var(--crew-cursor-default)', '--design-selected': selected }
      },
      React.createElement(
        'div',
        { className: 'w-64 shrink-0 flex min-h-0', 'data-probe-panel': 'true' },
        editor && React.createElement(EditorContext.Provider, { value: editor }, React.createElement(DesignLeftPanel))
      ),
      React.createElement(
        'div',
        { className: 'relative flex-1 min-w-0' },
        React.createElement(
          React.Profiler,
          { id: 'canvas', onRender: onCanvasRender },
          React.createElement(CrewCanvas, {
            store,
            shapeUtils: designShapeUtils,
            bindingUtils: defaultBindingUtils,
            tools: [DesignNodeTool],
            onMount: mounted
          }),
          React.createElement(SelectionOverlay, { editor })
        )
      )
    )
  )
}

createRoot(document.getElementById('root')).render(
  React.createElement(React.StrictMode, null, React.createElement(Board))
)
`
}

export async function stage(file, mainSource) {
  const saved = JSON.parse(await readFile(file, 'utf8'))
  if (!saved.document?.store || !saved.document?.schema) throw new Error(`${file} is not a Crew board`)
  const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'crew-board-')))
  await writeFile(
    path.join(directory, 'index.html'),
    '<!doctype html><html><head><meta charset="utf-8"><script type="module" src="/probe.tsx"></script></head><body><div id="root"></div></body></html>'
  )
  await writeFile(path.join(directory, 'probe.tsx'), probeSource(saved.document))
  await writeFile(
    path.join(directory, 'probe.css'),
    `@import "${path.join(root, 'src/renderer/src/styles.css')}";\n@import "${path.join(root, 'src/renderer/src/canvas/canvas.css')}";\n@source "${path.join(root, 'src/renderer/src')}";\nhtml, body, #root { width: 100%; height: 100%; margin: 0; }\n#root { position: relative; }\n`
  )
  await writeFile(path.join(directory, 'main.cjs'), mainSource)
  return directory
}

export async function compile(directory) {
  const { build } = await import('vite')
  const tailwind = (await import('@tailwindcss/vite')).default
  await build({
    root: directory,
    base: './',
    mode: 'development',
    logLevel: 'silent',
    define: { 'process.env.NODE_ENV': '"development"' },
    plugins: [tailwind()],
    build: { outDir: path.join(directory, 'dist'), emptyOutDir: true, minify: false }
  })
  return directory
}

export function run(directory, tag = 'BOARD', timeout = 180_000) {
  return new Promise((resolve, reject) => {
    const child = spawn(electron, [path.join(directory, 'main.cjs')], { stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    child.stdout.on('data', chunk => {
      output += chunk
    })
    child.stderr.on('data', () => {})
    const handle = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error(`The ${tag.toLowerCase()} check did not finish`))
    }, timeout)
    child.on('exit', () => {
      clearTimeout(handle)
      const line = output.split('\n').find(value => value.startsWith(`${tag} `))
      if (!line) reject(new Error('The board window did not report a result'))
      else resolve(JSON.parse(line.slice(tag.length + 1)))
    })
    child.on('error', reject)
  })
}
