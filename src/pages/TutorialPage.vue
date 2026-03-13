<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useTutorial } from '@/composables/useTutorial'
import { useTutorialReplay } from '@/composables/useTutorialReplay'
import { useMarganaGame } from '@/composables/useMarganaGame'
import { useOrientation } from '@/composables/useOrientation'
import { useMarganaAuth } from '@/composables/useMarganaAuth'
import { useAdManager } from '@/composables/useAdManager'
import { useRegisteredMetrics } from '@/composables/useRegisteredMetrics'
import TutorialController from '@/components/margana/TutorialController.vue'
import GameView from '@/components/margana/GameView.vue'
import { computeHighlightFromItem } from '@/utils/highlightUtils'
import tutorialStepsJson from '@/resources/tutorial/playFullGameTutorial/tutorial-steps.json'
import tutorialPuzzleData from '@/resources/tutorial/playFullGameTutorial/margana-semi-completed.json'
import { useLetterScores } from '@/composables/useLetterScores'

const router = useRouter()

const windowHeight = ref(typeof window !== 'undefined' ? window.innerHeight : 800)
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1024)
const onResize = () => {
  windowHeight.value = window.innerHeight
  windowWidth.value = window.innerWidth
}

const tutorialGameView = ref(null)
const submitHighlightActive = ref(false)
const { scoreFor, loadLetterScores } = useLetterScores()

const {
  isTutorialActive,
  startTutorial,
  stopTutorial,
  currentStep,
} = useTutorial()

const tutorialPuzzle = ref(tutorialPuzzleData)

const { isAuthenticated, initialized: authInitialized, guestId } = useMarganaAuth()
const adManager = useAdManager()
const { dispatchUsage } = useRegisteredMetrics()

// Orientation
const { landscapeMobileMode } = useOrientation(computed(() => false))

const tutorialGame = useMarganaGame(tutorialPuzzle, {
  isTutorial: true,
  callLiveScoring: async () => currentStep.value?.response || {},
  computeHighlightFromItem,
  dispatchUsage: () => {},
  loadPuzzleState: () => null,
  savePuzzleState: () => {},
  puzzleDateStr: ref('tutorial'),
  settings: {
    enableWildcardBypass: ref(true),
    showPulseLabels: ref(true),
    enableLiveScoring: ref(true),
    showAnagramPopup: ref(true)
  },
  adManager
})

const {
  handleTutorialStepStart,
  handleTutorialRestoreStep,
  clearSnapshots: clearTutorialSnapshots
} = useTutorialReplay({
  isTutorialActive,
  activeAnagramBuilder: computed(() => tutorialGameView.value?.anagramBuilder),
  tutorialGM: tutorialGame.gm,
  tutorialAM: tutorialGame.am,
  tutorialPM: tutorialGame.pm,
  tutorialErrorRow: tutorialGame.errorRow,
  tutorialShakeRow: tutorialGame.shakeRow,
  tutorialResult: tutorialGame.result,
  tutorialScore: tutorialGame.score,
  tutorialAnagramHighlighted: tutorialGame.anagramHighlighted,
  tutorialShowStatistics: tutorialGame.showStatistics,
  tutorialAnagramPopupVisible: tutorialGame.anagramPopupVisible,
  tutorialAnagramPopupText: tutorialGame.anagramPopupText,
  submitHighlightActive,
  tutorialMadnessSig: tutorialGame.madnessSig,
  tutorialRowPulseSigs: tutorialGame.rowPulseSigs,
  tutorialDiagPulseSigs: tutorialGame.diagPulseSigs,
  tutorialHighlightedCells: tutorialGame.highlightedCells,
  initialBuilderSnapshot: computed({
    get: () => tutorialGame.am.initialBuilderSnapshot.value,
    set: (v) => { tutorialGame.am.initialBuilderSnapshot.value = v }
  }),
  onResetPopupTimer: (visible) => {
    if (visible) {
      setTimeout(() => {
        tutorialGame.anagramPopupVisible.value = false
        tutorialGame.anagramPopupText.value = ''
      }, 5000)
    }
  }
})

function marganaSubmit() {
  // Mock submit for tutorial
  tutorialGame.result.value = { success: true, score: tutorialGame.score.value }
}

onMounted(async () => {

  // 1. Load data first
  await loadLetterScores()

  // 2. Setup listeners
  window.addEventListener('resize', onResize)
  window.addEventListener('tutorial-step-start', handleTutorialStepStart)
  window.addEventListener('tutorial-restore-step', handleTutorialRestoreStep)

  window.addEventListener('start-tutorial', (e) => {
    const {steps, puzzle: tPuzzle} = e.detail
    // Cache the tutorial puzzle so we can restart it
    if (tPuzzle && typeof localStorage !== 'undefined') {
      localStorage.setItem('margana-tutorial-puzzle-cache', JSON.stringify(tPuzzle))
    }

    clearTutorialSnapshots()
    if (tPuzzle) tutorialPuzzle.value = tPuzzle
    startTutorial(steps)
    nextTick(() => {
      tutorialGame.gm.buildEditableGrid()
      tutorialGame.am.onAnagramReset(null, (tutorialGame.am.topAnagram.value || '').length)
    })
  })

  window.addEventListener('tutorial-place-anagram-letter', (e) => {
    const {slotIndex, letter, sourceTopIndex} = e.detail
    if (tutorialGameView.value?.anagramBuilder) {
      tutorialGameView.value.anagramBuilder.placeLetterAt(slotIndex, letter, sourceTopIndex)
    }
  })

  window.addEventListener('tutorial-set-anagram-consumed', (e) => {
    const {index, consumed} = e.detail
    if (tutorialGameView.value?.anagramBuilder) {
      tutorialGameView.value.anagramBuilder.setTileConsumed(index, consumed)
    }
  })

  window.addEventListener('tutorial-pulse-anagram-element', (e) => {
    const {type, index, duration} = e.detail
    if (tutorialGameView.value?.anagramBuilder) {
      if (type === 'top') {
        tutorialGameView.value.anagramBuilder.triggerPulseTop(index, duration)
      } else if (type === 'builder') {
        tutorialGameView.value.anagramBuilder.triggerPulseBuilder(index, duration)
      }
    }
  })

  window.addEventListener('tutorial-highlight-element', (e) => {
    const {targetId, clear} = e.detail
    if (targetId === 'margana-submit-btn' || targetId === 'margana-submit-btn-tutorial') {
      submitHighlightActive.value = !clear
    } else if (tutorialGameView.value?.anagramBuilder) {
      if (clear) {
        tutorialGameView.value.anagramBuilder.clearHighlightAction()
      } else {
        tutorialGameView.value.anagramBuilder.triggerHighlightAction(targetId)
      }
    }
  })

  window.addEventListener('tutorial-click-element', (e) => {
    const {targetId} = e.detail
    const el = document.getElementById(targetId)
    if (el) {
      el.click()
    }
  })

  // 3. Start the tutorial only once everything is ready
  clearTutorialSnapshots()
  startTutorial(tutorialStepsJson)
  nextTick(() => {
    tutorialGame.gm.buildEditableGrid()
    tutorialGame.am.onAnagramReset(null, (tutorialGame.am.topAnagram.value || '').length)
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  window.removeEventListener('tutorial-step-start', handleTutorialStepStart)
  window.removeEventListener('tutorial-restore-step', handleTutorialRestoreStep)
  stopTutorial()
})

// Watch for tutorial being stopped (e.g. via X button in TutorialController)
watch(isTutorialActive, (active) => {
  if (!active) {
    router.push({ name: 'margana' })
  }
})
</script>

<template>
  <div class="relative flex-1 flex flex-col items-center bg-gray-900 min-h-screen">
    <h1 class="sr-only">Margana Tutorial</h1>
    <TutorialController 
      v-if="isTutorialActive" 
      :scoreFor="scoreFor" 
      :size="(windowHeight < 800 || windowWidth < 500) ? 'small' : 'medium'"
    >
      <GameView
          ref="tutorialGameView"
          :session="tutorialGame"
          :isTutorial="true"
          :readonly="true"
          :landscape="landscapeMobileMode"
          :scoreFor="scoreFor"
          :settings="{
            enableLiveScoring: true,
            showPulseLabels: true,
            enableWildcardBypass: true,
            showAnagramPopup: true
          }"
      >
        <template #right-controls="{ controlsBtnSizeClass }">
          <div v-if="!landscapeMobileMode" class="flex items-center" :style="{ gap: 'var(--margana-btn-gap)' }">
            <button
                id="margana-submit-btn-tutorial"
                @click="marganaSubmit"
                :disabled="!tutorialGame.canSubmit.value || tutorialGame.posting.value"
                aria-label="Submit your grid and anagram"
                class="btn-common-button controls-btn relative"
                :class="[controlsBtnSizeClass, { 'pointer-events-none': true }]">
              Submit
              <div v-if="submitHighlightActive"
                   class="absolute inset-0 rounded-full ring-4 ring-violet-300 pointer-events-none z-10"></div>
            </button>
          </div>
        </template>
      </GameView>
    </TutorialController>
  </div>
</template>

<style scoped>
.tutorial-overlay {
  background: none !important; /* Remove overlay background as we are on a dedicated page */
}
</style>
