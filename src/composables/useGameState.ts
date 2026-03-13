import { ref, computed } from 'vue'
import { getUrl } from 'aws-amplify/storage'
import { Bucket } from '@/config/api'
import { loadPuzzleState, savePuzzleState, cleanupOldDrafts } from '@/utils/persist'

export function useGameState() {
  const puzzle = ref(null)
  const loading = ref(true)
  const error = ref(null)

  const puzzleDateStr = computed(() => {
    if (puzzle.value?.date && typeof puzzle.value.date === 'string') {
      return puzzle.value.date
    }
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  })

  async function loadPuzzle(tutorialData?: any) {
    if (tutorialData) {
      puzzle.value = tutorialData
      loading.value = false
      return
    }
    loading.value = true
    error.value = null
    
    const today = new Date()
    const key = `public/daily-puzzles/${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}/margana-semi-completed.json`
    
    try {
      // Both Guest and Authenticated users now use Signed URLs (SigV4)
      const { url } = await getUrl({
        path: key,
        options: {
          bucket: { bucketName: Bucket.MARGANA_WORD_GAME, region: 'eu-west-2' },
        }
      })
      const res = await fetch(url)
      if (!res.ok) throw new Error(`S3 Fetch Failed: HTTP ${res.status}`)
      puzzle.value = await res.json()
    } catch (e: any) {
      console.error('[useGameState] Failed to load puzzle:', e)
      error.value = e.message || 'Failed to load puzzle'
    } finally {
      loading.value = false
    }
  }

  return {
    puzzle,
    loading,
    error,
    puzzleDateStr,
    loadPuzzle,
    // Re-export persistence helpers for convenience
    loadPuzzleState,
    savePuzzleState,
    cleanupOldDrafts
  }
}
