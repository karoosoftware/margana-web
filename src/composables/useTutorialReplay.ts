import { nextTick, type Ref } from 'vue'

type TutorialReplayOptions = {
  isTutorialActive: Ref<boolean>
  activeAnagramBuilder: Ref<any>
  tutorialGM: any
  tutorialAM: any
  tutorialPM: any
  tutorialErrorRow: Ref<any>
  tutorialShakeRow: Ref<any>
  tutorialResult: Ref<any>
  tutorialScore: Ref<number>
  tutorialAnagramHighlighted: Ref<boolean>
  tutorialShowStatistics: Ref<boolean>
  tutorialAnagramPopupVisible: Ref<boolean>
  tutorialAnagramPopupText: Ref<string>
  submitHighlightActive: Ref<boolean>
  tutorialMadnessSig: Ref<string>
  tutorialRowPulseSigs: Ref<Map<number, string>>
  tutorialDiagPulseSigs: Ref<Map<string, string>>
  tutorialHighlightedCells: Ref<Set<string>>
  initialBuilderSnapshot: Ref<any>
  onResetPopupTimer?: (visible: boolean) => void
}

function cloneGrid(grid: any) {
  if (!Array.isArray(grid)) return []
  return grid.map(row => (Array.isArray(row) ? row.slice() : []))
}

function cloneArray(arr: any) {
  return Array.isArray(arr) ? arr.slice() : []
}

function cloneValue(value: any) {
  try {
    if (typeof structuredClone === 'function') return structuredClone(value)
  } catch (_) {}
  try {
    return JSON.parse(JSON.stringify(value))
  } catch (_) {
    return value
  }
}

export function useTutorialReplay(options: TutorialReplayOptions) {
  const snapshots = new Map<number, any>()

  function buildTutorialSnapshot() {
    const builderSnapshot = options.activeAnagramBuilder.value?.getBuilderSnapshot?.()
    return {
      editableGrid: cloneGrid(options.tutorialGM.editableGrid.value),
      rowValid: cloneArray(options.tutorialGM.rowValid.value),
      rowValidating: cloneArray(options.tutorialGM.rowValidating.value),
      rowValidationSeq: cloneArray(options.tutorialGM.rowValidationSeq.value),
      pendingRowValidations: Number(options.tutorialGM.pendingRowValidations.value || 0),
      rowError: cloneArray(options.tutorialGM.rowError.value),
      rowInvalidByXor: cloneArray(options.tutorialGM.rowInvalidByXor.value),
      errorRow: options.tutorialErrorRow.value,
      shakeRow: options.tutorialShakeRow.value,
      result: cloneValue(options.tutorialResult.value),
      score: Number(options.tutorialScore.value || 0),
      anagramHighlighted: !!options.tutorialAnagramHighlighted.value,
      showStatistics: !!options.tutorialShowStatistics.value,
      anagramPopupVisible: !!options.tutorialAnagramPopupVisible.value,
      anagramPopupText: String(options.tutorialAnagramPopupText.value || ''),
      anagramVerifiedPoints: Number(options.tutorialAM.anagramVerifiedPoints.value || 0),
      builderWord: String(options.tutorialAM.builderWord.value || ''),
      latestBuilderSnapshot: cloneValue(options.tutorialAM.latestBuilderSnapshot.value),
      initialBuilderSnapshot: cloneValue(options.tutorialAM.initialBuilderSnapshot.value),
      builderSnapshot: cloneValue(builderSnapshot),
      forceClearBuilderOnce: !!options.tutorialAM.forceClearBuilderOnce.value,
      hydrationInProgress: !!options.tutorialAM.hydrationInProgress.value,
      ignoreEmptySnapshots: !!options.tutorialAM.ignoreEmptySnapshots.value,
      submitHighlightActive: !!options.submitHighlightActive.value,
      lastMadnessSig: String(options.tutorialMadnessSig.value || ''),
      rowPulseSigs: Array.from(options.tutorialRowPulseSigs.value.entries()),
      diagPulseSigs: Array.from(options.tutorialDiagPulseSigs.value.entries()),
      highlightedCells: Array.from(options.tutorialHighlightedCells.value.values()),
      pulseState: options.tutorialPM.getPulseState ? options.tutorialPM.getPulseState() : null
    }
  }

  async function restoreTutorialSnapshot(snapshot: any, restoreOptions: { suppressTransientEffects?: boolean } = {}) {
    if (!snapshot) return

    options.tutorialGM.editableGrid.value = cloneGrid(snapshot.editableGrid)
    options.tutorialGM.rowValid.value = cloneArray(snapshot.rowValid)
    options.tutorialGM.rowValidating.value = cloneArray(snapshot.rowValidating)
    options.tutorialGM.rowValidationSeq.value = cloneArray(snapshot.rowValidationSeq)
    options.tutorialGM.pendingRowValidations.value = Number(snapshot.pendingRowValidations || 0)
    options.tutorialGM.rowError.value = cloneArray(snapshot.rowError)
    options.tutorialGM.rowInvalidByXor.value = cloneArray(snapshot.rowInvalidByXor)

    options.tutorialErrorRow.value = snapshot.errorRow ?? null
    options.tutorialShakeRow.value = snapshot.shakeRow ?? null
    options.tutorialResult.value = cloneValue(snapshot.result)
    options.tutorialScore.value = Number(snapshot.score || 0)
    options.tutorialAnagramHighlighted.value = !!snapshot.anagramHighlighted
    options.tutorialShowStatistics.value = !!snapshot.showStatistics
    if (!restoreOptions.suppressTransientEffects) {
      options.tutorialAnagramPopupVisible.value = !!snapshot.anagramPopupVisible
      options.tutorialAnagramPopupText.value = String(snapshot.anagramPopupText || '')
    } else {
      options.tutorialAnagramPopupVisible.value = false
      options.tutorialAnagramPopupText.value = ''
    }
    options.tutorialAM.anagramVerifiedPoints.value = Number(snapshot.anagramVerifiedPoints || 0)
    options.tutorialAM.builderWord.value = String(snapshot.builderWord || '')
    options.tutorialAM.latestBuilderSnapshot.value = cloneValue(snapshot.latestBuilderSnapshot)
    options.tutorialAM.initialBuilderSnapshot.value = cloneValue(snapshot.initialBuilderSnapshot)
    options.tutorialAM.forceClearBuilderOnce.value = !!snapshot.forceClearBuilderOnce
    options.tutorialAM.hydrationInProgress.value = !!snapshot.hydrationInProgress
    options.tutorialAM.ignoreEmptySnapshots.value = !!snapshot.ignoreEmptySnapshots

    options.submitHighlightActive.value = !!snapshot.submitHighlightActive
    options.tutorialMadnessSig.value = String(snapshot.lastMadnessSig || '')
    if (!restoreOptions.suppressTransientEffects) {
      options.tutorialRowPulseSigs.value = new Map(snapshot.rowPulseSigs || [])
      options.tutorialDiagPulseSigs.value = new Map(snapshot.diagPulseSigs || [])
      options.tutorialHighlightedCells.value = new Set(snapshot.highlightedCells || [])
      options.tutorialPM.restorePulseState?.(snapshot.pulseState)
    } else {
      options.tutorialRowPulseSigs.value = new Map()
      options.tutorialDiagPulseSigs.value = new Map()
      options.tutorialHighlightedCells.value = new Set()
      options.tutorialPM.clearPulse?.()
    }

    if (options.onResetPopupTimer) {
      options.onResetPopupTimer(!!options.tutorialAnagramPopupVisible.value)
    }

    const builderSnapshot = snapshot.builderSnapshot || snapshot.latestBuilderSnapshot
    if (builderSnapshot) {
      if (!options.activeAnagramBuilder.value || !options.activeAnagramBuilder.value.restoreBuilderSnapshot) {
        await nextTick()
      }
      try {
        options.initialBuilderSnapshot.value = builderSnapshot
      } catch (_) {}
      options.activeAnagramBuilder.value?.restoreBuilderSnapshot?.(builderSnapshot)
      await nextTick()
      try {
        options.tutorialAM.builderWord.value = (options.activeAnagramBuilder.value?.getBuilderWord?.() || snapshot.builderWord || '').toString().toUpperCase()
      } catch (_) {}
    }
  }

  function handleTutorialStepStart(e: any) {
    if (!options.isTutorialActive.value) return
    const index = e?.detail?.index
    if (!Number.isInteger(index)) return
    snapshots.set(index, buildTutorialSnapshot())
  }

  async function handleTutorialRestoreStep(e: any) {
    const done = e?.detail?.done
    try {
      if (!options.isTutorialActive.value) return
      const index = e?.detail?.index
      if (!Number.isInteger(index)) return
      const snapshot = snapshots.get(index)
      const suppressTransientEffects = !!e?.detail?.suppressTransientEffects
      await restoreTutorialSnapshot(snapshot, { suppressTransientEffects })
    } finally {
      if (typeof done === 'function') done()
    }
  }

  function clearSnapshots() {
    snapshots.clear()
  }

  return {
    buildTutorialSnapshot,
    restoreTutorialSnapshot,
    handleTutorialStepStart,
    handleTutorialRestoreStep,
    clearSnapshots
  }
}
