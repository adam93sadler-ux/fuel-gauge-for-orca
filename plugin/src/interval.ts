export const defaultRefreshMinutes = 15

export function parseRefreshMinutes(value: unknown): number | undefined {
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) value = Number(value)
  if (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 1440) {
    return value
  }
}
