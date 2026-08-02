import { spawn } from 'node:child_process'
import path from 'node:path'

const remotePath = (remote: string): string => {
  try {
    return new URL(remote).pathname
  } catch {
    const scp = /^(?:[^@/]+@)?[^/:]+:(.+)$/.exec(remote)
    return scp?.[1] ?? remote
  }
}

export function repositoryName(remote: string): string {
  const source = remote.trim()
  if (!source) throw new Error('Paste the repository URL first.')
  const leaf = remotePath(source).replace(/[\\/]+$/, '').split(/[\\/]/).at(-1) ?? ''
  let decoded = leaf
  try {
    decoded = decodeURIComponent(leaf)
  } catch {
    decoded = leaf
  }
  const name = decoded.replace(/\.git$/i, '')
  if (!name || name === '.' || name === '..' || /[\\/]/.test(name)) {
    throw new Error('That repository URL has no project name.')
  }
  return name
}

const cloneError = (stderr: string, code: number | null): Error => {
  const message = stderr
    .trim()
    .split(/\r?\n/)
    .map(line => line.replace(/^(?:fatal|error):\s*/i, '').trim())
    .filter(Boolean)
    .join('\n')
  return new Error(message || `Git stopped with exit code ${code ?? 1}.`)
}

export function cloneRepository(remote: string, parent: string): Promise<string> {
  const source = remote.trim()
  const destination = path.join(parent, repositoryName(source))
  return new Promise((resolve, reject) => {
    const child = spawn('git', ['clone', '--quiet', '--', source, destination], {
      cwd: parent,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      stdio: ['ignore', 'ignore', 'pipe']
    })
    let stderr = ''
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', chunk => {
      stderr += chunk
    })
    child.once('error', error => {
      reject(new Error((error as NodeJS.ErrnoException).code === 'ENOENT' ? 'Git is not installed.' : error.message))
    })
    child.once('close', code => {
      if (code === 0) resolve(destination)
      else reject(cloneError(stderr, code))
    })
  })
}
