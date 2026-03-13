// Lightweight localStorage persistence helpers for client-side state
// Use versioned keys to allow schema upgrades safely.

export type RowState = { valid?: boolean | null, word?: string }

export type PuzzleDraft = {
  v: number // schema version
  ts: number // saved timestamp (ms)
  rows: string[][] // letters for editable cells; fixed cells may be included but are ignored
  builderWord?: string
  // v2+
  rowStates?: RowState[]
  // v3+ — anagram builder full snapshot
  builderSlots?: string[] // bottom row letters (length = anagram length)
  builderBank?: boolean[] // top consumed flags (true = consumed into builder)
  topOrder?: number[] // current display order mapping for top row (optional)
  totalScore?: number // last known total score from live scoring
  // v3+ — track whether an anagram verify has contributed points to the total
  // If > 0, and the user modifies the builder (removes a letter), the client
  // should trigger a live scoring refresh and then clear this value.
  anagramVerifiedPoints?: number
};

const PREFIX = 'margana:puzzle:'

export function storageAvailable(): boolean {
  try {
    const k = '__margana_test__'
    window.localStorage.setItem(k, '1')
    window.localStorage.removeItem(k)
    return true
  } catch {
    return false
  }
}

export function keyFor(dateStr: string, v = 2): string {
  return `${PREFIX}${dateStr}:v${v}`
}

export function savePuzzleState(dateStr: string, data: PuzzleDraft): void {
  if (!storageAvailable()) return
  try {
    const v = data.v && Number.isFinite(data.v) ? data.v : 2
    const k = keyFor(dateStr, v)
    const payload = JSON.stringify({ ...data, v })
    window.localStorage.setItem(k, payload)
  } catch {
    // best-effort only
  }
}

export function loadPuzzleState(dateStr: string): PuzzleDraft | null {
  if (!storageAvailable()) return null
  // Try latest known versions descending: v3 → v2 → v1
  const keys = [keyFor(dateStr, 3), keyFor(dateStr, 2), keyFor(dateStr, 1)]
  for (const k of keys) {
    try {
      const raw = window.localStorage.getItem(k)
      if (!raw) continue
      const obj = JSON.parse(raw)
      if (!obj || typeof obj !== 'object') continue
      if (typeof obj.v !== 'number' || typeof obj.ts !== 'number' || !Array.isArray(obj.rows)) continue
      // Normalize optional fields for older versions
      if (!Array.isArray(obj.rowStates)) obj.rowStates = undefined
      if (!Array.isArray(obj.builderSlots)) obj.builderSlots = undefined
      if (!Array.isArray(obj.builderBank)) obj.builderBank = undefined
      if (!Array.isArray(obj.topOrder)) obj.topOrder = undefined
      return obj as PuzzleDraft
    } catch {
      // try next
    }
  }
  return null
}

export function clearPuzzleState(dateStr: string): void {
  if (!storageAvailable()) return
  try {
    // Remove any known version keys
    ;[1,2,3].forEach(v => {
      try { window.localStorage.removeItem(keyFor(dateStr, v)) } catch {}
    })
  } catch {
    // ignore
  }
}

// Remove stale drafts older than ttlDays and any drafts for dates older than N days.
export function cleanupOldDrafts(ttlDays = 7): void {
  if (!storageAvailable()) return
  try {
    const now = Date.now()
    const cutoff = now - ttlDays * 24 * 60 * 60 * 1000
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i) || ''
      if (k.startsWith(PREFIX)) {
        const raw = window.localStorage.getItem(k)
        if (!raw) continue
        try {
          const obj = JSON.parse(raw)
          const ts = typeof obj?.ts === 'number' ? obj.ts : 0
          if (!ts || ts < cutoff) {
            window.localStorage.removeItem(k)
          }
        } catch {
          // If parse fails, remove the corrupted entry
          window.localStorage.removeItem(k)
        }
      }
    }
  } catch {
    // ignore
  }
}
