/**
 * Guarded Web Storage access. Private windows, disabled site data and quota errors must never
 * crash the app — callers get `null`/`false` and degrade gracefully.
 */
function getStorage(kind: 'local' | 'session'): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage
  } catch {
    return null
  }
}

export function readStorage(key: string, kind: 'local' | 'session' = 'local') {
  try {
    return getStorage(kind)?.getItem(key) ?? null
  } catch {
    return null
  }
}

/** Returns false when the value could not be stored (quota, blocked storage). */
export function writeStorage(key: string, value: string, kind: 'local' | 'session' = 'local') {
  try {
    const storage = getStorage(kind)
    if (!storage) return false
    storage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function removeStorage(key: string, kind: 'local' | 'session' = 'local') {
  try {
    getStorage(kind)?.removeItem(key)
  } catch {
    // Storage unavailable — nothing to remove.
  }
}

export function storageKeys(prefix: string, kind: 'local' | 'session' = 'local') {
  const storage = getStorage(kind)
  if (!storage) return []
  const keys: string[] = []
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i)
      if (key?.startsWith(prefix)) keys.push(key)
    }
  } catch {
    return []
  }
  return keys
}

export function readJson(key: string, kind: 'local' | 'session' = 'local'): unknown {
  const raw = readStorage(key, kind)
  if (raw === null) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function writeJson(key: string, value: unknown, kind: 'local' | 'session' = 'local') {
  return writeStorage(key, JSON.stringify(value), kind)
}
