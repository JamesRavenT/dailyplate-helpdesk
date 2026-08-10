import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  type AccessGateContextValue,
  useAccessGate,
} from '../context/AccessGateContext'
import AccessGate from './AccessGate'

vi.mock('../context/AccessGateContext', () => ({
  useAccessGate: vi.fn(),
}))

const submitKey = vi.fn()
const retry = vi.fn()

const defaultContext: AccessGateContextValue = {
  phase: 'gated',
  reason: 'none',
  retryAfterSeconds: 0,
  isVerifying: false,
  submitKey,
  retry,
}

function renderAccessGate(overrides: Partial<AccessGateContextValue> = {}) {
  vi.mocked(useAccessGate).mockReturnValue({
    ...defaultContext,
    ...overrides,
  })

  return render(
    <AccessGate>
      <div>Protected content</div>
    </AccessGate>,
  )
}

describe('AccessGate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows only a status while access is being checked', () => {
    renderAccessGate({ phase: 'checking' })

    expect(screen.getByRole('status')).toHaveTextContent('Checking access')
    expect(screen.queryByRole('form')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Access key')).not.toBeInTheDocument()
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
  })

  it('renders only children when access is granted', () => {
    renderAccessGate({ phase: 'granted' })

    expect(screen.getByText('Protected content')).toBeInTheDocument()
    expect(screen.queryByLabelText('Access key')).not.toBeInTheDocument()
  })

  it('renders the gate form without an alert when there is no error', () => {
    renderAccessGate()

    expect(screen.getByRole('heading', { name: 'Access required' })).toBeInTheDocument()
    expect(screen.getByLabelText('Access key')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
  })

  it('explains that an expired key must be replaced', () => {
    renderAccessGate({ reason: 'expired' })

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(
      'This access key has expired. Please request a new one from the site owner and enter it above.',
    )
    expect(alert).not.toHaveTextContent("isn't valid")
  })

  it('shows project-specific invalid-key copy', () => {
    renderAccessGate({ reason: 'invalid' })

    expect(screen.getByRole('alert')).toHaveTextContent(
      "That key isn't valid for this project.",
    )
  })

  it('offers a retry action when verification is unavailable', async () => {
    const user = userEvent.setup()
    renderAccessGate({ reason: 'unavailable' })

    expect(screen.getByRole('alert')).toHaveTextContent(
      "Couldn't verify your key right now. Please try again.",
    )
    await user.type(screen.getByLabelText('Access key'), 'KEY')
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(submitKey).toHaveBeenCalledWith('KEY')
  })

  it('shows a live rate-limit value and disables submission', async () => {
    const user = userEvent.setup()
    renderAccessGate({ reason: 'rate-limited', retryAfterSeconds: 30 })
    await user.type(screen.getByLabelText('Access key'), 'KEY')

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Too many attempts. Please try again in 30s.',
    )
    expect(screen.getByRole('button', { name: 'Try again' })).toBeDisabled()
  })

  it('shows a configuration error and disables submission', async () => {
    const user = userEvent.setup()
    renderAccessGate({ reason: 'misconfigured' })
    await user.type(screen.getByLabelText('Access key'), 'KEY')

    expect(screen.getByRole('alert')).toHaveTextContent(
      "The access gate isn't configured correctly. Please contact the site owner.",
    )
    expect(screen.getByRole('button', { name: 'Try again' })).toBeDisabled()
  })

  it('submits the raw typed key for provider normalization', async () => {
    const user = userEvent.setup()
    renderAccessGate()

    await user.type(screen.getByLabelText('Access key'), 'MiXeD-key')
    await user.click(screen.getByRole('button', { name: 'Unlock' }))

    expect(submitKey).toHaveBeenCalledWith('MiXeD-key')
  })

  it('disables submission while verifying and for empty or whitespace input', async () => {
    const user = userEvent.setup()
    const { rerender } = renderAccessGate()
    const input = screen.getByLabelText('Access key')

    expect(screen.getByRole('button', { name: 'Unlock' })).toBeDisabled()
    await user.type(input, '   ')
    expect(screen.getByRole('button', { name: 'Unlock' })).toBeDisabled()
    await user.type(input, 'KEY')
    expect(screen.getByRole('button', { name: 'Unlock' })).toBeEnabled()

    vi.mocked(useAccessGate).mockReturnValue({
      ...defaultContext,
      isVerifying: true,
    })
    rerender(
      <AccessGate>
        <div>Protected content</div>
      </AccessGate>,
    )
    expect(screen.getByRole('button', { name: 'Checking…' })).toBeDisabled()
  })

  it('marks error feedback as an alert and describes the input with it', () => {
    renderAccessGate({ reason: 'invalid' })

    const alert = screen.getByRole('alert')
    expect(alert).toHaveAttribute('id', 'access-key-error')
    expect(screen.getByLabelText('Access key')).toHaveAttribute(
      'aria-describedby',
      'access-key-error',
    )
  })
})
