import type { OrcaWorkerApi } from 'orca/worker'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { adapters, inventory, ReadingError, type Usage } from './providers'

const directory = join(homedir(), '.local/share/fuel-gauge')
const latest = join(directory, 'latest.json')
type Provider = string
type Reading = Usage & { setUp: boolean; ok: boolean; lastOkAt: string | null; reason?: string; error: string | null }
type Snapshot = { updatedAt: string; refreshMinutes: number; providers: Partial<Record<Provider, Reading>> }

const minuteMs = 60_000
let refreshMinutes = 15
let lastRefreshAt: number | undefined
let refreshTimer: ReturnType<typeof setTimeout> | undefined
let displayTimer: ReturnType<typeof setInterval> | undefined
let inFlight: Promise<Status> | undefined
let disposed = false
const subscriptions: { dispose(): void }[] = []
type Status = { text: string; tone: 'neutral' | 'warning'; tooltip: string }

export default function activate(orca: OrcaWorkerApi): void {
  disposed = false
  subscriptions.push(
    orca.commands.register('fuel-gauge.refresh', () => { void refresh(orca) }),
    orca.panels.handle('refresh', () => refresh(orca)),
    orca.settings.onDidChange(() => { void refresh(orca) })
  )
  displayTimer = setInterval(() => { void paintStatus(orca) }, minuteMs)
  void refresh(orca)
}

export async function deactivate(): Promise<void> {
  disposed = true
  clearTimeout(refreshTimer)
  clearInterval(displayTimer)
  for (const subscription of subscriptions.splice(0)) subscription.dispose()
  await inFlight
}

async function readJson(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT' || error instanceof SyntaxError) return null
    throw error
  }
}

async function readProvider(adapter: ReturnType<typeof adapters>[string], lastOkAt: string | null): Promise<Reading | undefined> {
  let setUp = true
  try {
    const query = await adapter.detect()
    if (!query) {
      setUp = false
      if (!lastOkAt) return
      throw new ReadingError('local login no longer found')
    }
    const reading = await query()
    if (!reading.windows.length && !reading.balances?.length) throw new ReadingError('no quota or balance in the reply')
    return { ...reading, setUp, ok: true, lastOkAt: new Date().toISOString(), error: null }
  } catch (error) {
    const reason = error instanceof ReadingError ? error.message : 'unable to read usage'
    return { reason, setUp, ok: false, windows: [], lastOkAt,
      error: reason }
  }
}

async function writeSnapshot(snapshot: Snapshot): Promise<void> {
  await mkdir(directory, { recursive: true, mode: 0o700 })
  const temp = join(directory, `.latest-${randomUUID()}.tmp`)
  try {
    await writeFile(temp, JSON.stringify(snapshot, null, 2) + '\n', { mode: 0o600, flag: 'wx' })
    await rename(temp, latest)
  } finally {
    await unlink(temp).catch(() => {})
  }
}

function refresh(orca: OrcaWorkerApi): Promise<Status> {
  if (inFlight) return inFlight
  clearTimeout(refreshTimer)
  inFlight = refreshOnce(orca)
  return inFlight
}

async function refreshOnce(orca: OrcaWorkerApi): Promise<Status> {
  try {
    const previous = await readJson(latest) as Snapshot | null
    const restoring = lastRefreshAt === undefined
    if (restoring && typeof previous?.updatedAt === 'string') {
      const timestamp = Date.parse(previous.updatedAt)
      if (Number.isFinite(timestamp)) lastRefreshAt = timestamp
    }
    const config = await orca.settings.get()
    const value = config.refreshMinutes
    if (typeof value === 'number' && Number.isFinite(value)) {
      refreshMinutes = Math.min(35_000, Math.max(5, Math.round(value)))
    }
    if (restoring && lastRefreshAt !== undefined) await paintStatus(orca)
    const ignoreFile = await readJson(join(directory, 'ignored-providers.json'))
    const ignored = new Set(Array.isArray(ignoreFile) ? ignoreFile : [])
    const state = (await orca.storage.get('lastOkAt').catch(() => null) ?? {}) as Partial<Record<Provider, string>>
    const providers = adapters(await inventory())
    const ids = Object.keys(providers)
    const readings = await Promise.all(ids.filter((id) => !ignored.has(id)).map(async (id) =>
      [id, await readProvider(providers[id], previous?.providers?.[id]?.lastOkAt ?? state[id] ?? null)] as const
    ))
    const snapshot: Snapshot = { updatedAt: new Date().toISOString(), refreshMinutes, providers: {} }
    for (const [id, reading] of readings) {
      if (!reading) continue
      snapshot.providers[id] = reading
      if (reading.lastOkAt) state[id] = reading.lastOkAt
    }
    if (!disposed) {
      await writeSnapshot(snapshot)
      lastRefreshAt = Date.parse(snapshot.updatedAt)
      await orca.storage.set('lastOkAt', state).catch(() => {})
    }
  } catch {
    orca.log('Fuel Gauge could not refresh the shared snapshot.')
  }
  try {
    return await paintStatus(orca)
  } finally {
    inFlight = undefined
    if (!disposed) refreshTimer = setTimeout(() => { void refresh(orca) }, refreshMinutes * minuteMs)
  }
}

function formatAge(ageMs: number): string {
  const minutes = Math.floor(ageMs / minuteMs)
  if (minutes === 0) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function currentStatus(): Status {
  const age = lastRefreshAt === undefined ? undefined : Math.max(0, Date.now() - lastRefreshAt)
  const active = age !== undefined && age <= 1.5 * refreshMinutes * minuteMs
  const label = age === undefined ? 'inactive' : active ? formatAge(age) : `inactive (${formatAge(age)})`
  return { text: `Fuel Gauge · ${label}`, tone: active ? 'neutral' : 'warning', tooltip: 'Click to refresh' }
}

async function paintStatus(orca: OrcaWorkerApi): Promise<Status> {
  const status = currentStatus()
  try {
    if (!disposed) await orca.host.call('statusBar.update', { id: 'fuel-gauge', ...status })
  } catch {
    orca.log('Fuel Gauge could not update the status bar.')
  }
  return status
}
