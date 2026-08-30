import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'

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

function realDirectory(directory: string): void {
  const stat = fs.lstatSync(directory)
  if (!stat.isDirectory() || stat.isSymbolicLink() || fs.realpathSync(directory) !== directory) {
    throw new Error('Mail attachment storage directory is unsafe')
  }
}

export class MailFileStore {
  readonly directory: string

  constructor(stateDirectory: string) {
    const state = path.resolve(stateDirectory)
    fs.mkdirSync(state, { recursive: true, mode: DIRECTORY_MODE })
    const canonicalState = fs.realpathSync(state)
    this.directory = path.join(canonicalState, 'attachments')
  }

  create(account: string, contents: Uint8Array): string {
    identifier(account, 'Mail account id')
    if (!(contents instanceof Uint8Array)) throw new TypeError('Mail attachment contents must be bytes')
    const storageKey = randomUUID().replaceAll('-', '')
    const file = this.pathFor(account, storageKey)
    fs.mkdirSync(this.directory, { recursive: true, mode: DIRECTORY_MODE })
    realDirectory(this.directory)
    try {
      fs.mkdirSync(path.dirname(file), { mode: DIRECTORY_MODE })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    }
    realDirectory(path.dirname(file))
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

  async createFromPath(account: string, sourcePath: string): Promise<{ storageKey: string; size: number }> {
    identifier(account, 'Mail account id')
    const source = path.resolve(identifier(sourcePath, 'Mail attachment source'))
    const sourceFile = await fs.promises.open(source, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW)
    const stat = await sourceFile.stat()
    if (!stat.isFile()) {
      await sourceFile.close()
      throw new Error('Mail attachment source is not a file')
    }
    const storageKey = randomUUID().replaceAll('-', '')
    const file = this.pathFor(account, storageKey)
    fs.mkdirSync(this.directory, { recursive: true, mode: DIRECTORY_MODE })
    realDirectory(this.directory)
    try {
      fs.mkdirSync(path.dirname(file), { mode: DIRECTORY_MODE })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    }
    realDirectory(path.dirname(file))
    fs.chmodSync(this.directory, DIRECTORY_MODE)
    fs.chmodSync(path.dirname(file), DIRECTORY_MODE)
    const temporary = inside(this.directory, `${file}.${process.pid}.tmp`)
    try {
      await pipeline(
        sourceFile.createReadStream({ autoClose: false }),
        fs.createWriteStream(temporary, { mode: FILE_MODE, flags: 'wx' })
      )
      fs.chmodSync(temporary, FILE_MODE)
      fs.renameSync(temporary, file)
      return { storageKey, size: stat.size }
    } catch (error) {
      try {
        fs.rmSync(temporary, { force: true })
      } catch {}
      throw error
    } finally {
      await sourceFile.close()
    }
  }

  read(account: string, storageKey: string): Buffer {
    const file = this.pathFor(account, storageKey)
    realDirectory(this.directory)
    realDirectory(path.dirname(file))
    const descriptor = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW)
    try {
      return fs.readFileSync(descriptor)
    } finally {
      fs.closeSync(descriptor)
    }
  }

  exists(account: string, storageKey: string): boolean {
    const file = this.pathFor(account, storageKey)
    try {
      realDirectory(this.directory)
      realDirectory(path.dirname(file))
      const stat = fs.lstatSync(file)
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Mail attachment file is unsafe')
      return true
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
      throw error
    }
  }

  delete(account: string, storageKey: string): boolean {
    const file = this.pathFor(account, storageKey)
    try {
      realDirectory(this.directory)
      realDirectory(path.dirname(file))
      const stat = fs.lstatSync(file)
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Mail attachment file is unsafe')
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
