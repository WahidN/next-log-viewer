import type { Level } from './types'

export const LEVELS: Level[] = ['debug', 'info', 'warn', 'error']

export function levelRank(level: Level): number {
  return LEVELS.indexOf(level)
}

export function levelAtLeast(entry: Level, min: Level): boolean {
  return levelRank(entry) >= levelRank(min)
}
