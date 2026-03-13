import { ref, computed, watch, type Ref } from 'vue'
import { useGridManager } from '@/composables/useGridManager'
import { useAnagramManager } from '@/composables/useAnagramManager'
import { useInputManagement } from '@/composables/useInputManagement'
import { usePulseManager } from '@/composables/usePulseManager'
import { useGridValidation } from '@/composables/useGridValidation'
import { composeRowWordFromGrids, sanitizeLetter, getAnagramWordFromSlots } from '@/utils/highlightUtils'

export interface MarganaGameOptions {
  callLiveScoring: (opts?: any) => Promise<any>
  computeHighlightFromItem: (item: any) => any
  dispatchUsage: (action: string, payload?: any) => void
  loadPuzzleState: (dateStr: string) => any
  savePuzzleState: (dateStr: string, data: any) => void
  puzzleDateStr: Ref<string>
  isTutorial?: boolean
  isAuthenticated?: Ref<boolean>
  guestId?: Ref<string>
  adManager?: any
  typingAgg?: any
  highlightAgg?: any
  shuffleAgg?: any
  settings: {
    enableWildcardBypass: Ref<boolean>
    showPulseLabels: Ref<boolean>
    enableLiveScoring: Ref<boolean>
    showAnagramPopup: Ref<boolean>
  }
}

export function useMarganaGame(puzzle: Ref<any>, options: MarganaGameOptions) {
  const isTutorial = !!options.isTutorial

  const baseGrid = computed(() => {
    if (!puzzle.value?.grid_rows) return []
    return puzzle.value.grid_rows.map((row: string) => row.split('').map(ch => ch.toUpperCase()))
  })

  // Session-specific state refs
  const result = ref(null)
  const score = ref(0)
  const shakeRow = ref<number | null>(null)
  const errorRow = ref<number | null>(null)
  const madnessSig = ref('')
  const rowPulseSigs = ref(new Map<number, string>())
  const diagPulseSigs = ref(new Map<string, string>())
  const highlightedCells = ref(new Set<string>())
  const anagramPopupVisible = ref(false)
  const anagramPopupText = ref('')
  const anagramHighlighted = ref(false)
  const showStatistics = ref(false)
  const posting = ref(false)

  const endOfGame = computed(() => !!result.value)

  // Instantiate Managers
  const gm = useGridManager(
    baseGrid,
    options.settings.enableWildcardBypass,
    (r, c) => am.isTargetCell(r, c)
  )

  const am = useAnagramManager(puzzle, baseGrid, gm.editableGrid)

  const im = useInputManagement(
    baseGrid,
    gm.editableGrid,
    gm.isEditableCell,
    endOfGame
  )

  const pm = usePulseManager(baseGrid, options.settings.showPulseLabels)

  const validation = useGridValidation({
    baseGrid,
    editableGrid: gm.editableGrid,
    rowValid: gm.rowValid,
    rowValidating: gm.rowValidating,
    rowValidationSeq: gm.rowValidationSeq,
    pendingRowValidations: gm.pendingRowValidations,
    rowError: gm.rowError,
    errorRow,
    shakeRow,
    rowInvalidByXor: gm.rowInvalidByXor,
    settingsEnableWildcardBypass: options.settings.enableWildcardBypass,
    liveTotalScore: score,
    lastMadnessSig: madnessSig,
    lastRowPulseSigs: rowPulseSigs,
    lastDiagPulseSigs: diagPulseSigs,
    madnessAvailable: computed(() => !!puzzle.value?.madnessAvailable),

    rowHasWildcard: gm.rowHasWildcard,
    composeRowWord: (r) => composeRowWordFromGrids(r, baseGrid.value, gm.editableGrid.value, (r, c) => am.isTargetCell(r, c)),
    callLiveScoring: options.callLiveScoring,
    triggerPulseRow: pm.triggerPulseRow,
    triggerPulseCells: pm.triggerPulseCells,
    focusFirstEditable: im.focusFirstEditable,
    isTargetCell: (r, c) => am.isTargetCell(r, c),
    computeHighlightFromItem: options.computeHighlightFromItem,
    schedulePersist: () => schedulePersist(),
    dispatchUsage: options.dispatchUsage
  })

  // --- Handlers ---

  const handleInput = async (r: number, c: number) => {
    if (endOfGame.value) return
    gm.editableGrid.value[r][c] = sanitizeLetter(gm.editableGrid.value[r][c])
    const val = gm.editableGrid.value[r][c]

    if (gm.rowInvalidByXor.value[r]) gm.rowInvalidByXor.value[r] = false
    if (gm.rowError.value[r]) gm.rowError.value[r] = false

    // Analytics (simplified for now, full aggregator logic to be moved if needed)
    if (val && val.length === 1) {
      options.typingAgg?.onLetter()
      options.dispatchUsage('letter_input', { board_id: 'game-board' })
    }

    gm.rowValid.value[r] = false
    if (errorRow.value === r) errorRow.value = null

    if (val && val.length === 1) {
      if (gm.areAllEditableFilledInRow(r)) {
        validation.validateRowAndMaybeAdvance(r, { autoFocus: true })
      } else {
        im.focusNextEditable(r, c)
      }
    }
    schedulePersist()
  }

  const handleBackspace = async (r: number, c: number) => {
    if (endOfGame.value) return

    let targetR = r
    let targetC = c

    const char = gm.editableGrid.value[r][c]
    if (!char) {
      const prev = im.focusPrevEditable(r, c)
      if (!prev) return
      targetR = prev.r
      targetC = prev.c
    }

    const wasComplete = gm.areAllEditableFilledInRow(targetR)
    const wasValid = !!gm.rowValid.value[targetR]
    // const wasXor = !!gm.rowInvalidByXor.value[targetR]

    options.typingAgg?.onBackspace()
    gm.editableGrid.value[targetR][targetC] = ''

    // Reset all error/invalid states when a letter is deleted
    if (gm.rowInvalidByXor.value[targetR]) gm.rowInvalidByXor.value[targetR] = false
    if (gm.rowError.value[targetR]) gm.rowError.value[targetR] = false
    if (errorRow.value === targetR) errorRow.value = null

    const nowComplete = gm.areAllEditableFilledInRow(targetR)
    if (wasComplete && !nowComplete && wasValid) {
      gm.rowValid.value[targetR] = false
      options.callLiveScoring({ forceApi: true })
    } else {
      gm.rowValid.value[targetR] = false
    }

    if (errorRow.value === targetR) errorRow.value = null
    schedulePersist()
  }

  const handleArrow = (r: number, c: number, dir: 'up' | 'down' | 'left' | 'right') => {
    im.handleArrow(r, c, dir)
  }

  const handleEnter = (r: number, c: number) => {
    if (endOfGame.value) return
    options.typingAgg?.onEnter()
  }

  // Watches for persistence
  watch(am.builderWord, () => {
    schedulePersist()
  })
  watch(gm.editableGrid, () => {
    schedulePersist()
  }, { deep: true })

  // --- Anagram Handlers ---

  const onBuilderChange = (word: string, activeAnagramBuilder: Ref<any>) => {
    const liveSnap = activeAnagramBuilder.value?.getBuilderSnapshot?.()
    const layoutChanged = getAnagramWordFromSlots(liveSnap?.slots) !== getAnagramWordFromSlots(am.latestBuilderSnapshot.value?.slots)
    const wordChanged = (word !== am.builderWord.value) || layoutChanged

    am.builderWord.value = word
    if (liveSnap) am.latestBuilderSnapshot.value = liveSnap

    if (!am.hydrationInProgress.value && wordChanged && Number(am.anagramVerifiedPoints.value) > 0) {
      am.anagramVerifiedPoints.value = 0
      options.callLiveScoring({
        forceApi: true,
        anagramWord: word,
        latestBuilderSnapshot: liveSnap || am.latestBuilderSnapshot.value
      })
    }
    schedulePersist()
  }

  const onBuilderSnapshot = (snap: any) => {
    const layoutChanged = getAnagramWordFromSlots(snap?.slots) !== getAnagramWordFromSlots(am.latestBuilderSnapshot.value?.slots)
    const wordChanged = (snap?.word !== am.builderWord.value) || layoutChanged

    am.latestBuilderSnapshot.value = snap
    if (!am.hydrationInProgress.value && wordChanged && Number(am.anagramVerifiedPoints.value) > 0) {
      am.anagramVerifiedPoints.value = 0
      options.callLiveScoring({ forceApi: true, latestBuilderSnapshot: snap })
    }
    schedulePersist()
  }

  const onAnagramShuffleClicked = (opts: any) => {
    am.onAnagramShuffle(options.shuffleAgg, options.adManager)
  }

  const onAnagramReset = (len: number) => {
    am.onAnagramReset(options.shuffleAgg, len, () => persistNow())
  }

  const onVerifyAnagram = async (word: string, activeAnagramBuilder: Ref<any>) => {
    await am.onVerifyAnagram(
      word,
      endOfGame,
      async () => {}, // nextTick placeholder or passed in
      options.callLiveScoring,
      (submitted, pts) => triggerAnagramCelebrate(submitted, pts),
      activeAnagramBuilder,
      () => schedulePersist()
    )
  }

  function triggerAnagramCelebrate(submitted: string, pts: number | null) {
    if (options.settings.showAnagramPopup.value === false) return
    const label = (pts != null && Number.isFinite(Number(pts))) ? `Anagram +${Number(pts)}` : 'Anagram'
    anagramPopupText.value = label
    anagramPopupVisible.value = true
    setTimeout(() => {
      anagramPopupVisible.value = false
      anagramPopupText.value = ''
    }, 5000)
  }

  // --- Persistence ---

  let persistTimer: any = null

  function schedulePersist() {
    if (isTutorial) return
    if (am.hydrationInProgress.value) return
    if (persistTimer) clearTimeout(persistTimer)
    persistTimer = setTimeout(() => {
      persistNow()
    }, 300)
  }

  function persistNow() {
    if (isTutorial) return
    try {
      if (am.hydrationInProgress.value || endOfGame.value) return

      const rows = (gm.editableGrid.value || []).map(r => (r || []).map(ch => (ch || '') + ''))
      const rowStates = []
      const rowCount = baseGrid.value?.length || 0
      for (let r = 0; r < rowCount; r++) {
        const word = composeRowWordFromGrids(r, baseGrid.value, gm.editableGrid.value, am.isTargetCell)
        const complete = gm.areAllEditableFilledInRow(r)
        const validFlag = complete ? (typeof gm.rowValid.value[r] === 'boolean' ? gm.rowValid.value[r] : null) : null
        rowStates.push({ valid: validFlag, word })
      }

      const snap = am.latestBuilderSnapshot.value
      const len = (am.topAnagram.value || '').length

      // Carry forward logic from Margana.vue (simplified)
      let mergedSlots = snap.slots?.slice()
      let mergedBank = snap.bank?.slice()
      let mergedOrder = snap.topOrder?.slice()

      if (am.ignoreEmptySnapshots.value) {
        const existing = options.loadPuzzleState(options.puzzleDateStr.value)
        if (existing) {
          const slotsEmpty = !mergedSlots?.some(ch => !!(ch && String(ch).trim()))
          if (slotsEmpty && existing.builderSlots) mergedSlots = existing.builderSlots
          const bankEmpty = !mergedBank?.some(Boolean)
          if (bankEmpty && existing.builderBank) mergedBank = existing.builderBank
        }
      }

      const draft = {
        v: 3,
        ts: Date.now(),
        rows,
        builderWord: am.builderWord.value || '',
        rowStates,
        builderSlots: mergedSlots,
        builderBank: mergedBank,
        topOrder: mergedOrder,
        totalScore: Number(score.value),
        anagramVerifiedPoints: Number(am.anagramVerifiedPoints.value)
      }
      options.savePuzzleState(options.puzzleDateStr.value, draft)
    } catch (e) {}
  }

  // --- Computeds ---

  const isGridComplete = computed(() => {
    const rows = baseGrid.value.length
    if (!rows) return false
    for (let r = 0; r < rows; r++) {
      if (gm.hasAnyEditableInRow(r) && !gm.areAllEditableFilledInRow(r)) return false
    }
    return true
  })

  const allRowsValid = computed(() => {
    const rows = baseGrid.value.length
    if (!rows) return false
    for (let r = 0; r < rows; r++) {
      const hasEditable = gm.hasAnyEditableInRow(r)
      const wildcardOk = options.settings.enableWildcardBypass.value ? gm.rowHasWildcard(r) : false
      const ok = hasEditable ? (wildcardOk || !!gm.rowValid.value[r]) : true
      if (!ok) return false
    }
    return true
  })

  const canSubmit = computed(() => {
    if (posting.value) return false
    if (endOfGame.value) return false
    if (!isGridComplete.value) return false
    if (!allRowsValid.value) return false
    if (gm.pendingRowValidations.value > 0) return false
    return true
  })

  return {
    puzzle,
    baseGrid,
    result,
    score,
    shakeRow,
    errorRow,
    madnessSig,
    rowPulseSigs,
    diagPulseSigs,
    highlightedCells,
    anagramPopupVisible,
    anagramPopupText,
    anagramHighlighted,
    showStatistics,
    posting,
    endOfGame,
    allRowsValid,
    canSubmit,
    gm,
    am,
    im,
    pm,
    validation,
    handleInput,
    handleBackspace,
    handleArrow,
    handleEnter,
    onBuilderChange,
    onBuilderSnapshot,
    onAnagramShuffleClicked,
    onAnagramReset,
    onVerifyAnagram,
    schedulePersist,
    persistNow
  }
}

export type MarganaGameSession = ReturnType<typeof useMarganaGame>
