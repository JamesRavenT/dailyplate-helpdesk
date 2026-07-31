const SIGN_OFF =
  /(Warm regards,|Best regards,|Kind regards,|Regards,)[ \t]*\r?\n(?:[ \t]*\r?\n)+[ \t]*DailyPlate Support Team(?=[ \t]*(?:\r?\n|$))/g

export function normalizeSignOff(text: string): string {
  return text.replace(SIGN_OFF, '$1\nDailyPlate Support Team').trimEnd()
}
