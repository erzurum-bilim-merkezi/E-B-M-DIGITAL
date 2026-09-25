/**
 * Short name of a list item for its header and its move/delete buttons ("Tohum sil").
 * Empty items get a numbered fallback so every button keeps a distinct name.
 */
export function itemName(text: string, fallback: string, max = 40) {
  const clean = text.trim().replace(/\s+/g, ' ')
  if (!clean) return fallback
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean
}

/** First candidate no sibling uses yet — a new item gets a color, tone or state of its own. */
export function firstUnused<T>(candidates: readonly T[], used: readonly T[]): T | undefined {
  return candidates.find((candidate) => !used.includes(candidate))
}

/**
 * Error for one blank required field inside a list item. It shows only once the list itself has
 * a publish issue, so a freshly added (still empty) item is not flagged while it is being filled.
 */
export function blankItemError(listIssue: string | undefined, value: string, message: string) {
  return listIssue && !value.trim() ? message : undefined
}
