import { Box, Button, Input, Row, Text, atom, plugin, read, set, settings, type PanelContext } from 'orca'
import { defaultRefreshMinutes, parseRefreshMinutes } from './interval'

const minutes = atom('')
const ready = atom(false)
const saving = atom(false)
const refreshing = atom(false)
const notice = atom('')

export function setup({ subscriptions, signal }: PanelContext): void {
  const load = async () => {
    try {
      const value = await settings.get('refreshMinutes')
      if (signal.aborted) return
      set(minutes, String(parseRefreshMinutes(value) ?? defaultRefreshMinutes))
      set(ready, true)
    } catch {
      if (!signal.aborted) set(notice, 'Could not load the refresh interval.')
    }
  }
  subscriptions.push(settings.onDidChange(({ key }) => {
    if (key === 'refreshMinutes') void load()
  }))
  void load()
}

async function save(value: string): Promise<void> {
  if (!read(ready) || read(saving)) return
  const parsed = parseRefreshMinutes(value)
  const interval = parsed ?? defaultRefreshMinutes
  set(saving, true)
  try {
    await settings.set('refreshMinutes', interval)
    set(minutes, String(interval))
    set(notice, parsed === undefined ? 'Invalid interval. Using the 15-minute default.' : 'Interval saved.')
  } catch {
    set(notice, 'Could not save the refresh interval.')
  } finally {
    set(saving, false)
  }
}

async function refreshNow(): Promise<void> {
  if (read(refreshing)) return
  set(refreshing, true)
  set(notice, '')
  try {
    await plugin.request('refresh')
  } catch {
    set(notice, 'Could not refresh Fuel Gauge.')
  } finally {
    set(refreshing, false)
  }
}

export default function Panel() {
  const disabled = !read(ready) || read(saving)
  return (
    <Box padding="md" gap="sm">
      <Input
        label="Refresh interval (minutes)"
        value={read(minutes)}
        onChange={(value) => set(minutes, value)}
        onSubmit={save}
        disabled={disabled}
      />
      <Text size="sm" muted>Enter a whole number from 1 to 1440.</Text>
      <Row gap="sm" wrap>
        <Button disabled={disabled} onPress={() => save(read(minutes))}>Save interval</Button>
        <Button icon="refresh" variant="outline" disabled={read(refreshing)} onPress={refreshNow}>
          {read(refreshing) ? 'Refreshing…' : 'Refresh now'}
        </Button>
      </Row>
      {read(notice) && <Text size="sm">{read(notice)}</Text>}
    </Box>
  )
}
