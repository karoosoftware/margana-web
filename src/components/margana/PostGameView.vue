<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ShareIcon, ChartBarIcon } from '@heroicons/vue/20/solid'
import AppCard from '../AppCard.vue'
import GridBoard from '../GridBoard.vue'
import ValidWordsPanel from '../ValidWordsPanel.vue'
import ScoreShare from '../ScoreShare.vue'
import MadnessBanner from './MadnessBanner.vue'
import {useMarganaAuth, UserTier} from "@/composables/useMarganaAuth.ts";

const props = defineProps({
  marganaResult: { type: Object, default: null },
  userLabel: { type: String, default: '' },
  scoreShare: { type: Boolean, default: false },
  baseGrid: { type: Array, default: () => [] },
  editableGrid: { type: Array, default: () => [] },
  highlightedCells: { type: Object, default: () => new Set() },
  effectivePulseThemes: { type: Object, default: () => new Map() },
  effectivePulseLabels: { type: Object, default: () => new Map() },
  settingsShowPulseLabels: { type: Boolean, default: true },
  scoreFor: { type: Function, required: true },
  isTargetCell: { type: Function, required: true },
  isVerticalTargetCell: { type: Function, required: true },
  isDiagonalCell: { type: Function, required: true },
  settingsEnableWildcardBypass: { type: Boolean, default: false },
  displayedValidWords: { type: Array, default: () => [] },
  selectedWord: { type: String, default: null },
  selectedWordScore: { type: Number, default: null },
  totalValidScore: { type: Number, default: 0 },
  marganaError: { type: String, default: '' },
  anagramHighlighted: { type: Boolean, default: false },
  showShare: { type: Boolean, default: true },
  showPerformance: { type: Boolean, default: true },
  showMadnessBanner: { type: Boolean, default: true },
  widthClass: { type: String, default: 'w-[350px] md:w-[400px] sm:w-[450px]' }
})

const router = useRouter()
const emit = defineEmits(['score-share-click', 'back-to-play', 'highlight', 'clear'])

const staticAnagram = computed(() => {
  try {
    const m = props.marganaResult || {}
    let ua = ''
    try {
      ua = (m?.meta?.userAnagram || m?.meta?.longestAnagram || m?.longest_anagram || '').toString().toUpperCase().trim()
    } catch (_) {}

    if (!ua && Array.isArray(m?.valid_words_metadata)) {
      try {
        const it = m.valid_words_metadata.find(x => x && (x.type === 'anagram' || x.type === 'longest_anagram') && x.word)
        if (it && it.word) ua = String(it.word).toUpperCase().trim()
      } catch (_) {}
    }
    return ua || ''
  } catch (_) {
    return ''
  }
})

const skippedRows = computed(() => {
  if (props.marganaResult && (props.marganaResult.skippedRows || props.marganaResult.meta?.skippedRows)) {
    return props.marganaResult.skippedRows || props.marganaResult.meta?.skippedRows
  }
  return []
})

function goToScoreShare() {
  emit('score-share-click')
}

function handleHighlight(item) {
  emit('highlight', item)
}

function handleClear() {
  emit('clear')
}

const {userTier} = useMarganaAuth()
const isGuest = computed(() => userTier.value === UserTier.GUEST)
const cardTitle = computed(() => {
  if (isGuest.value) return 'Guest'
  return props.userLabel || 'You'
})

const displayScore = computed(() => {
  // If we have an official result from the server/S3, always use it.
  if (props.marganaResult) {
    return props.marganaResult.total_score || props.marganaResult.totalScore || 0
  }
  // Fallback to local score only if no server result exists yet.
  return props.totalValidScore || 0
})

const madnessAvailable = computed(() => {
  return !!(props.marganaResult?.meta?.madnessAvailable || props.marganaResult?.madnessAvailable)
})

const madnessFound = computed(() => {
  return !!(props.marganaResult?.meta?.madnessFound)
})

</script>

<template>
  <div v-if="!scoreShare" :class="[widthClass, 'margana-postgame-view max-w-4xl mx-auto px-1 sm:px-4']">

    <MadnessBanner
      v-if="showMadnessBanner"
      :madnessFound="madnessFound"
      :madnessAvailable="madnessAvailable"
      :endOfGame="true"
    />

    <AppCard :title="cardTitle">
      <div
          class="mb-2 text-center text-3xl sm:text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-tr from-purple-500 to-orange-500 select-none"
      >
        {{ displayScore }}
      </div>


      <div :style="{
        maxWidth: '100%',
        '--margana-grid-font-size': 'var(--margana-postgame-grid-font-size)',
        '--margana-grid-score-font-size': 'var(--margana-postgame-grid-score-font-size)',
        '--margana-tile-w-md': 'var(--margana-postgame-grid-tile-w)',
        '--margana-tile-h-md': 'var(--margana-postgame-grid-tile-h)',
      }" class="w-full min-w-0 mb-1">
        <!-- Completed grid -->
        <GridBoard
          v-if="baseGrid.length && editableGrid.length"
          :baseGrid="baseGrid"
          :editableGrid="editableGrid"
          :endOfGame="true"
          :shakeRow="null"
          :errorRow="null"
          :highlightedCells="highlightedCells"
          :pulseThemes="effectivePulseThemes"
          :pulseLabels="effectivePulseLabels"
          :showPulseLabels="settingsShowPulseLabels"
          :scoreFor="scoreFor"
          :isTargetCell="isTargetCell"
          :isVerticalTargetCell="isVerticalTargetCell"
          :isDiagonalCell="isDiagonalCell"
          :wildcardBypassEnabled="settingsEnableWildcardBypass"
          :skippedRows="skippedRows"
          :setGridContainer="() => {}"
          :setInputRef="() => {}"
          :size="'medium'"
        />

        <!-- Static anagram display -->
        <div v-if="staticAnagram && staticAnagram.length" class="mt-1 sm:mt-2">
          <div class="flex gap-1 sm:gap-1 justify-center static-anagram" :style="{
            '--margana-anagram-w-sm': 'var(--margana-postgame-anagram-w)',
            '--margana-anagram-h-sm': 'var(--margana-postgame-anagram-h)',
            '--margana-anagram-font-size': 'var(--margana-postgame-anagram-font-size)',
            '--margana-anagram-score-font-size': 'var(--margana-postgame-anagram-score-font-size)',
          }">
            <div v-for="(L, idx) in Array.from(staticAnagram)" :key="'m-static-anagram-'+idx"
                 class="relative margana-anagram-tile margana-anagram-tile-small flex items-center justify-center bg-gradient-to-tr from-purple-600 to-orange-600 text-white tracking-widest shadow select-none pb-1"
                 :class="[ anagramHighlighted ? 'ring-1 ring-indigo-100 ring-offset-2 ring-offset-transparent' : '' ]">
              <span class="pointer-events-none">{{ L }}</span>
              <span class="score-badge pointer-events-none absolute bottom-0.5 right-0.5 font-semibold opacity-90 z-10">{{ scoreFor(L) }}</span>
            </div>
          </div>
        </div>

        <!-- Results panel -->
        <div class="mt-1 sm:mt-1 text-white/80 text-sm space-y-1 text-center w-full max-w-full overflow-x-auto overflow-y-hidden">
          <div v-if="marganaError" class="text-red-300 text-xs">Margana error: {{ marganaError }}</div>
          <ValidWordsPanel
            v-if="marganaResult && displayedValidWords && displayedValidWords.length"
            :items="displayedValidWords"
            :interactive="true"
            :selectedWord="selectedWord"
            :selectedWordScore="selectedWordScore"
            :totalValidScore="displayScore"
            @highlight="handleHighlight"
            @clear="handleClear"
          />

          <!-- Share buttons -->
          <div v-if="showShare || showPerformance" class="mt-6 mb-2 flex justify-center gap-3">
            <button
              v-if="showShare"
              class="btn-common-button"
              @click="goToScoreShare"
            >
              <span>Share</span>
            </button>

            <button
              v-if="showPerformance"
              class="btn-common-button"
              @click="router.push('/metric')"
            >
              <span>Performance</span>
            </button>
          </div>
        </div>
      </div>
    </AppCard>
  </div>

  <!-- Embedded score share view -->
  <div v-else class="w-full max-w-5xl mx-auto px-1 sm:px-4">
    <ScoreShare
      :margana-result="marganaResult"
      :preloadOnMount="false"
      @back-to-play="emit('back-to-play')" />
  </div>
</template>

<style scoped>
</style>
