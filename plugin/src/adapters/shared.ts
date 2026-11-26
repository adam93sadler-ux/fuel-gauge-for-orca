import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

export const run = promisify(execFile)
export const home = homedir()
export type Window = { name: string; usedPercent: number; resetsAt: string | null; minutes?: number }
export type Usage = { windows: Window[]; balances?: { currency: string; total: number }[] }
export type Query = () => Promise<Usage>
export type RecordValue = Record<string, unknown>

export function record(value: unknown): RecordValue {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {}
}

export function rows(value: unknown): RecordValue[] {
  return Array.isArray(value) ? value.map(record) : []
}

export function string(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

export async function localFile(path: string): Promise<string | undefined> {
  try {
    return await readFile(join(home, path), 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw new ReadingError('local login could not be read')
  }
}

export function decode(value: string): unknown {
  try { return JSON.parse(value) } catch { throw new ReadingError('unrecognized data format') }
}

export async function login(path: string): Promise<RecordValue | undefined> {
  const text = await localFile(path)
  return text === undefined ? undefined : record(decode(text))
}

export class ReadingError extends Error {}

export async function api(url: string, token: string, headers: Record<string, string> = {}) {
  const signal = AbortSignal.timeout(12_000)
  try {
    const response = await fetch(url, {
      redirect: 'error', signal,
      headers: { ...headers, Authorization: `Bearer ${token}`, Accept: 'application/json' }
    })
    if (!response.ok) {
      await response.body?.cancel()
      throw new ReadingError(
        response.status === 401 || response.status === 403 ? 'login rejected'
          : response.status === 429 ? 'usage endpoint is rate limiting requests'
          : `usage endpoint returned HTTP ${response.status}`
      )
    }
    return record(decode(await response.text()))
  } catch (error) {
    if (error instanceof ReadingError) throw error
    throw new ReadingError(signal.aborted ? 'usage request timed out' : 'usage endpoint unavailable')
  }
}

export function window(name: string, percent: unknown, reset: unknown, minutes?: number): Window[] {
  if (typeof percent !== 'number' || !Number.isFinite(percent)) return []
  const date = typeof reset === 'number' ? new Date(reset * 1000) : new Date(string(reset) ?? '')
  return [{
    name, usedPercent: Math.min(100, Math.max(0, percent)),
    resetsAt: date.getTime() > 0 ? date.toISOString() : null,
    ...(minutes ? { minutes } : {})
  }]
}

