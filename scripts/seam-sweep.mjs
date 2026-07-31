import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import path from 'node:path'

const root = process.cwd()
const canvas = path.join(root, 'src/renderer/src/canvas')
const found = execSync("grep -rl tldraw --include='*.ts' --include='*.tsx' src tests", { encoding: 'utf8' })
const files = found.trim().split('\n').filter(f => !f.startsWith('src/renderer/src/canvas/'))

const changed = []
for (const file of files) {
  const abs = path.join(root, file)
  let rel = path.relative(path.dirname(abs), canvas).split(path.sep).join('/')
  if (rel.charAt(0) !== '.') rel = './' + rel
  const before = readFileSync(abs, 'utf8')
  let next = before
  next = next.replace(/import ['"]tldraw\/tldraw\.css['"]/g, `import '${rel}/canvas.css'`)
  next = next.replace(/from ['"]@tldraw\/assets\/imports\.vite['"]/g, `from '${rel}/assets'`)
  next = next.replace(/from ['"]@tldraw\/tlschema['"]/g, `from '${rel}'`)
  next = next.replace(/from ['"]tldraw['"]/g, `from '${rel}'`)
  next = next.replace(
    /\ndeclare module '@tldraw\/tlschema' \{\n  interface TLGlobalShapePropsMap \{\n    'design-node': DesignNodeProps\n  \}\n\}\n/,
    '\n'
  )
  if (next !== before) {
    writeFileSync(abs, next)
    changed.push(file)
  }
}

console.log(`${changed.length} files rewritten`)
const left = execSync("grep -rn tldraw --include='*.ts' --include='*.tsx' src tests || true", { encoding: 'utf8' })
console.log('--- remaining ---')
console.log(left.trim() || '(none)')
