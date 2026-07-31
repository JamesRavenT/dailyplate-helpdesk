import { describe, expect, test } from 'bun:test'
import { normalizeSignOff } from './text.ts'

describe('normalizeSignOff', () => {
  test('collapses blank lines before the support team name', () => {
    expect(normalizeSignOff('Thanks for reaching out.\n\nWarm regards,\n\nDailyPlate Support Team')).toBe(
      'Thanks for reaching out.\n\nWarm regards,\nDailyPlate Support Team',
    )
  })

  test('leaves an already-correct sign-off unchanged', () => {
    const reply = 'Thanks for reaching out.\n\nWarm regards,\nDailyPlate Support Team'
    expect(normalizeSignOff(reply)).toBe(reply)
  })

  test('is idempotent', () => {
    const reply = 'Thanks.\n\nBest regards,\n\n\nDailyPlate Support Team   '
    const normalized = normalizeSignOff(reply)
    expect(normalizeSignOff(normalized)).toBe(normalized)
  })

  for (const regards of ['Warm regards,', 'Best regards,', 'Kind regards,', 'Regards,']) {
    test(`normalizes the ${regards} variant`, () => {
      expect(normalizeSignOff(`${regards}\n\nDailyPlate Support Team`)).toBe(
        `${regards}\nDailyPlate Support Team`,
      )
    })
  }
})
