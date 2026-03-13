import { describe, it, expect, vi } from 'vitest'
import { ref, nextTick } from 'vue'
import { useTutorialReplay } from '../useTutorialReplay'

describe('useTutorialReplay', () => {
  it('captures and restores tutorial snapshot for a step', async () => {
    const isTutorialActive = ref(true)
    const tutorialGM = {
      editableGrid: ref([['A', '']]),
      rowValid: ref([true]),
      rowValidating: ref([false]),
      rowValidationSeq: ref([1]),
      pendingRowValidations: ref(0),
      rowError: ref([false]),
      rowInvalidByXor: ref([false])
    }
    const tutorialAM = {
      anagramVerifiedPoints: ref(5),
      builderWord: ref('AB'),
      latestBuilderSnapshot: ref({ slots: ['A', 'B'], bank: [true, false], topOrder: [0, 1] }),
      initialBuilderSnapshot: ref(null),
      forceClearBuilderOnce: ref(false),
      hydrationInProgress: ref(false),
      ignoreEmptySnapshots: ref(false)
    }
    const tutorialPM = {
      getPulseState: () => ({ pulseThemes: new Map([['0:0', 'ana']]), pulseLabels: new Map() }),
      restorePulseState: vi.fn()
    }
    const tutorialErrorRow = ref(null)
    const tutorialShakeRow = ref(null)
    const tutorialResult = ref(null)
    const tutorialScore = ref(12)
    const tutorialAnagramHighlighted = ref(false)
    const tutorialShowStatistics = ref(false)
    const tutorialAnagramPopupVisible = ref(true)
    const tutorialAnagramPopupText = ref('Anagram +5')
    const submitHighlightActive = ref(true)
    const tutorialMadnessSig = ref('sig')
    const tutorialRowPulseSigs = ref(new Map([[0, 'row-sig']]))
    const tutorialDiagPulseSigs = ref(new Map([['0:0', 'diag-sig']]))
    const tutorialHighlightedCells = ref(new Set(['0:0']))
    const initialBuilderSnapshot = ref(null)
    const activeAnagramBuilder = ref({
      getBuilderSnapshot: () => ({ slots: ['A'], bank: [true], topOrder: [0] }),
      restoreBuilderSnapshot: vi.fn(),
      getBuilderWord: () => 'A'
    })
    const onResetPopupTimer = vi.fn()

    const {
      handleTutorialStepStart,
      handleTutorialRestoreStep
    } = useTutorialReplay({
      isTutorialActive,
      activeAnagramBuilder,
      tutorialGM,
      tutorialAM,
      tutorialPM,
      tutorialErrorRow,
      tutorialShakeRow,
      tutorialResult,
      tutorialScore,
      tutorialAnagramHighlighted,
      tutorialShowStatistics,
      tutorialAnagramPopupVisible,
      tutorialAnagramPopupText,
      submitHighlightActive,
      tutorialMadnessSig,
      tutorialRowPulseSigs,
      tutorialDiagPulseSigs,
      tutorialHighlightedCells,
      initialBuilderSnapshot,
      onResetPopupTimer
    })

    handleTutorialStepStart({ detail: { index: 0 } })

    tutorialGM.editableGrid.value[0][0] = ''
    tutorialScore.value = 0
    tutorialAnagramPopupVisible.value = false

    await handleTutorialRestoreStep({ detail: { index: 0, done: vi.fn() } })
    await nextTick()

    expect(tutorialGM.editableGrid.value[0][0]).toBe('A')
    expect(tutorialScore.value).toBe(12)
    expect(tutorialAnagramPopupVisible.value).toBe(true)
    expect(onResetPopupTimer).toHaveBeenCalledWith(true)
    expect(tutorialPM.restorePulseState).toHaveBeenCalled()
    expect(activeAnagramBuilder.value.restoreBuilderSnapshot).toHaveBeenCalled()
  })

  it('does not capture snapshots when tutorial is inactive', () => {
    const isTutorialActive = ref(false)
    const tutorialGM = {
      editableGrid: ref([['A']]),
      rowValid: ref([true]),
      rowValidating: ref([false]),
      rowValidationSeq: ref([1]),
      pendingRowValidations: ref(0),
      rowError: ref([false]),
      rowInvalidByXor: ref([false])
    }
    const tutorialAM = {
      anagramVerifiedPoints: ref(0),
      builderWord: ref(''),
      latestBuilderSnapshot: ref({}),
      initialBuilderSnapshot: ref(null),
      forceClearBuilderOnce: ref(false),
      hydrationInProgress: ref(false),
      ignoreEmptySnapshots: ref(false)
    }
    const tutorialPM = { getPulseState: () => null, restorePulseState: vi.fn() }
    const activeAnagramBuilder = ref({ getBuilderSnapshot: () => null })

    const { handleTutorialStepStart, handleTutorialRestoreStep } = useTutorialReplay({
      isTutorialActive,
      activeAnagramBuilder,
      tutorialGM,
      tutorialAM,
      tutorialPM,
      tutorialErrorRow: ref(null),
      tutorialShakeRow: ref(null),
      tutorialResult: ref(null),
      tutorialScore: ref(0),
      tutorialAnagramHighlighted: ref(false),
      tutorialShowStatistics: ref(false),
      tutorialAnagramPopupVisible: ref(false),
      tutorialAnagramPopupText: ref(''),
      submitHighlightActive: ref(false),
      tutorialMadnessSig: ref(''),
      tutorialRowPulseSigs: ref(new Map()),
      tutorialDiagPulseSigs: ref(new Map()),
      tutorialHighlightedCells: ref(new Set()),
      initialBuilderSnapshot: ref(null)
    })

    handleTutorialStepStart({ detail: { index: 0 } })
    handleTutorialRestoreStep({ detail: { index: 0, done: vi.fn(), suppressTransientEffects: true } })

    expect(tutorialGM.editableGrid.value[0][0]).toBe('A')
  })

  it('clears transient effects when suppressTransientEffects is set', async () => {
    const isTutorialActive = ref(true)
    const tutorialGM = {
      editableGrid: ref([['A']]),
      rowValid: ref([true]),
      rowValidating: ref([false]),
      rowValidationSeq: ref([1]),
      pendingRowValidations: ref(0),
      rowError: ref([false]),
      rowInvalidByXor: ref([false])
    }
    const tutorialAM = {
      anagramVerifiedPoints: ref(0),
      builderWord: ref(''),
      latestBuilderSnapshot: ref({}),
      initialBuilderSnapshot: ref(null),
      forceClearBuilderOnce: ref(false),
      hydrationInProgress: ref(false),
      ignoreEmptySnapshots: ref(false)
    }
    const clearPulse = vi.fn()
    const tutorialPM = { getPulseState: () => ({ pulseThemes: new Map(), pulseLabels: new Map() }), restorePulseState: vi.fn(), clearPulse }
    const activeAnagramBuilder = ref({ getBuilderSnapshot: () => null })
    const tutorialAnagramPopupVisible = ref(true)
    const tutorialAnagramPopupText = ref('Anagram +5')
    const tutorialRowPulseSigs = ref(new Map([[0, 'row-sig']]))
    const tutorialDiagPulseSigs = ref(new Map([['0:0', 'diag-sig']]))
    const tutorialHighlightedCells = ref(new Set(['0:0']))

    const { handleTutorialStepStart, handleTutorialRestoreStep } = useTutorialReplay({
      isTutorialActive,
      activeAnagramBuilder,
      tutorialGM,
      tutorialAM,
      tutorialPM,
      tutorialErrorRow: ref(null),
      tutorialShakeRow: ref(null),
      tutorialResult: ref(null),
      tutorialScore: ref(0),
      tutorialAnagramHighlighted: ref(false),
      tutorialShowStatistics: ref(false),
      tutorialAnagramPopupVisible,
      tutorialAnagramPopupText,
      submitHighlightActive: ref(false),
      tutorialMadnessSig: ref(''),
      tutorialRowPulseSigs,
      tutorialDiagPulseSigs,
      tutorialHighlightedCells,
      initialBuilderSnapshot: ref(null)
    })

    handleTutorialStepStart({ detail: { index: 0 } })
    await handleTutorialRestoreStep({ detail: { index: 0, done: vi.fn(), suppressTransientEffects: true } })
    await nextTick()

    expect(tutorialAnagramPopupVisible.value).toBe(false)
    expect(tutorialAnagramPopupText.value).toBe('')
    expect(tutorialRowPulseSigs.value.size).toBe(0)
    expect(tutorialDiagPulseSigs.value.size).toBe(0)
    expect(tutorialHighlightedCells.value.size).toBe(0)
    expect(clearPulse).toHaveBeenCalled()
  })
})
