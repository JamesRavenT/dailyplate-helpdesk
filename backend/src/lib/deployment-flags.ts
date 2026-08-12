export function isStubAiAllowed(
  nodeEnv: string | undefined,
  allowStubAi: string | undefined,
): boolean {
  return nodeEnv !== 'production' || allowStubAi === 'true'
}

export function isEmailDeliveryEnabled(
  nodeEnv: string | undefined,
  emailDeliveryEnabled: string | undefined,
): boolean {
  return nodeEnv === 'production' && emailDeliveryEnabled !== 'false'
}
