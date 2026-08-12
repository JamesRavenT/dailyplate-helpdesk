import { z } from 'zod'
import { isStubAiAllowed } from './deployment-flags.ts'

export const processSchema = z.object({
  customerName: z.string(),
  category: z.enum(['ACCOUNT', 'INQUIRY', 'PAYMENT', 'TECHNICAL', 'VOUCHER', 'OTHER', 'DELIVERY', 'MENU']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  canResolve: z.boolean(),
  reply: z.string(),
})

export type ProcessResult = z.infer<typeof processSchema>

export type ProcessPromptInput = {
  customerEmail: string
  currentName: string
  subject: string
  body: string
  articleContext: string
}

export type AiProviderName = 'openai' | 'stub'

const configuredProvider = process.env.AI_PROVIDER ?? 'openai'

if (configuredProvider !== 'openai' && configuredProvider !== 'stub') {
  throw new Error('AI_PROVIDER must be either "openai" or "stub"')
}

if (
  configuredProvider === 'stub' &&
  !isStubAiAllowed(process.env.NODE_ENV, process.env.ALLOW_STUB_AI)
) {
  throw new Error('AI_PROVIDER=stub is not allowed in production')
}

export const selectedAiProvider: AiProviderName = configuredProvider

export async function processTicketWithAi(input: ProcessPromptInput): Promise<ProcessResult> {
  if (selectedAiProvider === 'stub') {
    const { processTicketWithStub } = await import('./stub-ai-provider.ts')
    return processTicketWithStub(input)
  }

  const { processTicketWithOpenAi } = await import('./openai-ai-provider.ts')
  return processTicketWithOpenAi(input)
}
