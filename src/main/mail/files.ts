import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const KEY = /^[0-9a-f]{32}$/
const DIRECTORY_MODE = 0o700
const FILE_MODE = 0o600

function identifier(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} cannot be empty`)
  return value.trim()
}

function key(value: unknown): string {
  const result = identifier(value, 'Mail attachment storage key')
  if (!KEY.test(result)) throw new TypeError('Mail attachment storage key is invalid')
  return result
}

function inside(root: string, target: string): string {
  const relative = path.relative(root, target)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Mail attachment path escaped its storage directory')
  return target
}

export class MailFileStore {
  readonly directory: string

  constructor(stateDirectory: string) {
    this.directory = path.resolve(stateDirectory, 'attachments')
  }

  create(account: string, contents: Uint8Array): string {
    identifier(account, 'Mail account id')
    if (!(contents instanceof Uint8Array)) throw new TypeError('Mail attachment contents must be bytes')
    const storageKey = randomUUID().replaceAll('-', '')
    const file = this.pathFor(account, storageKey)
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: DIRECTORY_MODE })
    fs.chmodSync(this.directory, DIRECTORY_MODE)
    fs.chmodSync(path.dirname(file), DIRECTORY_MODE)
    const temporary = inside(this.directory, `${file}.${process.pid}.tmp`)
    try {
      fs.writeFileSync(temporary, contents, { mode: FILE_MODE, flag: 'wx' })
      fs.chmodSync(temporary, FILE_MODE)
      fs.renameSync(temporary, file)
      return storageKey
    } catch (error) {
      try {
        fs.rmSync(temporary, { force: true })
      } catch {}
      throw error
    }
  }

  read(account: string, storageKey: string): Buffer {
    return fs.readFileSync(this.pathFor(account, storageKey))
  }

  exists(account: string, storageKey: string): boolean {
    return fs.existsSync(this.pathFor(account, storageKey))
  }

  delete(account: string, storageKey: string): boolean {
    const file = this.pathFor(account, storageKey)
    try {
      fs.rmSync(file)
      return true
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
      throw error
    }
  }

  pathFor(account: string, storageKey: string): string {
    const accountDirectory = createHash('sha256').update(identifier(account, 'Mail account id')).digest('hex')
    const target = path.resolve(this.directory, accountDirectory, key(storageKey))
    return inside(this.directory, target)
  }
}
