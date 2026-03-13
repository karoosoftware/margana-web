<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useMarganaAuth, UserTier } from '@/composables/useMarganaAuth'
import { useGameState } from '@/composables/useGameState'
import { useMarganaGame } from '@/composables/useMarganaGame'
import { useGameFlow } from '@/composables/useGameFlow'
import { useUsageAggregators } from '@/composables/useUsageAggregators'
import { useLetterScores } from '@/composables/useLetterScores'
import { useUserSettings } from '@/composables/useUserSettings'
import { useOrientation } from '@/composables/useOrientation'
import { useAdManager } from '@/composables/useAdManager'
import { useTutorial } from '@/composables/useTutorial'
import { useYesterdayReminder } from '@/composables/useYesterdayReminder'
import { computeHighlightFromItem } from '@/utils/highlightUtils'
import { dispatchUsage } from '@/utils/usageUtils'


// Components
import GameView from '@/components/margana/GameView.vue'
import PostGameView from '@/components/margana/PostGameView.vue'
import PerformanceView from '@/components/margana/PerformanceView.vue'
import GuestTermsModal from '@/components/margana/GuestTermsModal.vue'
import AccountBenefitsModal from '@/components/margana/AccountBenefitsModal.vue'
import LetterScoresView from '@/components/LetterScores.vue'
import MadnessBanner from '@/components/margana/MadnessBanner.vue'
import MadnessOverlay from '@/components/overlays/MadnessOverlay.vue'
import CoachController from '@/components/margana/CoachController.vue'
import { cache, CacheType } from '@/utils/cache'

const router = useRouter()
const route = useRoute()

// --- Core State & Services ---
const { userSub, guestId, isAuthenticated, authInitialized, needsTermsAcceptance, userTier } = useMarganaAuth()
const { 
  enableLiveScoring, 
  enableWildcardBypass, 
  showPulseLabels, 
  showAnagramPopup,
  showTutorialButton
} = useUserSettings()
const { landscapeMobileMode } = useOrientation()
const { 
  puzzle, 
  puzzleDateStr, 
  loadPuzzle, 
  loadPuzzleState, 
  savePuzzleState, 
  cleanupOldDrafts,
  error: stateError
} = useGameState()
const { letterScores, loadLetterScores } = useLetterScores()
const { typingAgg, highlightAgg, shuffleAgg } = useUsageAggregators()
const { hasSeenTutorial, isTutorialActive } = useTutorial()
const { showYesterdayReminder, dismissYesterdayReminder, initYesterdayReminder } = useYesterdayReminder()
const adManager = useAdManager()

// --- Page Shell State ---
const showAccountBenefits = ref(false)
const showLetterScores = ref(false)
const coach = ref(null)
const showCoachMessage = ref(false)

// --- Game Session ---
const session = useMarganaGame(puzzle, {
  puzzleDateStr,
  isAuthenticated,
  guestId,
  adManager,
  typingAgg,
  highlightAgg,
  shuffleAgg,
  settings: {
    enableWildcardBypass,
    enableLiveScoring,
    showPulseLabels,
    showAnagramPopup
  },
  loadPuzzleState,
  savePuzzleState,
  computeHighlightFromItem,
  dispatchUsage: (name, data) => dispatchUsageLocal(name, data),
  callLiveScoring: (opts) => {
    if (showYesterdayReminder.value) dismissYesterdayReminder()
    return flow.callLiveScoring(opts)
  }
})

const { 
  result, 
  canSubmit, 
  posting, 
  showStatistics,
  score,
  highlightedCells,
  anagramHighlighted,
  pm,
  am,
  gm,
  im,
  baseGrid,
  endOfGame
} = session

const {
  editableGrid
} = gm

const {
  effectivePulseThemes,
  effectivePulseLabels
} = pm

const {
  isTargetCell,
  isVerticalTargetCell,
  isDiagonalCell
} = am

const gameView = ref(null)

// --- Flow Manager ---
const flow = useGameFlow(session, {
  puzzleDateStr,
  isAuthenticated,
  userSub,
  guestId,
  activeAnagramBuilder: computed(() => gameView.value?.anagramBuilder),
  loadPuzzle,
  loadLetterScores,
  buildEditableGrid: session.gm.buildEditableGrid,
  dispatchUsage: (name, data) => dispatchUsageLocal(name, data),
  hasSeenTutorial, 
  triggerTutorial,
  cleanupOldDrafts,
  showAccountBenefits, 
  needsTermsAcceptance,
  authInitialized,
  landscapeMobileMode,
  settingsEnableLiveScoring: enableLiveScoring,
  settingsEnableWildcardBypass: enableWildcardBypass,
  typingAgg,
  highlightAgg,
  shuffleAgg,
  loadPuzzleState
})

const { 
  error: flowError, 
  submit: submitGame, 
  hydrate: hydrateGame,
  newAchievements
} = flow

// --- Page Shell State ---

function checkShowBenefits() {
  if (isAuthenticated.value) return
  const seenHowToPlay = hasSeenTutorial() || localStorage.getItem('margana.howToPlaySeen') === 'true'
  if (!seenHowToPlay) return

  const today = new Date().toISOString().split('T')[0]
  const lastSeen = localStorage.getItem('margana-account-benefits-seen')

  if (lastSeen !== today) {
    setTimeout(() => {
      // Final check: still guest, not in tutorial, terms accepted, no madness overlay showing, and still on margana page
      if (!isAuthenticated.value && !needsTermsAcceptance.value && !showMadnessOverlay.value && route.name === 'margana' && !showAccountBenefits.value) {
        showAccountBenefits.value = true
      }
    }, 2000)
  }
}

function handleCloseAccountBenefits() {
  showAccountBenefits.value = false
  const today = new Date().toISOString().split('T')[0]
  localStorage.setItem('margana-account-benefits-seen', today)
}

function dispatchUsageLocal(name, data) {
  const base = {
    v: '3.0.0',
    ts: Date.now(),
    date: puzzleDateStr.value,
    u: userSub.value || guestId.value,
    auth: !!userSub.value
  }
  const full = { ...base, ...data }
  try {
    dispatchUsage(name, full)
  } catch (e) {}
}

const scoreFor = (letter) => letter ? (letterScores.value[letter] || 0) : ''

// --- Post-Game UI State ---
const selectedWordScore = ref(null)
const selectedWord = ref(null)
const scoreShare = ref(false)

const displayedValidWords = computed(() => {
  const base = Array.isArray(result.value?.valid_words_metadata) ? result.value.valid_words_metadata : []
  const seen = new Set()
  const out = []
  for (const item of base) {
    let w = String(item?.word || '').toLowerCase()
    if (!w) continue
    
    // Force madness words to be labeled as 'margana'
    if (item?.type === 'madness') w = 'margana'
    
    if (!seen.has(w)) {
      seen.add(w)
      out.push({ ...item, word: w })
    }
  }
  return out
})

function handlePostGameHighlight(item) {
  const set = computeHighlightFromItem(item, baseGrid.value, editableGrid.value, isTargetCell)
  if (set && set.size) {
    session.highlightedCells.value = set
    selectedWordScore.value = Number(item?.score)
    selectedWord.value = item?.word
  } else {
    handlePostGameClear()
  }
}

function handlePostGameClear() {
  session.highlightedCells.value = new Set()
  selectedWordScore.value = null
  selectedWord.value = null
}

function handleScoreShareClick() {
  scoreShare.value = true
}

function handleBackToPlay() {
  scoreShare.value = false
}
const madnessAvailable = computed(() => {
  return !!(puzzle.value?.madnessAvailable || puzzle.value?.meta?.madnessAvailable)
})

const madnessFound = computed(() => {
  return !!(result.value?.meta?.madnessFound)
})

const showMadnessOverlay = ref(false)

watch([madnessAvailable, puzzleDateStr, needsTermsAcceptance], ([avail, date, needsTerms]) => {
  if (avail && date && !needsTerms) {
    const cacheKey = `madness-overlay-seen-${date}`
    const seen = cache.get(cacheKey, CacheType.Persisted)
    if (!seen) {
      showMadnessOverlay.value = true
    }
  }
}, { immediate: true })

function handleCloseMadnessOverlay() {
  showMadnessOverlay.value = false
  if (puzzleDateStr.value) {
    const cacheKey = `madness-overlay-seen-${puzzleDateStr.value}`
    // Store seen state in persistence for 2 days to ensure it doesn't reappear on return visit
    cache.set(cacheKey, true, 86400 * 2, CacheType.Persisted)
  }

  // After madness is closed, check if we need to show benefits or tutorial
  const seen = hasSeenTutorial() || localStorage.getItem('margana.howToPlaySeen') === 'true'
  if (!seen) {
    setTimeout(() => {
      triggerTutorial()
    }, 1000)
  } else {
    checkShowBenefits()
    initYesterdayReminder(userSub.value, isAuthenticated.value, userTier.value, session.endOfGame)
  }
}

const loading = computed(() => !puzzle.value && !flowError.value && !stateError.value)

function triggerTutorial() {
  router.push('/tutorial')
}

function handleTriggerCoach() {
  if (coach.value) {
    coach.value.analyze()
    showCoachMessage.value = true
    if (showYesterdayReminder.value) dismissYesterdayReminder()

    const r = coach.value.currentRowIndex
    if (r !== null && r !== undefined) {
      const cols = baseGrid.value[r]?.length || 0
      for (let c = 0; c < cols; c++) {
        if (!am.isTargetCell(r, c) && !editableGrid.value[r][c]) {
          im.focusCell(r, c)
          break
        }
      }
    }
  }
}

// Watch for grid changes to hide coach message
watch(editableGrid, () => {
  if (showCoachMessage.value && coach.value) {
    const stage = coach.value.currentStage
    if (stage === 'ROW_INCOMPLETE' || stage === 'ANAGRAM_PROGRESS') {
      // These persist until their specific goals are met (valid row or valid anagram)
      return
    }
    
    // For other stages (like tactics), we hide on grid changes
    showCoachMessage.value = false
    coach.value.clear()
  }
}, { deep: true })

// Watch for row validity changes to hide coach message when a word is found
watch(() => gm.rowValid.value, () => {
  if (showCoachMessage.value && coach.value && coach.value.currentStage === 'ROW_INCOMPLETE') {
    const r = coach.value.currentRowIndex
    if (r !== null && r !== undefined) {
      const wildcardOk = enableWildcardBypass.value ? gm.rowHasWildcard(r) : false
      const ok = wildcardOk || !!gm.rowValid.value[r]
      if (ok) {
        showCoachMessage.value = false
        coach.value.clear()
      }
    }
  }
}, { deep: true })

watch(am.builderWord, () => {
  if (showCoachMessage.value && coach.value) {
    const stage = coach.value.currentStage
    if (stage === 'ANAGRAM_PROGRESS') {
      // Persist until a valid anagram is found (handled by anagramVerifiedPoints watcher)
      return
    }

    if (stage !== 'ROW_INCOMPLETE') {
      // For other stages (like tactics), we hide on anagram changes
      showCoachMessage.value = false
      coach.value.clear()
    }
  }
})

// Watch for anagram verification to hide coach message
watch(() => am.anagramVerifiedPoints.value, (newVal) => {
  if (showCoachMessage.value && coach.value && coach.value.currentStage === 'ANAGRAM_PROGRESS') {
    if (newVal > 0) {
      showCoachMessage.value = false
      coach.value.clear()
    }
  }
})

// Lifecycle
onMounted(() => {
  hydrateGame()

  const seen = hasSeenTutorial() || localStorage.getItem('margana.howToPlaySeen') === 'true'
  
  if (!seen && !needsTermsAcceptance.value && !showMadnessOverlay.value) {
    setTimeout(() => {
      triggerTutorial()
    }, 1000)
  } else if (seen && !showMadnessOverlay.value) {
    checkShowBenefits()
    initYesterdayReminder(userSub.value, isAuthenticated.value, userTier.value, session.endOfGame)
  }
})

// Trigger tutorial after terms are accepted if not already seen
watch(needsTermsAcceptance, (val) => {
  if (!val && !showMadnessOverlay.value) {
    const seen = hasSeenTutorial() || localStorage.getItem('margana.howToPlaySeen') === 'true'
    if (!seen) {
      setTimeout(() => {
        triggerTutorial()
      }, 1000)
    } else {
      checkShowBenefits()
      initYesterdayReminder(userSub.value, isAuthenticated.value, userTier.value, session.endOfGame)
    }
  }
})

</script>

<template>
  <div class="relative flex-1 flex flex-col items-center">
    <main class="w-full max-w-7xl mx-auto px-1 sm:px-4 lg:px-6 py-1 flex flex-col items-center">
      <h1 class="sr-only">Margana: The Tactical Word Game</h1>

      <div v-if="flowError || stateError" class="text-red-600 p-4 bg-red-50 rounded-lg mt-8">
        {{ flowError || stateError }}
      </div>

      <div v-else-if="loading" class="flex flex-col items-center mt-12 space-y-6">
        <div class="dots-loader" role="img" aria-label="Loading">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>
      </div>

      <template v-else>
        <div v-if="!result" class="w-full flex flex-col items-center">
          <MadnessBanner
            :madnessFound="madnessFound"
            :madnessAvailable="madnessAvailable"
            :endOfGame="false"
          />
          <CoachController :session="session" ref="coach" />
          <GameView
            ref="gameView"
            :session="session"
            :readonly="needsTermsAcceptance"
            :isTutorial="isTutorialActive"
            :settings="{
              enableLiveScoring,
              enableWildcardBypass,
              showPulseLabels,
              showAnagramPopup
            }"
            :score-for="scoreFor"
            :landscape="landscapeMobileMode"
            v-model:showLetterScores="showLetterScores"
            :showTutorialButton="showTutorialButton"
            :coachRow="coach?.currentRowIndex"
            :coachStage="showCoachMessage ? coach?.currentStage : null"
            @trigger-tutorial="triggerTutorial"
            @trigger-coach="handleTriggerCoach"
          >
            <template #top-banner v-if="showYesterdayReminder || (showCoachMessage && coach?.currentMessage)">
              <div v-if="showCoachMessage && coach?.currentMessage"
                   class="w-full px-4 py-3 backdrop-blur-md rounded-2xl bg-white/10 text-white flex flex-col items-center gap-2 text-xs sm:text-sm animate-fade-in border border-white/20">
                <div class="text-left font-normal text-sm sm:text-base">
                  {{ coach.currentMessage }}
                </div>
                <div class="w-full flex justify-end gap-6">
                  <button @click="coach.nextMessage()" class="text-white/60 hover:text-white transition-colors text-sm sm:text-xs">
                    Next ({{ coach.currentMessageIndex + 1 }}/{{ coach.totalMessages }})
                  </button>
                  <button @click="showCoachMessage = false; coach.clear()" class="text-white/60 hover:text-white transition-colors text-sm sm:text-xs">
                    Close
                  </button>
                </div>
              </div>

              <router-link
                  v-else-if="showYesterdayReminder"
                  :to="{ name: 'yesterday' }"
                  @click="dismissYesterdayReminder"
                  class="w-full px-2 py-3 backdrop-blur-md rounded-2xl text-white transition-all duration-200 ease-out flex items-center justify-between gap-3 text-xs sm:text-sm font-semibold animate-fade-in"
              >
                <div class="flex flex-col flex-1 min-w-0 text-sm sm:text-base items-center font-normal">
                  <span>Yesterday's score comparison with Margana</span>
                </div>

                <div
                    class="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[linear-gradient(45deg,rgb(35,141,132)_10%,rgb(250,204,21)_90%)] flex items-center justify-center shadow-md">
                  <svg class="w-3 h-3 sm:w-5 sm:h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M9 5l7 7-7 7"/>
                  </svg>
                </div>
              </router-link>
            </template>

            <template #right-controls="{ controlsBtnSizeClass }">
              <div v-if="!landscapeMobileMode" class="flex items-center space-x-2">
                <div v-if="posting" class="flex items-center justify-center">
                  <span class="dots-loader" role="img" aria-label="Loading">
                    <span class="dot"></span>
                    <span class="dot"></span>
                    <span class="dot"></span>
                  </span>
                </div>
                <button
                  v-else
                  @click="submitGame"
                  :disabled="!canSubmit || posting"
                  class="btn-common-button controls-btn"
                  :class="controlsBtnSizeClass"
                >
                  Submit
                </button>
              </div>
            </template>
          </GameView>
        </div>

        <div v-else class="w-full space-y-8 animate-fade-in max-w-4xl">
          <!-- Show performance metrics first if stats are active -->
          <PerformanceView
            v-if="showStatistics"
            :newAchievements="newAchievements"
            @see-results="showStatistics = false"
          />

          <!-- Show the detailed post-game grid view once "See results" is clicked -->
          <PostGameView
              v-else
              :marganaResult="result"
              :scoreShare="scoreShare"
              :baseGrid="baseGrid"
              :editableGrid="editableGrid"
              :highlightedCells="highlightedCells"
              :effectivePulseThemes="effectivePulseThemes"
              :effectivePulseLabels="effectivePulseLabels"
              :scoreFor="scoreFor"
              :isTargetCell="isTargetCell"
              :isVerticalTargetCell="isVerticalTargetCell"
              :isDiagonalCell="isDiagonalCell"
              :settingsShowPulseLabels="showPulseLabels"
              :settingsEnableWildcardBypass="enableWildcardBypass"
              :anagramHighlighted="anagramHighlighted"
              :displayedValidWords="displayedValidWords"
              :totalValidScore="score"
              :selectedWord="selectedWord"
              :selectedWordScore="selectedWordScore"
              :marganaError="flowError"
              @highlight="handlePostGameHighlight"
              @clear="handlePostGameClear"
              @score-share-click="handleScoreShareClick"
              @back-to-play="handleBackToPlay"
          />
        </div>
      </template>
    </main>

    <!-- Modals -->
    <GuestTermsModal v-if="needsTermsAcceptance" />
    <AccountBenefitsModal 
      :show="showAccountBenefits" 
      :landscapeMobileMode="landscapeMobileMode"
      @close="handleCloseAccountBenefits" 
    />
    <LetterScoresView v-model:showLetterScores="showLetterScores" />
    <MadnessOverlay
      :show="showMadnessOverlay"
      @close="handleCloseMadnessOverlay"
    />
  </div>
</template>

<style scoped>

.animate-fade-in {
  animation: fadeIn 0.4s ease-out forwards;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
