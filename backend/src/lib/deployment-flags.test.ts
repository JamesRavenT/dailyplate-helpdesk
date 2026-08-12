import { describe, expect, test } from 'bun:test'
import { isEmailDeliveryEnabled, isStubAiAllowed } from './deployment-flags.ts'

describe('isStubAiAllowed', () => {
  test.each([
    { nodeEnv: 'production', flag: undefined, expected: false },
    { nodeEnv: 'production', flag: 'true', expected: true },
    { nodeEnv: 'production', flag: '1', expected: false },
    { nodeEnv: 'development', flag: undefined, expected: true },
    { nodeEnv: 'development', flag: 'true', expected: true },
    { nodeEnv: 'development', flag: '1', expected: true },
  ])('returns $expected for NODE_ENV=$nodeEnv and ALLOW_STUB_AI=$flag', ({
    nodeEnv,
    flag,
    expected,
  }) => {
    expect(isStubAiAllowed(nodeEnv, flag)).toBe(expected)
  })

  test('preserves the production and development defaults', () => {
    expect(isStubAiAllowed('production', undefined)).toBe(false)
    expect(isStubAiAllowed('development', undefined)).toBe(true)
  })
})

describe('isEmailDeliveryEnabled', () => {
  test.each([
    { nodeEnv: 'production', flag: undefined, expected: true },
    { nodeEnv: 'production', flag: 'false', expected: false },
    { nodeEnv: 'production', flag: 'maybe', expected: true },
    { nodeEnv: 'development', flag: undefined, expected: false },
    { nodeEnv: 'development', flag: 'false', expected: false },
    { nodeEnv: 'development', flag: 'maybe', expected: false },
  ])('returns $expected for NODE_ENV=$nodeEnv and EMAIL_DELIVERY_ENABLED=$flag', ({
    nodeEnv,
    flag,
    expected,
  }) => {
    expect(isEmailDeliveryEnabled(nodeEnv, flag)).toBe(expected)
  })

  test('preserves the production and development defaults', () => {
    expect(isEmailDeliveryEnabled('production', undefined)).toBe(true)
    expect(isEmailDeliveryEnabled('development', undefined)).toBe(false)
  })
})
