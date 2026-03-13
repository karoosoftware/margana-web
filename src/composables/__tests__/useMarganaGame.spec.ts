import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useMarganaGame } from '../useMarganaGame'

describe('useMarganaGame - Sideways Move Bug', () => {
  const puzzle = ref({
    date: '2026-02-10',
    longest_anagram: 'NOTES',
    grid_rows: ['N***', '****', '****', '****']
  })

  const options = {
    callLiveScoring: vi.fn().mockResolvedValue({}),
    computeHighlightFromItem: vi.fn(),
    dispatchUsage: vi.fn(),
    loadPuzzleState: vi.fn(),
    savePuzzleState: vi.fn(),
    puzzleDateStr: ref('2026-02-10'),
    settings: {
      enableWildcardBypass: ref(false),
      showPulseLabels: ref(true),
      enableLiveScoring: ref(true),
      showAnagramPopup: ref(true)
    }
  }

  it('should reset anagramVerifiedPoints when a letter is moved sideways (creating a gap)', () => {
    const { am, onBuilderSnapshot } = useMarganaGame(puzzle, options as any)

    // 1. Setup initial state: verified word "NOTES" in first 5 slots
    am.builderWord.value = 'NOTES'
    am.anagramVerifiedPoints.value = 100
    am.latestBuilderSnapshot.value = {
      word: 'NOTES',
      slots: ['N', 'O', 'T', 'E', 'S', '', '', ''],
      bank: [true, true, true, true, true, false, false, false],
      topOrder: [0, 1, 2, 3, 4, 5, 6, 7]
    }
    am.hydrationInProgress.value = false

    // 2. Simulate sideways move: 'S' moves from slot 4 to slot 6
    // The "word" remains "NOTES" when compressed, but the layout changed.
    const sidewaysSnap = {
      word: 'NOTES', // getBuilderWord() still returns 'NOTES'
      slots: ['N', 'O', 'T', 'E', '', '', 'S', ''],
      bank: [true, true, true, true, true, false, false, false],
      topOrder: [0, 1, 2, 3, 4, 5, 6, 7]
    }

    onBuilderSnapshot(sidewaysSnap)

    // 3. Assertions
    expect(am.anagramVerifiedPoints.value).toBe(0)
  })

  it('should NOT reset anagramVerifiedPoints if the layout is identical', () => {
    const { am, onBuilderSnapshot } = useMarganaGame(puzzle, options as any)

    // 1. Setup initial state
    am.builderWord.value = 'NOTES'
    am.anagramVerifiedPoints.value = 100
    am.latestBuilderSnapshot.value = {
      word: 'NOTES',
      slots: ['N', 'O', 'T', 'E', 'S', '', '', ''],
      bank: [true, true, true, true, true, false, false, false],
      topOrder: [0, 1, 2, 3, 4, 5, 6, 7]
    }
    am.hydrationInProgress.value = false

    // 2. Simulate same layout update (maybe from some other event)
    const sameSnap = {
      word: 'NOTES',
      slots: ['N', 'O', 'T', 'E', 'S', '', '', ''],
      bank: [true, true, true, true, true, false, false, false],
      topOrder: [0, 1, 2, 3, 4, 5, 6, 7]
    }

    onBuilderSnapshot(sameSnap)

    // 3. Assertions
    expect(am.anagramVerifiedPoints.value).toBe(100) // Should preserve points
  })

  it('should reset anagramVerifiedPoints when a letter is removed from the end', () => {
    const { am, onBuilderSnapshot } = useMarganaGame(puzzle, options as any)

    am.builderWord.value = 'NOTES'
    am.anagramVerifiedPoints.value = 100
    am.latestBuilderSnapshot.value = {
      word: 'NOTES',
      slots: ['N', 'O', 'T', 'E', 'S', '', '', ''],
      bank: [true, true, true, true, true, false, false, false],
      topOrder: [0, 1, 2, 3, 4, 5, 6, 7]
    }
    am.hydrationInProgress.value = false

    const removedSnap = {
      word: 'NOTE',
      slots: ['N', 'O', 'T', 'E', '', '', '', ''],
      bank: [true, true, true, true, false, false, false, false],
      topOrder: [0, 1, 2, 3, 4, 5, 6, 7]
    }

    onBuilderSnapshot(removedSnap)

    expect(am.anagramVerifiedPoints.value).toBe(0)
  })
})
