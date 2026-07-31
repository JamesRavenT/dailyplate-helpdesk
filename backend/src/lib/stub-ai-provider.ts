import type { ProcessPromptInput, ProcessResult } from './ai-provider.ts'

function titleCase(value: string): string {
  return value
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

const introductionFalsePositives = new Set([
  'A',
  'Currently',
  'Having',
  'Here',
  'Interested',
  'Just',
  'Looking',
  'Not',
  'On',
  'Relocating',
  'Sorry',
  'That',
  'The',
  'There',
  'This',
  'Tracking',
  'Trying',
  'Unable',
  'Wondering',
])

function resolveCustomerName(input: ProcessPromptInput): string {
  // Keep this case-sensitive: a real introduction contains a proper name as written,
  // while ordinary prose such as "I'm relocating" must not become a fabricated name.
  const introduction = input.body.match(
    /(?:\b[Mm]y name is|\b[Tt]his is|\bI(?:'|’)m)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/,
  )
  if (introduction) {
    const firstToken = introduction[1].split(' ')[0]
    if (!introductionFalsePositives.has(firstToken)) return titleCase(introduction[1])
  }

  if (input.currentName && !input.currentName.includes('@')) {
    return titleCase(input.currentName)
  }

  const localPart = input.customerEmail.split('@')[0].replace(/\d+/g, ' ')
  return titleCase(localPart) || 'Customer'
}

export function processTicketWithStub(input: ProcessPromptInput): ProcessResult {
  const text = `${input.subject}\n${input.body}`.toLowerCase()
  const customerName = resolveCustomerName(input)
  const firstName = customerName.split(' ')[0]

  let category: ProcessResult['category'] = 'OTHER'
  if (/\b(voucher|promo|discount|gift card)\b/.test(text)) category = 'VOUCHER'
  else if (/\b(payment|charged|charge|billing|refund|invoice|card)\b/.test(text)) category = 'PAYMENT'
  else if (/\b(delivery|delivered|order|courier)\b/.test(text)) category = 'DELIVERY'
  else if (/\b(menu|meal|food|diet|allerg|vegetarian|vegan)\b/.test(text)) category = 'MENU'
  else if (/\b(login|log in|password|account|profile|subscription)\b/.test(text)) category = 'ACCOUNT'
  else if (/\b(bug|crash|error|broken|not working|can't save|cannot save)\b/.test(text)) category = 'TECHNICAL'
  else if (/\b(how|what|where|when|plan|pricing|price|question)\b/.test(text)) category = 'INQUIRY'

  let priority: ProcessResult['priority'] = 'LOW'
  if (/\b(locked|declined|payment fail|missing delivery|not delivered|data loss|service down)\b/.test(text)) {
    priority = 'HIGH'
  } else if (/\b(late|charged twice|billing confusion|wrong order|degraded)\b/.test(text)) {
    priority = 'MEDIUM'
  }

  const requiresAccountAction =
    /\b(cannot|can't|unable|locked|not working|broken|error|crash|charged|declined|missing|late|wrong)\b/.test(text) ||
    /\b(please|need you to)\s+(refund|cancel|reset|change|investigate|fix)\b/.test(text) ||
    /\b(my|this)\s+(account|order|payment|invoice|subscription|delivery)\b/.test(text)

  const isGeneralQuestion =
    /\b(how (?:do|can|to)|where (?:do|can|to)|what (?:is|are)|policy|pricing|price|plan)\b/.test(text) ||
    /\b(voucher|promo|discount|gift card)\b/.test(text)

  const canResolve = isGeneralQuestion && !requiresAccountAction
  const reply = canResolve
    ? `Dear ${firstName},\n\nThank you for contacting DailyPlate Support. You can find and use the relevant option from your DailyPlate account. Please follow the on-screen instructions; no account-specific action is required from our team.\n\nBest regards,\nDailyPlate Support Team`
    : ''

  return { customerName, category, priority, canResolve, reply }
}
