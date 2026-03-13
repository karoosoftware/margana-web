import { ref } from 'vue'
import letterScoresJson from '../resources/letter-scores-v3.json'

export function useLetterScores() {
  const letterScores = ref<Record<string, number>>({})

  async function loadLetterScores() {
    try {
      if (letterScoresJson && typeof letterScoresJson === 'object') {
        const normalized: Record<string, number> = {}
        try {
          for (const [k, v] of Object.entries(letterScoresJson)) {
            const key = String(k || '').toUpperCase()
            const val = typeof v === 'number' ? v : Number(v)
            if (key && Number.isFinite(val)) normalized[key] = val
          }
        } catch (_) {
          Object.assign(normalized, letterScoresJson)
        }
        letterScores.value = normalized
        return
      }
      // Fallback
      letterScores.value = {
        A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1, M: 3,
        N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10
      }
    } catch (err) {
      console.warn('Failed to load local letter scores. Using defaults.', err)
      letterScores.value = {
        A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1, M: 3,
        N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10
      }
    }
  }

  const scoreFor = (ch: string) => {
    if (!ch) return ''
    const L = String(ch).toUpperCase()
    const v = letterScores.value[L]
    return typeof v === 'number' ? v : ''
  }

  const scoreForWord = (word: string) => {
    let sum = 0
    for (const char of (word || '').toUpperCase()) {
      sum += (letterScores.value[char] as number) || 0
    }
    return sum
  }

  return {
    letterScores,
    loadLetterScores,
    scoreFor,
    scoreForWord
  }
}
