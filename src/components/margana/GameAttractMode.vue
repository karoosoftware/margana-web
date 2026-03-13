<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch, nextTick, defineAsyncComponent } from 'vue'
import GridBoard from '../GridBoard.vue'
import AnagramBuilder from '../AnagramBuilder.vue'
import LiveScoreSpinner from '../LiveScoreSpinner.vue'
import { useGhostPlayer } from '@/composables/useGhostPlayer'
import { useGameState } from '@/composables/useGameState'
import { useGridManager } from '@/composables/useGridManager'
import { useAnagramManager } from '@/composables/useAnagramManager'
import { useInputManagement } from '@/composables/useInputManagement'
import { usePulseManager } from '@/composables/usePulseManager'
import { useGridValidation } from '@/composables/useGridValidation'
import { computeHighlightFromItem, composeRowWordFromGrids } from '@/utils/highlightUtils'
import * as ML from '@/utils/marganaLogic'
import letterScoresJson from '@/resources/letter-scores-v3.json'
import tutorialStepsJson from '@/resources/tutorial/playLandingPageGame/tutorial-steps.json'
import tutorialPuzzleData from '@/resources/tutorial/playLandingPageGame/margana-semi-completed.json'

const props = defineProps({
  size: { type: String, default: 'small' }
})

const letterScores = ref({})

// Normalize letter scores to uppercase keys for consistent lookup in ML.scoreFor
if (letterScoresJson && typeof letterScoresJson === 'object') {
  for (const [k, v] of Object.entries(letterScoresJson)) {
    const key = String(k || '').toUpperCase()
    const val = typeof v === 'number' ? v : Number(v)
    if (key && Number.isFinite(val)) letterScores.value[key] = val
  }
}

function scoreFor(ch) {
  return ML.scoreFor(ch, letterScores.value)
}

// Local state for tutorial simulation
const currentStepIndex = ref(0)
const tutorialSteps = ref(tutorialStepsJson)
const isPlaying = ref(true)
const isAutoPlay = ref(true)
const localIsTutorialActive = ref(true)
const isVerifying = ref(false)

// const tutorialComponents = {
//   WelcomePage: defineAsyncComponent(() => import('./WelcomePage.vue')),
// }

const currentStep = computed(() => {
  if (currentStepIndex.value >= 0 && currentStepIndex.value < tutorialSteps.value.length) {
    return tutorialSteps.value[currentStepIndex.value]
  }
  return null
})

function nextStep() {
  if (currentStepIndex.value < tutorialSteps.value.length - 1) {
    currentStepIndex.value++
  } else {
    // Loop
    restartAttractMode()
  }
}

const { puzzle, loadPuzzle } = useGameState()
const baseGrid = computed(() => puzzle.value?.grid_rows?.map(row => row.toUpperCase().split('')) || [])

// We need a stable reference for isTargetCell to avoid circular dependency issues
const isTargetCell = (r, c) => am.isTargetCell(r, c)
const isVerticalTargetCell = (r, c) => am.isVerticalTargetCell(r, c)
const isDiagonalCell = (r, c) => am.isDiagonalCell(r, c)

const gm = useGridManager(baseGrid, ref(true), isTargetCell)
const am = useAnagramManager(puzzle, baseGrid, gm.editableGrid)
const pm = usePulseManager(baseGrid, ref(true))

const im = useInputManagement(baseGrid, gm.editableGrid, gm.isEditableCell)

const liveTotalScore = ref(0)

// --- Anagram celebration popup ---
const anagramPopupVisible = ref(false)
const anagramPopupText = ref('')
let _anagramPopupTimer = null

function anagramPopupClass() {
  return [
    'rounded-full text-white shadow-lg',
    'bg-gradient-to-tr from-purple-600 to-orange-600',
    'animate-fade-out-5s',
    'whitespace-nowrap leading-none tracking-tight px-2 py-1',
  ].join(' ')
}

function showAnagramPopup(label) {
  anagramPopupText.value = String(label || 'Anagram')
  anagramPopupVisible.value = true
  if (_anagramPopupTimer) clearTimeout(_anagramPopupTimer)
  _anagramPopupTimer = setTimeout(() => {
    anagramPopupVisible.value = false
    anagramPopupText.value = ''
    _anagramPopupTimer = null
  }, 5000)
}

function triggerAnagramCelebrate(submitted, score = null) {
  const label = (score != null && Number.isFinite(Number(score))) ? `Anagram +${Number(score)}` : 'Anagram'
  showAnagramPopup(label)
}

const { validateRowAndMaybeAdvance } = useGridValidation({
  baseGrid,
  editableGrid: gm.editableGrid,
  rowValid: gm.rowValid,
  rowValidating: gm.rowValidating,
  rowValidationSeq: gm.rowValidationSeq,
  pendingRowValidations: gm.pendingRowValidations,
  rowError: gm.rowError,
  errorRow: ref(null),
  shakeRow: ref(null),
  rowInvalidByXor: gm.rowInvalidByXor,
  settingsEnableWildcardBypass: ref(true),
  liveTotalScore,
  lastMadnessSig: ref(''),
  lastRowPulseSigs: ref(new Map()),
  lastDiagPulseSigs: ref(new Map()),
  madnessAvailable: computed(() => !!puzzle.value?.madnessAvailable),
  
  rowHasWildcard: gm.rowHasWildcard,
  composeRowWord: (r) => composeRowWordFromGrids(r, baseGrid.value, gm.editableGrid.value, isTargetCell),
  callLiveScoring,
  triggerPulseRow: pm.triggerPulseRow,
  triggerPulseCells: pm.triggerPulseCells,
  focusFirstEditable: (fromRow) => im.focusFirstEditable(fromRow),
  isTargetCell,
  computeHighlightFromItem,
  schedulePersist: () => {},
  dispatchUsage: () => {}
})

const { processStep } = useGhostPlayer({
  isTutorialActive: localIsTutorialActive,
  isPlaying,
  isAutoPlay,
  nextStep,
  tutorialSteps,
  currentStepIndex
})

const containerRef = ref(null)
const activeAnagramBuilder = ref(null)

const localMasterUnitStyle = computed(() => {
  // Use global bucket tokens to avoid circular dependencies when overriding --margana-tile-w-lg
  if (props.size === 'medium') return {'--margana-tile-w-lg': 'var(--margana-tile-w-md-global)'}
  if (props.size === 'small') return {'--margana-tile-w-lg': 'var(--margana-tile-w-sm-global)'}
  if (props.size === 'tiny' || props.size === 'xs') return {'--margana-tile-w-lg': 'var(--margana-tile-w-xs-global)'}
  return {}
})

function restartAttractMode() {
  currentStepIndex.value = 0
  gm.buildEditableGrid()
  handleReset()
  pm.clearPulse()
  im.inputRefs.value = {}
  liveTotalScore.value = 0
}

async function handleReset() {
  const len = am.trueTopAnagram.value?.length || 0
  am.onAnagramReset(activeAnagramBuilder.value?.shuffleAgg, len, () => {})
  await callLiveScoring({ forceApi: true })
}

function onBuilderChange(word) {
  am.builderWord.value = word
  // If user modifies the builder after a successful verify, reset verified points
  if (Number(am.anagramVerifiedPoints.value) > 0) {
    am.anagramVerifiedPoints.value = 0
    callLiveScoring({ forceApi: true })
  }
}

async function handleInput(r, c) {
  if (gm.areAllEditableFilledInRow(r)) {
    await validateRowAndMaybeAdvance(r, { autoFocus: true })
  } else {
    // If row not complete, move focus manually (normally validateRowAndMaybeAdvance handles advancing rows)
    im.focusNextEditable(r, c)
  }
}

const handleHighlightElement = (e) => {
  const { targetId, clear } = e.detail || {}
  if (clear) {
    pm.clearPulse()
    if (activeAnagramBuilder.value) activeAnagramBuilder.value.clearHighlightAction()
  } else if (targetId) {
    if (targetId.startsWith('grid-cell-')) {
      const cell = targetId.replace('grid-cell-', '').replace('-', ':')
      pm.triggerPulseCells(new Set([cell]), 'default', null)
    } else if (activeAnagramBuilder.value) {
      activeAnagramBuilder.value.triggerHighlightAction(targetId)
    }
  }
}

const handlePlaceAnagramLetter = (e) => {
  const { slotIndex, letter, sourceTopIndex } = e.detail
  if (activeAnagramBuilder.value) {
    activeAnagramBuilder.value.placeLetterAt(slotIndex, letter, sourceTopIndex)
  }
}

const handleSetAnagramConsumed = (e) => {
  const { index, consumed } = e.detail
  if (activeAnagramBuilder.value) {
    activeAnagramBuilder.value.setTileConsumed(index, consumed)
  }
}

const handlePulseAnagramElement = (e) => {
  const { type, index, duration } = e.detail
  if (activeAnagramBuilder.value) {
    if (type === 'top') {
      activeAnagramBuilder.value.triggerPulseTop(index, duration)
    } else if (type === 'builder') {
      activeAnagramBuilder.value.triggerPulseBuilder(index, duration)
    }
  }
}

const handleClickElement = (e) => {
  const { targetId } = e.detail
  const el = containerRef.value?.querySelector('#' + targetId)
  if (el) {
    el.click()
  }
}

watch(currentStep, async (newStep) => {
  if (newStep) {
    await processStep(newStep)
  }
}, { immediate: true })

onMounted(async () => {
  await loadPuzzle(tutorialPuzzleData)
  gm.buildEditableGrid()
  handleReset()
  window.addEventListener('tutorial-highlight-element', handleHighlightElement)
  window.addEventListener('tutorial-place-anagram-letter', handlePlaceAnagramLetter)
  window.addEventListener('tutorial-set-anagram-consumed', handleSetAnagramConsumed)
  window.addEventListener('tutorial-pulse-anagram-element', handlePulseAnagramElement)
  window.addEventListener('tutorial-click-element', handleClickElement)
})

onBeforeUnmount(() => {
  isPlaying.value = false
  localIsTutorialActive.value = false
  window.removeEventListener('tutorial-highlight-element', handleHighlightElement)
  window.removeEventListener('tutorial-place-anagram-letter', handlePlaceAnagramLetter)
  window.removeEventListener('tutorial-set-anagram-consumed', handleSetAnagramConsumed)
  window.removeEventListener('tutorial-pulse-anagram-element', handlePulseAnagramElement)
  window.removeEventListener('tutorial-click-element', handleClickElement)
})

// Mock callLiveScoring that useAnagramManager and useGridValidation need
async function callLiveScoring(opts) {
  const data = currentStep.value?.response || {}
  if (data && typeof data.total_score === 'number') {
    liveTotalScore.value = data.total_score
  }
  return data
}

</script>

<template>
  <div ref="containerRef" class="p-2 game-attract-mode relative w-full flex flex-col items-center pointer-events-none select-none overflow-hidden margana-proportions" :style="localMasterUnitStyle" tabindex="-1">

    <template v-if="currentStep?.component">
      <component :is="tutorialComponents[currentStep.component]" />
    </template>
    <template v-else>
      <!-- Score Counter -->
      <div class="w-full flex justify-center mb-2">
        <LiveScoreSpinner :score="Number(liveTotalScore)" :enabled="true" size="large" :reels="3" />
      </div>

      <GridBoard
        v-if="baseGrid.length && gm.editableGrid.value.length === baseGrid.length"
        :baseGrid="baseGrid"
        :editableGrid="gm.editableGrid.value"
        :rowError="gm.rowError.value"
        :endOfGame="false"
        :readonly="true"
        :isTargetCell="isTargetCell"
        :isVerticalTargetCell="isVerticalTargetCell"
        :isDiagonalCell="isDiagonalCell"
        :scoreFor="scoreFor"
        :highlightedCells="new Set()"
        :pulseCells="pm.pulseCells.value"
        :pulseThemes="pm.effectivePulseThemes.value"
        :pulseLabels="pm.effectivePulseLabels.value"
        :setGridContainer="() => {}"
        :setInputRef="(key, el) => (im.inputRefs.value[key] = el)"
        :showPulseLabels="true"
        size="small"
        @cell-input="handleInput"
      />

      <div class="relative w-full flex flex-col items-center mt-1">
        <!-- Anagram celebration popup -->
        <div v-if="anagramPopupVisible"
             class="pointer-events-none absolute left-1/2 -translate-x-1/2 -translate-y-full z-30 select-none flex justify-center"
             style="top: var(--margana-popup-offset)">
          <div :class="anagramPopupClass()" style="font-size: var(--margana-popup-font-size)">
            <span class="font-semibold whitespace-nowrap">{{ anagramPopupText }}</span>
          </div>
        </div>

        <AnagramBuilder
          ref="activeAnagramBuilder"
          :topAnagram="am.topAnagram.value"
          :anagramRevealMask="am.anagramRevealMask.value"
          :readonly="true"
          :scoreFor="scoreFor"
          :isTutorial="true"
          :showControls="false"
          size="large"
          @builder-change="onBuilderChange"
          @verify-anagram="(word) => am.onVerifyAnagram(word, isVerifying, nextTick, callLiveScoring, triggerAnagramCelebrate, activeAnagramBuilder, () => {})"
          @shuffle="(shuffleAgg) => am.onAnagramShuffle(shuffleAgg)"
          @reset="handleReset"
        />
      </div>
    </template>

    <!-- Hidden Submit Buttons for Ghost Player -->
    <button id="margana-submit-btn" class="hidden"></button>
    <button id="margana-submit-btn-tutorial" class="hidden"></button>

  </div>
</template>

<style scoped>
.game-attract-mode {
  /* Double reinforcement of the firewall */
  pointer-events: none !important;
}

/* Ensure all children also inherit non-interactivity and are removed from tab order */
.game-attract-mode * {
  pointer-events: none !important;
  user-select: none !important;
}
</style>
