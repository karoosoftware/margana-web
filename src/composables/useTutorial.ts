import { ref, computed } from 'vue'

export interface TutorialStep {
  step: number
  description: string
  component?: string       // To load a specific Vue component
  hideDescription?: boolean // To hide the header/description area
  action?: {
    type: 'MOVE_LETTER' | 'TYPE_ANAGRAM' | 'CLICK' | 'HOVER'
    from?: string
    to?: string
    value?: any
    targetId?: string // For generic clicks/hovers
    x?: number
    y?: number
  }
  response?: any // Mocked API response
  autoAdvance?: boolean
  delay?: number
  continueDescription?: boolean
}

const isTutorialActive = ref(false)
const currentStepIndex = ref(-1)
const tutorialSteps = ref<TutorialStep[]>([])
const isPlaying = ref(false)
const isAutoPlay = ref(true)

export function useTutorial() {
  function startTutorial(steps: TutorialStep[]) {
    tutorialSteps.value = steps
    currentStepIndex.value = 0
    isTutorialActive.value = true
    isPlaying.value = false
    isAutoPlay.value = false
  }

  function stopTutorial() {
    isTutorialActive.value = false
    currentStepIndex.value = -1
    isPlaying.value = false
    isAutoPlay.value = false
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('margana-tutorial-seen', '1')
      }
    } catch (_) {
      // Ignore
    }
  }

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
      isPlaying.value = false
    }
  }

  function restartTutorial() {
    currentStepIndex.value = 0
    isPlaying.value = true
  }

  function prevStep() {
    if (currentStepIndex.value > 0) {
      currentStepIndex.value--
    }
  }

  function togglePlay() {
    isPlaying.value = !isPlaying.value
  }

  const hasSeenTutorial = () => {
    try {
      if (typeof localStorage === 'undefined') return false
      return localStorage.getItem('margana-tutorial-seen') === '1'
    } catch (_) {
      return false
    }
  }

  return {
    isTutorialActive,
    currentStepIndex,
    tutorialSteps,
    currentStep,
    isPlaying,
    isAutoPlay,
    startTutorial,
    stopTutorial,
    nextStep,
    prevStep,
    togglePlay,
    restartTutorial,
    hasSeenTutorial
  }
}
