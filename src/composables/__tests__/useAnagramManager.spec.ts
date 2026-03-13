import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { useAnagramManager, hashStringToSeed, shuffleStringDeterministic } from '../useAnagramManager'

describe('useAnagramManager', () => {
  const puzzle = ref({
    date: '2023-10-27',
    longest_anagram: 'TESTWORD',
    grid_rows: ['T***', '****', '****', '****']
  })
  const baseGrid = ref([['T', 'E', 'S', 'T']])
  const editableGrid = ref([['', '', '', '']])

  it('should generate deterministic seeds', () => {
    const s1 = hashStringToSeed('test')
    const s2 = hashStringToSeed('test')
    expect(s1).toBe(s2)
  })

  it('should shuffle strings deterministically', () => {
    const str = 'ABCDE'
    const seed = 12345
    const res1 = shuffleStringDeterministic(str, seed)
    const res2 = shuffleStringDeterministic(str, seed)
    expect(res1).toBe(res2)
  })

  it('should compute topAnagram correctly', () => {
    const { topAnagram } = useAnagramManager(puzzle, baseGrid, editableGrid)
    expect(topAnagram.value).toBeDefined()
    expect(topAnagram.value.length).toBe(8)
  })

  it('should compute trueTopAnagram correctly', () => {
    const { trueTopAnagram } = useAnagramManager(puzzle, baseGrid, editableGrid)
    expect(trueTopAnagram.value).toBe('TESTWORD')
  })

  it('should reset anagram state correctly', async () => {
    const { onAnagramReset, builderWord, latestBuilderSnapshot, anagramVerifiedPoints } = useAnagramManager(puzzle, baseGrid, editableGrid)
    
    // Simulate some state
    builderWord.value = 'TEST'
    anagramVerifiedPoints.value = 50
    
    const flushPersist = vi.fn()
    onAnagramReset({}, 8, flushPersist)
    
    expect(builderWord.value).toBe('')
    expect(anagramVerifiedPoints.value).toBe(0)
    expect(latestBuilderSnapshot.value.word).toBe('')
    expect(latestBuilderSnapshot.value.slots.length).toBe(8)
    expect(flushPersist).toHaveBeenCalled()
  })

  it('should handle verify anagram successfully', async () => {
    const { onVerifyAnagram, anagramVerifiedPoints } = useAnagramManager(puzzle, baseGrid, editableGrid)
    
    const callLiveScoring = vi.fn().mockResolvedValue({
      anagram_result: { accepted: true, submitted: 'test' },
      valid_words_metadata: [
        { type: 'anagram', word: 'test', score: 100 }
      ]
    })
    const triggerAnagramCelebrate = vi.fn()
    const anagramBuilderRef = { value: { indicateVerifyOk: vi.fn() } }
    const schedulePersist = vi.fn()
    
    await onVerifyAnagram(
      'TEST',
      ref(false),
      (cb) => cb(),
      callLiveScoring,
      triggerAnagramCelebrate,
      anagramBuilderRef,
      schedulePersist
    )
    
    expect(anagramVerifiedPoints.value).toBe(100)
    expect(triggerAnagramCelebrate).toHaveBeenCalledWith('test', 100)
    expect(anagramBuilderRef.value.indicateVerifyOk).toHaveBeenCalled()
    expect(schedulePersist).toHaveBeenCalled()
  })

  it('should handle verify anagram failure', async () => {
    const { onVerifyAnagram, anagramVerifiedPoints } = useAnagramManager(puzzle, baseGrid, editableGrid)
    
    // Start with some points
    anagramVerifiedPoints.value = 50
    
    const callLiveScoring = vi.fn()
      .mockResolvedValueOnce({
        anagram_result: { accepted: false }
      })
      .mockResolvedValueOnce({ total_score: 100 }) // for the forceApi call
      
    const triggerAnagramCelebrate = vi.fn()
    const anagramBuilderRef = { value: { indicateError: vi.fn() } }
    const schedulePersist = vi.fn()
    
    await onVerifyAnagram(
      'INVALID',
      ref(false),
      (cb) => cb(),
      callLiveScoring,
      triggerAnagramCelebrate,
      anagramBuilderRef,
      schedulePersist
    )
    
    expect(anagramVerifiedPoints.value).toBe(0)
    expect(anagramBuilderRef.value.indicateError).toHaveBeenCalled()
    expect(schedulePersist).toHaveBeenCalled()
    expect(callLiveScoring).toHaveBeenCalledTimes(2) // Second call to refresh score
  })
})
