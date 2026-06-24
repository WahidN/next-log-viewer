import { expect, test } from 'vitest'
import { LEVELS, levelRank, levelAtLeast } from './levels'

test('levels are ordered low to high', () => {
  expect(LEVELS).toEqual(['debug', 'info', 'warn', 'error'])
  expect(levelRank('debug')).toBe(0)
  expect(levelRank('error')).toBe(3)
})

test('levelAtLeast filters by minimum level', () => {
  expect(levelAtLeast('error', 'warn')).toBe(true)
  expect(levelAtLeast('debug', 'warn')).toBe(false)
  expect(levelAtLeast('warn', 'warn')).toBe(true)
})
