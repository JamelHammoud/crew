import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { safeStorage } from 'electron'
import { parseMailCredentials, type MailCredentials } from '../../shared/mail'

export interface MailSafeStorage {
  isEncryptionAvailable(): boolean
  encryptString(value: string): Buffer
  decryptString(value: Buffer): string
  getSelectedStorageBackend?(): 'basic_text' | 'gnome_libsecret' | 'kwallet' | 'kwallet5' | 'kwallet6' | 'unknown'
}

interface StoredCredentials {
  version: 1
  accounts: Record<string, MailCredentials>
}

const FILE_MODE = 0o600
const DIRECTORY_MODE = 0o700

function accountId(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError('Mail account id cannot be empty')
  return value.trim()
}

export class MailCredentialStore {
  readonly file: string

  constructor(stateDirectory: string, private readonly storage: MailSafeStorage = safeStorage) {
    this.file = path.join(stateDirectory, 'credentials.bin')
  }

  has(account: string): boolean {
    return Object.hasOwn(this.read().accounts, accountId(account))
  }

  get(account: string): MailCredentials | null {
    const value = this.read().accounts[accountId(account)]
    return value ? { ...value } : null
  }

  set(account: string, credentials: unknown): void {
    const id = accountId(account)
    const stored = this.read()
    stored.accounts[id] = parseMailCredentials(credentials)
    this.write(stored)
  }

  delete(account: string): boolean {
    const id = accountId(account)
    const stored = this.read()
    if (!Object.hasOwn(stored.accounts, id)) return false
    delete stored.accounts[id]
    if (Object.keys(stored.accounts).length === 0) {
      try {
        fs.rmSync(this.file, { force: true })
      } catch {}
      return true
    }
    this.write(stored)
    return true
  }

  private assertEncryption(): void {
    if (!this.storage.isEncryptionAvailable()) throw new Error('Secure credential storage is unavailable')
    if (this.storage.getSelectedStorageBackend?.() === 'basic_text') throw new Error('Secure credential storage is unavailable')
  }

  private read(): StoredCredentials {
    this.assertEncryption()
    let encrypted: Buffer
    try {
      encrypted = fs.readFileSync(this.file)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { version: 1, accounts: {} }
      throw error
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(this.storage.decryptString(encrypted))
    } catch {
      throw new Error('Mail credentials could not be decrypted')
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('Mail credentials are invalid')
    const stored = parsed as Record<string, unknown>
    if (stored.version !== 1 || typeof stored.accounts !== 'object' || stored.accounts === null || Array.isArray(stored.accounts)) {
      throw new Error('Mail credentials are invalid')
    }
    const accounts: Record<string, MailCredentials> = {}
    for (const [id, value] of Object.entries(stored.accounts)) {
      accounts[accountId(id)] = parseMailCredentials(value)
    }
    return { version: 1, accounts }
  }

  private write(stored: StoredCredentials): void {
    this.assertEncryption()
    fs.mkdirSync(path.dirname(this.file), { recursive: true, mode: DIRECTORY_MODE })
    fs.chmodSync(path.dirname(this.file), DIRECTORY_MODE)
    const temporary = `${this.file}.${process.pid}.${randomUUID()}.tmp`
    const encrypted = this.storage.encryptString(JSON.stringify(stored))
    try {
      fs.writeFileSync(temporary, encrypted, { mode: FILE_MODE, flag: 'wx' })
      fs.chmodSync(temporary, FILE_MODE)
      fs.renameSync(temporary, this.file)
      fs.chmodSync(this.file, FILE_MODE)
    } catch (error) {
      try {
        fs.rmSync(temporary, { force: true })
      } catch {}
      throw error
    }
  }
}
