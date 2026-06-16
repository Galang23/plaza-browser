import { app, safeStorage } from 'electron'
import { join } from 'path'
import { readFile, writeFile, unlink, mkdir } from 'fs/promises'
import { existsSync } from 'fs'

export type SecretStorageStatus = {
  backend: 'safeStorage' | 'env-var-fallback' | 'unavailable'
  available: boolean
  reason?: string
}

const STATUS: { current: SecretStorageStatus | null } = { current: null }
const ENC_PREFIX = 'plaza-secret:v1:'
const ENC_SUFFIX = ':v1'

let secretsDir: string | null = null

function getSecretsDir(): string {
  if (secretsDir) return secretsDir
  secretsDir = join(app.getPath('userData'), 'secrets')
  return secretsDir
}

async function ensureSecretsDir(): Promise<void> {
  const dir = getSecretsDir()
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true, mode: 0o700 })
  }
}

function isValidConsumerId(id: unknown): id is string {
  return typeof id === 'string' && /^[A-Za-z0-9_.-]{1,64}$/.test(id)
}

function isValidKeyName(name: unknown): name is string {
  return typeof name === 'string' && /^[A-Za-z0-9_.-]{1,128}$/.test(name)
}

function safeStorageFilePath(consumerId: string, name: string): string {
  return join(getSecretsDir(), `${consumerId}.${name}.bin`)
}

function envVarName(consumerId: string, name: string): string {
  return `PLAZA_SECRET_${consumerId.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_${name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`
}

export async function initSecretStorage(): Promise<SecretStorageStatus> {
  if (STATUS.current) return STATUS.current

  const available = await safeStorage.isAsyncEncryptionAvailable().catch(() => false)
  if (available) {
    await ensureSecretsDir()
    STATUS.current = { backend: 'safeStorage', available: true }
  } else {
    STATUS.current = {
      backend: 'unavailable',
      available: false,
      reason: 'OS secret store (Keychain / DPAPI / libsecret / kwallet) is not available. No fallback will be used; opt-in env-var fallback is per consumer via getSecret() / setSecret().'
    }
  }
  return STATUS.current
}

export function getSecretStorageStatus(): SecretStorageStatus {
  return STATUS.current ?? { backend: 'unavailable', available: false, reason: 'initSecretStorage() has not been called yet.' }
}

export async function setSecret(consumerId: string, name: string, value: string): Promise<{ storedAs: 'safeStorage' | 'env-var-fallback' }> {
  if (!isValidConsumerId(consumerId)) throw new Error(`Invalid consumerId: ${String(consumerId)}`)
  if (!isValidKeyName(name)) throw new Error(`Invalid secret name: ${String(name)}`)
  if (typeof value !== 'string') throw new Error('Secret value must be a string')

  const status = getSecretStorageStatus()
  if (status.backend === 'safeStorage') {
    const ciphertext = await safeStorage.encryptString(value)
    const filePath = safeStorageFilePath(consumerId, name)
    const payload = Buffer.concat([Buffer.from(ENC_PREFIX, 'utf8'), ciphertext, Buffer.from(ENC_SUFFIX, 'utf8')])
    await writeFile(filePath, payload, { mode: 0o600 })
    return { storedAs: 'safeStorage' }
  }

  const envName = envVarName(consumerId, name)
  if (process.env[envName] !== undefined) {
    process.env[envName] = value
    return { storedAs: 'env-var-fallback' }
  }
  throw new Error(
    `Secret "${name}" for consumer "${consumerId}" cannot be stored: safeStorage is unavailable, and the env-var fallback ${envName} is not pre-declared. ` +
    `The consumer must opt into the env-var fallback by setting the env var to any value before calling setSecret().`
  )
}

export async function getSecret(consumerId: string, name: string): Promise<string | null> {
  if (!isValidConsumerId(consumerId)) throw new Error(`Invalid consumerId: ${String(consumerId)}`)
  if (!isValidKeyName(name)) throw new Error(`Invalid secret name: ${String(name)}`)

  const status = getSecretStorageStatus()
  if (status.backend === 'safeStorage') {
    const filePath = safeStorageFilePath(consumerId, name)
    if (!existsSync(filePath)) return null
    const buf = await readFile(filePath)
    if (!buf.toString('utf8').startsWith(ENC_PREFIX) || !buf.toString('utf8').endsWith(ENC_SUFFIX)) {
      throw new Error(`Corrupt secret file for ${consumerId}/${name}`)
    }
    const payload = buf.subarray(Buffer.byteLength(ENC_PREFIX, 'utf8'), buf.length - Buffer.byteLength(ENC_SUFFIX, 'utf8'))
    return safeStorage.decryptString(payload)
  }

  const envName = envVarName(consumerId, name)
  return process.env[envName] ?? null
}

export async function deleteSecret(consumerId: string, name: string): Promise<void> {
  if (!isValidConsumerId(consumerId)) throw new Error(`Invalid consumerId: ${String(consumerId)}`)
  if (!isValidKeyName(name)) throw new Error(`Invalid secret name: ${String(name)}`)

  const status = getSecretStorageStatus()
  if (status.backend === 'safeStorage') {
    const filePath = safeStorageFilePath(consumerId, name)
    if (existsSync(filePath)) {
      await unlink(filePath)
    }
    return
  }

  const envName = envVarName(consumerId, name)
  if (process.env[envName] !== undefined) {
    delete process.env[envName]
  }
}

export async function listSecretConsumers(): Promise<string[]> {
  if (getSecretStorageStatus().backend !== 'safeStorage') return []
  await ensureSecretsDir()
  const { readdir } = await import('fs/promises')
  const files = await readdir(getSecretsDir()).catch(() => [] as string[])
  const consumerIds = new Set<string>()
  for (const file of files) {
    const dot = file.indexOf('.')
    if (dot > 0) consumerIds.add(file.slice(0, dot))
  }
  return Array.from(consumerIds).sort()
}
