import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { useMarganaGame } from '../useMarganaGame'
import { useGameFlow } from '../useGameFlow'
import * as liveScoringClient from '../../services/liveScoring/liveScoringClient'

vi.mock('../../services/liveScoring/liveScoringClient')

describe('useGameFlow - submit synchronization', () => {
  const puzzle = ref({
    date: '2026-03-08',
    grid_rows: ['A***', '****', '****', '****'],
    column_index: 0
  })

  const gameOptions = {
    callLiveScoring: vi.fn(),
    computeHighlightFromItem: vi.fn(),
    dispatchUsage: vi.fn(),
    loadPuzzleState: vi.fn(),
    savePuzzleState: vi.fn(),
    puzzleDateStr: ref('2026-03-08'),
    settings: {
      enableWildcardBypass: ref(false),
      showPulseLabels: ref(true),
      enableLiveScoring: ref(true),
      showAnagramPopup: ref(true)
    }
  }

  const flowOptions = {
    puzzleDateStr: ref('2026-03-08'),
    isAuthenticated: ref(false),
    userSub: ref(null),
    guestId: ref('guest-123'),
    activeAnagramBuilder: ref({
      getBuilderWord: () => 'HELLO',
      getBuilderSnapshot: () => ({ word: 'HELLO', slots: [], bank: [], topOrder: [] }),
      indicateError: vi.fn(),
      indicateVerifyOk: vi.fn()
    }),
    loadPuzzle: vi.fn(),
    loadLetterScores: vi.fn(),
    buildEditableGrid: vi.fn(),
    dispatchUsage: vi.fn(),
    hasSeenTutorial: () => true,
    triggerTutorial: vi.fn(),
    cleanupOldDrafts: vi.fn(),
    showAccountBenefits: ref(false),
    needsTermsAcceptance: ref(false),
    authInitialized: ref(true),
    landscapeMobileMode: ref(false),
    settingsEnableLiveScoring: ref(true),
    settingsEnableWildcardBypass: ref(false),
    typingAgg: {},
    highlightAgg: {},
    shuffleAgg: {},
    loadPuzzleState: vi.fn()
  }

  it('should update session.score after successful submission', async () => {
    const session = useMarganaGame(puzzle, gameOptions as any)
    session.score.value = 50 // Initial score from grid

    const flow = useGameFlow(session, flowOptions as any)

    const mockResponse = {
      mode: 'api',
      data: {
        total_score: 150, // New score including anagram
        commit_result: { accepted: true },
        anagram_result: { accepted: true },
        meta: { date: '2026-03-08' }
      }
    }

    vi.mocked(liveScoringClient.liveScoringDecisionAndFetch).mockResolvedValue(mockResponse as any)

    await flow.submit()

    expect(session.score.value).toBe(150)
  })
})
