import { ref, computed } from 'vue'
import { sanitizeLetter } from '@/utils/highlightUtils'

/**
 * Deterministic Shuffling Utilities
 */
export function hashStringToSeed(s: string) {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function mulberry32(a: number) {
  return function() {
    let t = (a += 0x6D2B79F5) >>> 0
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffleStringDeterministic(str: string, seed: number) {
  const arr = str.split('')
  const rnd = mulberry32(seed >>> 0)
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp
  }
  return arr.join('')
}

export function useAnagramManager(puzzle: any, baseGrid: any, editableGrid: any) {
  const builderWord = ref('')
  const initialBuilderSnapshot = ref(null)
  const latestBuilderSnapshot = ref({ word: '', slots: [], bank: [], topOrder: [] })
  const anagramVerifiedPoints = ref(0)
  const forceClearBuilderOnce = ref(false)
  const builderLiveSeq = ref(0)
  
  // Guard to suppress persistence during initial hydration
  const hydrationInProgress = ref(true)
  // During a short post-hydration window, ignore empty anagram snapshots
  const ignoreEmptySnapshots = ref(true)

  const colIndex = computed(() => {
    return Number(puzzle.value?.column_index ?? -1)
  })

  const isMainDiagonal = computed(() => (puzzle.value?.diagonal_direction || 'main') === 'main')

  function isDiagonalCell(r: number, c: number) {
    const n = baseGrid.value.length
    if (n === 0) return false
    if (isMainDiagonal.value) return r === c
    return c === (n - 1 - r)
  }

  function isVerticalTargetCell(r: number, c: number) {
    return c === colIndex.value
  }

  function isTargetCell(r: number, c: number) {
    return isVerticalTargetCell(r, c) || isDiagonalCell(r, c)
  }

  const topAnagram = computed(() => {
    const pre = (puzzle.value?.longestAnagramShuffled || '')
    const src = pre || (puzzle.value?.meta?.longestAnagram || puzzle.value?.longest_anagram || '')
    const raw = String(src || '').toUpperCase()
    if (!raw) return ''
    if (pre) return raw
    
    const seedSrc = String(puzzle.value?.date || '') + '|' + raw
    const seed = hashStringToSeed(seedSrc)
    const shuffled = shuffleStringDeterministic(raw, seed)
    if (shuffled === raw) {
      return raw.length > 1 ? (raw.slice(1) + raw[0]) : raw
    }
    return shuffled
  })

  const trueTopAnagram = computed(() => {
    const src = (puzzle.value?.meta?.longestAnagram || puzzle.value?.longest_anagram || '')
    return String(src || '').toUpperCase()
  })

  const gridLetterCounts = computed(() => {
    const counts: Record<string, number> = {}
    const rows = baseGrid.value.length
    if (!rows) return counts
    const cols = (baseGrid.value[0] || []).length
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let ch
        if (isTargetCell(r, c)) {
          ch = baseGrid.value[r][c]
        } else {
          ch = editableGrid.value?.[r]?.[c]
        }
        const L = sanitizeLetter(ch)
        if (L) counts[L] = (counts[L] || 0) + 1
      }
    }
    return counts
  })

  const anagramRevealMask = computed(() => {
    const text = topAnagram.value || ''
    const remaining = { ...gridLetterCounts.value }
    const mask = []
    for (let i = 0; i < text.length; i++) {
      const L = text[i]
      if (remaining[L] > 0) {
        mask[i] = true
        remaining[L]--
      } else {
        mask[i] = false
      }
    }
    return mask
  })

  function onAnagramShuffle(shuffleAgg: any, adManager?: any) {
    try {
      shuffleAgg?.onShuffle?.()
      if (adManager) adManager.incrementShuffleCount()
    } catch (_) {}
    // The component now handles the actual array reordering
  }

  function onAnagramReset(shuffleAgg: any, len: number, flushPersist: () => void) {
    try {
      shuffleAgg?.onReset?.()
    } catch (_) {}
    try {
      forceClearBuilderOnce.value = true
      anagramVerifiedPoints.value = 0
      builderWord.value = ''
      latestBuilderSnapshot.value = {
        word: '',
        slots: Array(len).fill(''),
        bank: Array(len).fill(false),
        topOrder: Array.from({ length: len }, (_, i) => i),
      }
      flushPersist()
    } catch (_) {}
  }

  async function onVerifyAnagram(
    word: string,
    endOfGame: any,
    nextTick: any,
    callLiveScoring: (opts: any) => Promise<any>,
    triggerAnagramCelebrate: (word: string, pts: number | null) => void,
    anagramBuilderRef: any,
    schedulePersist: () => void
  ) {
    try {
      if (endOfGame.value) return

      try { builderWord.value = (word || '').toString().toUpperCase() } catch (_) {}
      try { await nextTick() } catch (_) {}

      const resp = await callLiveScoring({ triggerAnagram: true, anagramWord: word })

      const accepted = !!(resp && resp.anagram_result && resp.anagram_result.accepted)
      if (!accepted) {
        try { anagramBuilderRef.value?.indicateError?.() } catch (_) {}
        if (Number(anagramVerifiedPoints.value) > 0) {
          anagramVerifiedPoints.value = 0
          schedulePersist()
          // Refresh total score to reflect lost anagram points
          try { await callLiveScoring({ forceApi: true }) } catch (_) {}
        }
        return
      }

      try {
        const wLower = String(word || '').toLowerCase()
        const item = Array.isArray(resp?.valid_words_metadata)
          ? resp.valid_words_metadata.find((it: any) => (it?.type === 'anagram') && String(it?.word || '').toLowerCase() === wLower)
          : null
        const pts = Number(item?.score)
        if (Number.isFinite(pts) && pts > 0) {
          anagramVerifiedPoints.value = pts
          schedulePersist()
        }
        try {
          const submitted = String(resp?.anagram_result?.submitted || word || '').toLowerCase()
          if (submitted) triggerAnagramCelebrate(submitted, Number.isFinite(pts) ? Number(pts) : null)
        } catch (_) {}
        try { 
          anagramBuilderRef.value?.indicateVerifyOk?.() 
          // Notify tutorial controller to show tick in overlay
          window.dispatchEvent(new CustomEvent('tutorial-show-verify-tick', { 
            detail: { targetId: 'margana-anagram-verify-btn' } 
          }))
        } catch (_) {}
      } catch (_) {}
    } catch (_) {}
  }

  return {
    topAnagram,
    trueTopAnagram,
    anagramRevealMask,
    builderWord,
    initialBuilderSnapshot,
    latestBuilderSnapshot,
    anagramVerifiedPoints,
    forceClearBuilderOnce,
    hydrationInProgress,
    ignoreEmptySnapshots,
    builderLiveSeq,
    colIndex,
    isMainDiagonal,
    isTargetCell,
    isVerticalTargetCell,
    isDiagonalCell,
    onAnagramShuffle,
    onAnagramReset,
    onVerifyAnagram
  }
}
