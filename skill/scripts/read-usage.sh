#!/usr/bin/env bash
# Read a fresh plugin snapshot, or fall back to local transcripts.
exec python3 - "$@" <<'PY'
from collections import deque
from datetime import datetime, timezone
import fcntl
import json
import os
from pathlib import Path
import sys
import tempfile

home = Path.home()
shared = home / '.local/share/fuel-gauge'
log = Path(os.environ.get('FUEL_GAUGE_LOG', shared / 'readings.jsonl'))
names = {'claude': 'Claude', 'codex': 'Codex', 'antigravity': 'Antigravity', 'deepseek': 'DeepSeek'}
fixes = {
    'claude': 'Run /login in Claude Code and refresh.',
    'codex': 'Check codex login status and run codex login if needed.',
    'antigravity': 'Check your agy login and version, then refresh.',
    'deepseek': 'Check the key in ~/.config/deepseek/api_key and refresh.',
}
now = datetime.now(timezone.utc)


def decode(text):
    try:
        return json.loads(text)
    except (ValueError, UnicodeError):
        return None


def read_json(path):
    try:
        return decode(path.read_text())
    except OSError:
        return None


def iso(epoch):
    try:
        return datetime.fromtimestamp(epoch, timezone.utc).isoformat()
    except (ValueError, TypeError, OverflowError, OSError):
        return None


def fresh(snapshot):
    try:
        age = (now - datetime.fromisoformat(snapshot['updatedAt'].replace('Z', '+00:00'))).total_seconds()
        return isinstance(snapshot['providers'], dict) and 0 <= age <= 120 * snapshot.get('refreshMinutes', 15)
    except (ValueError, TypeError, KeyError, AttributeError):
        return False


def tail_records(root):
    # Inspect recent sessions first and bound each scan to the last 2 MiB.
    try:
        files = sorted(root.rglob('*.jsonl'), key=lambda p: p.stat().st_mtime, reverse=True)[:20]
    except OSError:
        return
    for path in files:
        try:
            with path.open('rb') as handle:
                handle.seek(max(0, os.fstat(handle.fileno()).st_size - 2 * 1024 * 1024))
                lines = handle.readlines()
        except OSError:
            continue
        for line in reversed(lines):
            row = decode(line)
            if isinstance(row, dict):
                yield row


def local_readings(ignored):
    providers = {}
    if 'codex' not in ignored:
        for row in tail_records(home / '.codex/sessions'):
            payload = row.get('payload') or {}
            limits = (payload.get('rate_limits') or {}) if isinstance(payload, dict) else {}
            windows = []
            for slot in ('primary', 'secondary'):
                value = limits.get(slot) or {}
                reset = value.get('resets_at')
                used = value.get('used_percent')
                if isinstance(used, (int, float)) and isinstance(reset, (int, float)) and reset > now.timestamp():
                    minutes = value.get('window_minutes')
                    name = 'week' if minutes == 10080 else f'{minutes}m' if minutes else slot
                    windows.append({'name': name, 'usedPercent': used, 'resetsAt': iso(reset)})
            if windows:
                providers['codex'] = {'ok': True, 'windows': windows, 'observedAt': row.get('timestamp')}
                break
    if 'claude' not in ignored:
        for row in tail_records(home / '.claude/projects'):
            limit = row.get('rate_limit_info') or {}
            if row.get('type') == 'rate_limit_event' or limit:
                reset = limit.get('resetsAt')
                if limit.get('status') == 'rejected' and isinstance(reset, (int, float)) and reset > now.timestamp():
                    providers['claude'] = {'ok': True, 'windows': [{
                        'name': limit.get('rateLimitType', 'limit hit'), 'usedPercent': 100, 'resetsAt': iso(reset)
                    }], 'observedAt': row.get('timestamp')}
                    break
    return providers


def atomic_write(path, contents):
    with tempfile.NamedTemporaryFile(mode='w', dir=path.parent, delete=False) as handle:
        temp = Path(handle.name)
        try:
            handle.write(contents)
            handle.close()
            temp.replace(path)
        finally:
            temp.unlink(missing_ok=True)


shared.mkdir(parents=True, exist_ok=True)
log.parent.mkdir(parents=True, exist_ok=True)
ignored = read_json(shared / 'ignored-providers.json')
ignored = {item for item in ignored if isinstance(item, str)} if isinstance(ignored, list) else set()
snapshot = read_json(shared / 'latest.json')
plugin = fresh(snapshot)
providers = snapshot['providers'] if plugin else local_readings(ignored)
providers = {key: value for key, value in providers.items() if key not in ignored}
for key in providers:
    names.setdefault(key, key)
entry = {'at': now.isoformat(), 'source': 'plugin' if plugin else 'local', 'providers': providers}
print(f"Fuel Gauge reading from {'Orca plugin at ' + snapshot['updatedAt'] if plugin else 'local transcripts'}")
for key, label in names.items():
    if key in ignored:
        continue
    reading = providers.get(key)
    if not reading and plugin:
        continue
    if not reading or not reading['ok']:
        reason = reading.get('error') if reading else 'no automatic reading'
        print(f'{label}: unknown ({reason})')
        continue
    meters = [f"{w['name']} {w['usedPercent']:g}% used, resets {w['resetsAt'] or 'unknown'}" for w in reading['windows']]
    meters += [f"{b['total']:.2f} {b['currency']}" for b in reading.get('balances', [])]
    observed = reading.get('observedAt')
    print(f"{label}: " + ' · '.join(meters) + (f' (observed {observed})' if observed else ''))

# Serialize history updates and quiet notices across skill invocations.
with (shared / '.readings.lock').open('a') as lock:
    fcntl.flock(lock, fcntl.LOCK_EX)
    state_path = shared / 'provider-state.json'
    state = read_json(state_path) or {}
    if plugin:
        for key, label in names.items():
            if key in ignored:
                continue
            reading = providers.get(key, {})
            previous = state.get(key, {})
            last_ok = reading.get('lastOkAt') or previous.get('lastOkAt')
            if not last_ok:
                continue
            notified = previous.get('notifiedFor')
            if not reading.get('ok') and notified != last_ok:
                reason = reading.get('error') or 'provider disappeared from the snapshot'
                if reason == 'usage endpoint is rate limiting requests':
                    fix = 'Wait for the next refresh.'
                else:
                    fix = fixes.get(key, 'Check the provider login and refresh.')
                print(f'{label} stopped reporting ({reason}). {fix}')
                notified = last_ok
            state[key] = {'lastOkAt': last_ok, 'notifiedFor': notified}
        atomic_write(state_path, json.dumps(state) + '\n')
    if len(sys.argv) > 1:
        if len(sys.argv) != 3 or sys.argv[1] != '--record-owner':
            sys.exit('Usage: read-usage.sh [--record-owner providers-json]')
        manual = decode(sys.argv[2])
        if not isinstance(manual, dict) or not manual or not set(manual) <= names.keys():
            sys.exit('Expected a JSON object keyed by provider ID.')
        entry = {'at': now.isoformat(), 'source': 'owner', 'providers': manual}
    existing = deque(maxlen=499)
    if log.exists():
        with log.open() as handle:
            existing.extend(handle)
    atomic_write(log, ''.join(line.rstrip('\n') + '\n' for line in existing) + json.dumps(entry) + '\n')
PY
