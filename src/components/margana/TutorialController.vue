<script setup>
import {ref, computed, watch, onBeforeUnmount, nextTick, defineAsyncComponent} from 'vue'
import marganaLogoM from '@/assets/margana_m_logo.svg'
import {useTutorial} from '@/composables/useTutorial'
import {useGhostPlayer} from '@/composables/useGhostPlayer'
import {
  PlayIcon,
  XMarkIcon
} from '@heroicons/vue/20/solid'

const props = defineProps({
  scoreFor: {type: Function, default: () => 0},
  size: {type: String, default: 'large'} // tiny | small | medium | large
})

// Map the components you want to make available in the tutorial
const tutorialComponents = {
  WelcomePage: defineAsyncComponent(() => import('./WelcomePage.vue')),
  GameAttractMode: defineAsyncComponent(() => import('./GameAttractMode.vue')),
}

const {
  isTutorialActive,
  currentStep,
  currentStepIndex,
  tutorialSteps,
  isPlaying,
  isAutoPlay,
  stopTutorial,
  togglePlay,
  restartTutorial,
  nextStep
} = useTutorial()

const { processStep, isSilverRingAction } = useGhostPlayer({
  isTutorialActive,
  isPlaying,
  isAutoPlay,
  nextStep,
  tutorialSteps,
  currentStepIndex,
  onStepStart: (step, index) => {
    if (index === undefined || index === null) return
    window.dispatchEvent(new CustomEvent('tutorial-step-start', {
      detail: { index }
    }))
  }
})

const modalContainer = ref(null)

const isAtEnd = computed(() => currentStepIndex.value === tutorialSteps.value.length - 1)

const activeDescriptionIndex = computed(() => {
  if (currentStepIndex.value <= 0) return 0;
  let idx = currentStepIndex.value;
  while (idx > 0 && (tutorialSteps.value[idx].continueDescription || !tutorialSteps.value[idx].description)) {
    idx--;
  }
  return idx;
});

const logicalStepsIndices = computed(() => {
  return tutorialSteps.value
      .map((step, index) => ({step, index}))
      .filter(({step}) => step.description && !step.continueDescription)
      .map(({index}) => index);
});

const currentLogicalStepIndex = computed(() => {
  // Finds which logical group the current step belongs to
  return logicalStepsIndices.value.indexOf(activeDescriptionIndex.value);
});

const displayDescription = computed(() => {
  return tutorialSteps.value[activeDescriptionIndex.value]?.description;
});

function handlePlay() {
  if (isButtonLocked.value || isPlaying.value) return
  isButtonLocked.value = true

  // Unlock after a short debounce period to prevent rapid double-clicks
  // while Vue/DOM updates are still in flight.
  setTimeout(() => {
    isButtonLocked.value = false
  }, 250)

  if (isAtEnd.value) {
    // Reset game state before restarting
    window.dispatchEvent(new CustomEvent('start-tutorial', {
      detail: {
        steps: tutorialSteps.value,
        puzzle: JSON.parse(localStorage.getItem('margana-tutorial-puzzle-cache') || 'null') || {}
      }
    }))
    restartTutorial()
    hasStartedPlayback.value = true
  } else {
    markStepInProgress()
    isPlaying.value = true
    nextStep()
    hasStartedPlayback.value = true
  }
}

const showVerifyTick = ref(false)
const verifyTickStyle = ref({display: 'none'})
const isButtonLocked = ref(false)
const isReplaying = ref(false)
const stepCompleted = ref(false)
const hasStartedPlayback = ref(false)

const localMasterUnitStyle = computed(() => {
  const base = {}
  // Use global bucket tokens to avoid circular dependencies when overriding --margana-tile-w-lg
  if (props.size === 'medium') base['--margana-tile-w-lg'] = 'var(--margana-tile-w-md-global)'
  else if (props.size === 'small') base['--margana-tile-w-lg'] = 'var(--margana-tile-w-sm-global)'
  else if (props.size === 'tiny' || props.size === 'xs') base['--margana-tile-w-lg'] = 'var(--margana-tile-w-xs-global)'

  // Tutorial-specific fine-tuning: Reduce grid score font size and position ratios for a cleaner look in constrained modals
  base['--margana-grid-score-font-size'] = 'calc(var(--margana-tile-w-lg) * 0.17)'
  base['--margana-grid-score-pos'] = 'calc(var(--margana-tile-w-lg) * 0.06)'

  return base
})

const showReplayButton = computed(() => {
  if (!hasStartedPlayback.value) return false
  if (currentStep.value?.component) return false
  return logicalStepsIndices.value.length > 1
});

function markStepInProgress() {
  stepCompleted.value = false
}

  function requestRestoreStep(index, suppressTransientEffects = false) {
  return new Promise((resolve) => {
    let doneCalled = false
    const done = () => {
      if (doneCalled) return
      doneCalled = true
      resolve(null)
    }
    window.dispatchEvent(new CustomEvent('tutorial-restore-step', {
      detail: { index, done, suppressTransientEffects }
    }))
    setTimeout(done, 0)
  })
}

async function handleReplay() {
  if (isButtonLocked.value || isPlaying.value || !currentStep.value) return
  isButtonLocked.value = true
  isReplaying.value = true

  try {
    let replayStartIndex = currentStepIndex.value
    while (replayStartIndex > 0) {
      const step = tutorialSteps.value[replayStartIndex]
      if (step?.description && !step?.continueDescription) break
      replayStartIndex--
    }
    await requestRestoreStep(replayStartIndex, true)
    isPlaying.value = true

    let idx = replayStartIndex
    while (idx < tutorialSteps.value.length) {
      const stepToReplay = tutorialSteps.value[idx]
      if (!stepToReplay) break
      await processStep(stepToReplay, { suppressAdvance: true, stepIndexOverride: idx, keepPlaying: true })

      const nextStep = tutorialSteps.value[idx + 1]
      if (!nextStep || (nextStep.description && !nextStep.continueDescription)) break
      idx++
    }
  } finally {
    isPlaying.value = false
    isReplaying.value = false
    setTimeout(() => {
      isButtonLocked.value = false
    }, 250)
  }
}

// Logic to move the ghost cursor based on the current step's action
watch(currentStep, async (newStep) => {
  if (!newStep) {
    stepCompleted.value = false
    return
  }
  markStepInProgress()
  await processStep(newStep)
  stepCompleted.value = true
}, {immediate: true})

watch(isPlaying, (playing) => {
  if (!playing) {
    // Stopped
  }
})

// Event Firewall logic to block user interaction during tutorial
const handleInteraction = (e) => {
  if (!isTutorialActive.value) return;

  // Allow programmatic events (ghost player)
  if (e.isTrusted === false) return;

  // Allow events on the tutorial's own instruction UI and the close button
  if (e.target.closest('.bg-white\\/5') || e.target.closest('button[aria-label="Close tutorial"]')) {
    // Prevent focus from shifting to the clicked element within the tutorial UI
    // if it's not a button or input (to avoid stealing focus from the game grid)
    if (e.type === 'mousedown' || e.type === 'touchstart' || e.type === 'touchmove') {
      const isInteractive = e.target.closest('button, input, select, textarea');
      if (!isInteractive) {
        e.preventDefault();
      }
    }
    return;
  }

  // Block everything else
  e.stopPropagation();
  e.preventDefault();
};

const handleShowVerifyTick = (e) => {
  // Show verify tick if this is a verify action
  if (!isSilverRingAction(currentStep.value?.action?.targetId) || currentStep.value?.action?.targetId !== 'margana-anagram-verify-btn') return

  const {targetId} = e.detail || {}
  const el = targetId
      ? modalContainer.value?.querySelector('#' + targetId)
      : modalContainer.value?.querySelector('#margana-anagram-verify-btn')

  if (el && modalContainer.value) {
    const rect = el.getBoundingClientRect()
    const containerRect = modalContainer.value.getBoundingClientRect()

    // Position matching AnagramBuilder.vue: 
    // center is 8px (right-2) inside from the right edge, and exactly on the bottom edge.
    verifyTickStyle.value = {
      left: `${rect.right - 8 - containerRect.left}px`,
      top: `${rect.bottom - containerRect.top}px`,
      transform: 'translate(-50%, -50%)'
    }

    showVerifyTick.value = true
    setTimeout(() => {
      showVerifyTick.value = false
    }, 2000)
  }
}

watch(isTutorialActive, (active) => {
  const events = ['mousedown', 'click', 'touchstart', 'touchmove', 'keydown'];
  const options = { capture: true, passive: false };
  if (active) {
    events.forEach(type => window.addEventListener(type, handleInteraction, options));
    window.addEventListener('tutorial-show-verify-tick', handleShowVerifyTick);
  } else {
    events.forEach(type => window.removeEventListener(type, handleInteraction, options));
    window.removeEventListener('tutorial-show-verify-tick', handleShowVerifyTick);
    hasStartedPlayback.value = false
  }
}, {immediate: true});

onBeforeUnmount(() => {
  isPlaying.value = false
  const events = ['mousedown', 'click', 'touchstart', 'touchmove', 'keydown'];
  const options = { capture: true, passive: false };
  events.forEach(type => window.removeEventListener(type, handleInteraction, options));
  window.removeEventListener('tutorial-show-verify-tick', handleShowVerifyTick);
});

</script>

<template>
  <Teleport to="body">
    <div v-if="isTutorialActive"
         class="tutorial-overlay fixed inset-0 z-[100] flex items-center justify-center px-6 py-4 sm:p-4 overscroll-none">
      <!-- Blurred Backdrop -->
      <div class="absolute inset-0 bg-black/40 backdrop-blur-md" @click="stopTutorial"></div>

      <div class="relative w-[92%] sm:w-full" style="max-width: calc(var(--margana-play-max) + 2rem)">
        <!-- Margana Logo (Half in, half out) -->
        <img
            :src="marganaLogoM"
            alt="Margana"
            class="absolute top-0 -left-8 w-auto z-[110] drop-shadow-2xl select-none pointer-events-none"
            style="height: var(--margana-navbar-logo-h); transform: translate(calc(var(--margana-navbar-logo-x) * -1.2), -40%)"
        />

        <div ref="modalContainer"
             class="relative w-full bg-gradient-to-br from-gray-900 via-purple-900 to-indigo-900 rounded-3xl shadow-2xl overflow-hidden border flex flex-col h-fit margana-proportions"
             style="max-height: min(90vh, 46rem)"
             :style="localMasterUnitStyle">

          <div
              class="bg-white/5 border-t border-white/10 p-2 sm:p-4 text-white backdrop-blur-md"
              @mousedown.stop
              @click.stop
              @touchstart.stop
              @touchmove.stop
          >
            <div class="relative flex flex-row items-center justify-center gap-2">
              <!-- Playback Controls (Centered) -->
              <button
                  @click="handlePlay"
                  @mousedown.prevent
                  :disabled="isPlaying || isButtonLocked"
                  :aria-label="isAtEnd ? 'Restart' : 'Play'"
                  class="flex items-center min-w-[80px] sm:min-w-[90px] gap-1.5 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-600 to-violet-700 hover:from-indigo-400 hover:via-purple-500 hover:to-violet-600 text-white font-bold transition transform active:scale-95 shadow-lg justify-center disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 disabled:pointer-events-none"
                  style="padding: var(--margana-btn-py) var(--margana-btn-px); font-size: var(--margana-btn-font-size)"
                  :class="{ 'pointer-events-none': isPlaying || isButtonLocked }"
              >
                <PlayIcon class="w-4 h-4 sm:w-5 sm:h-5"/>
                <span class="text-sm sm:text-sm">{{
                    (isPlaying || isButtonLocked) ? 'Playing' : (isAtEnd ? 'Play' : (currentStepIndex > 0 ? 'Next' : 'Play'))
                  }}</span>
              </button>
              <button
                  @click="handleReplay"
                  @mousedown.prevent
                  :disabled="isPlaying || isButtonLocked || !stepCompleted"
                  aria-label="Replay step"
                  class="p-1.5 rounded-full bg-white/10 text-white/80 enabled:hover:bg-white/20 transition-colors disabled:opacity-50"
                  style="width: calc(var(--margana-btn-py) * 2 + 1.25rem); height: calc(var(--margana-btn-py) * 2 + 1.25rem); display: flex; align-items: center; justify-content: center;"
                  title="Replay step"
                  v-if="showReplayButton"
              >
                <svg
                    class="w-5 h-5"
                    :class="{ 'animate-spin-reverse': isReplaying }"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
              </button>


            </div>
          </div>
          <!-- Progress Bar -->
          <div v-if="logicalStepsIndices.length > 1 && !currentStep?.component" class="flex justify-start gap-1.5 pl-6 sm:pl-10 pt-2 mb-1 sm:mb-1 flex-wrap">
            <div
                v-for="(logicalIdx, idx) in logicalStepsIndices"
                :key="idx"
                class="rounded-full flex items-center justify-center text-[8px] sm:text-[10px] font-bold transition-all duration-300 select-none"
                style="width: var(--margana-tutorial-dot-size); height: var(--margana-tutorial-dot-size)"
                :class="idx === currentLogicalStepIndex
                        ? 'bg-[linear-gradient(45deg,rgb(35,141,132)_10%,rgb(250,204,21)_90%)] text-white shadow-lg scale-110'
                        : (idx < currentLogicalStepIndex ? 'bg-purple-500/40 text-white/70' : 'bg-purple-500/20 text-white/40')"
            >
              {{ idx + 1 }}
            </div>
          </div>
          <!-- Header with Dynamic Instructions -->
          <div
              v-if="!currentStep?.hideDescription"
              class="px-6 sm:px-10 flex flex-col items-center justify-center"
              style="min-height: var(--margana-tutorial-header-min-h)"
          >

            <transition name="fade-slide" mode="out-in">
              <div :key="activeDescriptionIndex" class="text-center">
                <h2 v-if="activeDescriptionIndex <= 0" class="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  Welcome to your tutorial
                </h2>
                <div v-else class="bg-white/10 backdrop-blur-md rounded-2xl p-3 sm:p-4 border border-white/10 shadow-xl max-w-[30rem]">
                  <p
                      class="text-sm sm:text-base text-white leading-relaxed"
                      v-html="displayDescription"
                  ></p>
                </div>
              </div>
            </transition>
          </div>

          <!-- Close Button (Top Right) -->
          <button
              @click="stopTutorial"
              class="absolute top-2 right-4 sm:top-4 sm:right-4 z-[110] rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-all backdrop-blur-sm border border-white/10 group flex items-center justify-center"
              aria-label="Close tutorial"
              style="width: var(--margana-tutorial-close-size); height: var(--margana-tutorial-close-size)"
          >
            <XMarkIcon 
              class="transition-transform duration-300"
              style="width: var(--margana-tutorial-close-icon-size); height: var(--margana-tutorial-close-icon-size)"
            />
          </button>

          <!-- Green Verify Tick -->
          <div
              v-if="showVerifyTick"
              class="pointer-events-none absolute z-[102] rounded-full shadow-md
                     flex items-center justify-center font-bold text-white
                     bg-[linear-gradient(45deg,rgb(35,141,132)_10%,rgb(250,204,21)_90%)]"
              style="width: var(--margana-tutorial-tick-size); height: var(--margana-tutorial-tick-size); font-size: var(--margana-tutorial-tick-font-size)"
              :style="verifyTickStyle"
              aria-hidden="true"
          >
            ✓
          </div>

          <div class="tutorial-content flex-1 overflow-y-auto overscroll-none p-1 flex flex-col items-center"
               @mousedown.stop
               @click.stop
               @touchstart.stop
               @touchmove.stop>
            <div class="w-full flex flex-col items-center origin-top">
              <component
                  v-if="currentStep?.component"
                  :is="tutorialComponents[currentStep.component]"
              />
              <slot v-else></slot>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
@keyframes spin-reverse {
  to {
    transform: rotate(-360deg);
  }
}

.animate-spin-reverse {
  animation: spin-reverse 1s linear infinite;
}
</style>
