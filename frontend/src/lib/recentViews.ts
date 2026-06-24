const MAX_RECENT = 5

function storageKey(userId: string) {
  return `helpdesk_recent_views_${userId}`
}

export function trackRecentView(userId: string, ticketId: string) {
  try {
    const existing: string[] = JSON.parse(localStorage.getItem(storageKey(userId)) ?? '[]')
    const updated = [ticketId, ...existing.filter(id => id !== ticketId)].slice(0, MAX_RECENT)
    localStorage.setItem(storageKey(userId), JSON.stringify(updated))
  } catch {}
}

export function getRecentViewIds(userId: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(storageKey(userId)) ?? '[]')
  } catch {
    return []
  }
}
