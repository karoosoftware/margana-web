<script setup>
/**
 * YesterdayPage.vue
 * Show both the official completed Margana and the user's own results for yesterday
 * so the user can compare. Stacks on small screens (official on top, then user),
 * side-by-side on larger screens.
 */
import { ref, computed, nextTick, watch } from 'vue'
import { useMarganaAuth } from '@/composables/useMarganaAuth'
import {
  getYesterdayDateISO,
  fetchOfficialPuzzle,
  fetchUserResults
} from '@/services/puzzleResultsService'
import { findHighlightForWord, computeHighlightFromItem } from '../utils/highlightUtils.js'
import { Bucket } from '../config/api.js'
import AppBrand from '../components/AppBrand.vue'
import PostGameView from '../components/margana/PostGameView.vue'

// Lightweight helper to dispatch usage events app-wide
function dispatchUsage(name, data) {
  try { window.dispatchEvent(new CustomEvent('margana-usage', { detail: { name, data } })) } catch (_) {}
}

const loading = ref(true)
const error = ref(null)

// Official completed payload
const puzzle = ref(null)

// User results payload (may be absent)
const userResult = ref(null)

// Build letter score maps from payload (valid_words_metadata[].letter_value)
const officialLetterScores = computed(() => {
  const map = {}
  try {
    const items = Array.isArray(puzzle.value?.valid_words_metadata) ? puzzle.value.valid_words_metadata : []
    for (const it of items) {
      const lv = it && it.letter_value
      if (lv && typeof lv === 'object') {
        for (const [k, v] of Object.entries(lv)) {
          const L = String(k || '').toUpperCase()
          const num = typeof v === 'number' ? v : Number(v)
          if (L && Number.isFinite(num)) map[L] = num
        }
      }
    }
  } catch (_) {}
  return map
})
const userLetterScores = computed(() => {
  const map = {}
  try {
    const items = Array.isArray(userResult.value?.valid_words_metadata) ? userResult.value.valid_words_metadata : []
    for (const it of items) {
      const lv = it && it.letter_value
      if (lv && typeof lv === 'object') {
        for (const [k, v] of Object.entries(lv)) {
          const L = String(k || '').toUpperCase()
          const num = typeof v === 'number' ? v : Number(v)
          if (L && Number.isFinite(num)) map[L] = num
        }
      }
    }
  } catch (_) {}
  return map
})
const officialHasLetterValues = computed(() => Object.keys(officialLetterScores.value || {}).length > 0)
const userHasLetterValues = computed(() => Object.keys(userLetterScores.value || {}).length > 0)

function scoreForOfficial(ch) {
  if (!ch || !officialHasLetterValues.value) return ''
  const L = String(ch).toUpperCase()
  const v = officialLetterScores.value?.[L]
  return typeof v === 'number' ? v : ''
}
function scoreForUser(ch) {
  if (!ch || !userHasLetterValues.value) return ''
  const L = String(ch).toUpperCase()
  const v = userLetterScores.value?.[L]
  return typeof v === 'number' ? v : ''
}

// Base grid derived from official puzzle rows
const baseGrid = computed(() => {
  if (!puzzle.value?.grid_rows) return []
  return puzzle.value.grid_rows.map(row => row.split('').map(ch => ch.toUpperCase()))
})

// Helpers to know target positions
const isMainDiagonal = computed(() => {
  const dir = puzzle.value?.meta?.diagonalDirection || puzzle.value?.diagonal_direction || 'main'
  return dir === 'main'
})
const colIndex = computed(() => {
  const ci = puzzle.value?.meta?.columnIndex
  return Number(ci ?? puzzle.value?.column_index ?? -1)
})
function isDiagonalCell(r, c) {
  const n = baseGrid.value.length
  if (!n) return false
  return isMainDiagonal.value ? (r === c) : (c === (n - 1 - r))
}
function isVerticalTargetCell(r, c) { return c === colIndex.value }
function isTargetCell(r, c) { return isVerticalTargetCell(r, c) || isDiagonalCell(r, c) }

// Official editable grid (completed)
const editableGrid = ref([])
function buildEditableGrid() {
  const src = baseGrid.value
  editableGrid.value = src.map(row => row.slice())
}

// User editable grid (completed)
const userEditableGrid = ref([])
function buildUserEditableGrid() {
  const src = baseGrid.value
  userEditableGrid.value = src.map(row => row.slice())
}

// Populate a destination grid from a variety of potential result shapes
function applySolvedToGrid(res, destGrid) {
  try {
    if (!res || !Array.isArray(destGrid.value)) return
    // New schema only: derive from row_summaries, then apply skippedRows
    const rowsCount = Array.isArray(destGrid.value) ? destGrid.value.length : 0
    const byIndex = {}
    const arr = Array.isArray(res?.row_summaries) ? res.row_summaries : []
    for (const s of arr) {
      if (s && typeof s.row === 'number' && typeof s.word === 'string') byIndex[s.row] = s.word
    }
    for (let r = 0; r < rowsCount; r++) {
      const w = (byIndex[r] || '').toString().toUpperCase()
      const cols = destGrid.value?.[r]?.length || 0
      for (let c = 0; c < cols; c++) {
        if (!isTargetCell(r, c)) {
          const L = w[c] || ''
          if (L && L !== '*') destGrid.value[r][c] = L
        }
      }
    }
    const raw = Array.isArray(res?.meta?.skippedRows) ? res.meta.skippedRows : (Array.isArray(res?.skippedRows) ? res.skippedRows : [])
    const skipped = Array.from(new Set((raw || []).map(n => Number(n)).filter(n => Number.isFinite(n) && n >= 0 && n < rowsCount))).sort((a,b)=>a-b)
    if (skipped.length) {
      for (const r of skipped) {
        const cols = destGrid.value?.[r]?.length || 0
        for (let c = 0; c < cols; c++) {
          if (!isTargetCell(r, c)) destGrid.value[r][c] = '*'
        }
      }
    }
  } catch (_) { /* ignore */ }
}

// Valid words and scoring — official
const marganaResult = ref(null)
const displayedValidWords = computed(() => {
  const base = Array.isArray(marganaResult.value?.valid_words_metadata) ? marganaResult.value.valid_words_metadata : []
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
  // Ensure the top anagram appears as a found word entry
  const ta = String(topAnagram.value || '')
  if (ta) {
    const taLower = ta.toLowerCase()
    if (!seen.has(taLower)) {
      out.push({ word: taLower, type: 'anagram', index: 0, direction: 'builder' })
      seen.add(taLower)
    }
  }
  // Inject Margana Madness entry for official panel if available
  try {
    const m = puzzle.value?.meta || {}
    if (m && m.madnessAvailable) {
      const mw = String(m.madnessWord || '').trim()
      if (mw) {
        const label = 'margana'
        if (!seen.has(label)) {
          const coords = Array.isArray(m.madnessPath) ? m.madnessPath : []
          out.push({ word: label, type: 'madness', index: 0, direction: String(m.madnessDirection || 'forward'), score: 0, base_score: 0, bonus: 0, coords })
          seen.add(label)
        }
      }
    }
  } catch (_) { /* ignore */ }
  return out
})
const totalValidScore = computed(() => {
  const payloadTotal = Number(puzzle.value?.total_score)
  if (!Number.isNaN(payloadTotal) && payloadTotal > 0) return payloadTotal
  let sum = 0
  for (const it of displayedValidWords.value) sum += (typeof it?.score === 'number' ? it.score : 0)
  return sum
})

// Valid words and scoring — user
const userDisplayedValidWords = computed(() => {
  const base = Array.isArray(userResult.value?.valid_words_metadata) ? userResult.value.valid_words_metadata : []
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
  // Ensure the user's anagram appears
  const ua = String(userTopAnagram.value || '')
  if (ua) {
    const lower = ua.toLowerCase()
    if (!seen.has(lower)) { out.push({ word: lower, type: 'anagram', index: 0, direction: 'builder' }); seen.add(lower) }
  }
  return out
})
const userTotalValidScore = computed(() => {
  const payloadTotal = Number(userResult.value?.total_score)
  if (!Number.isNaN(payloadTotal) && payloadTotal > 0) return payloadTotal
  let sum = 0
  for (const it of userDisplayedValidWords.value) sum += (typeof it?.score === 'number' ? it.score : 0)
  return sum
})


// --- Highlighting logic per panel ---
const highlightedCells = ref(new Set())
const selectedWord = ref(null)
const selectedWordScore = ref(null)
function clearHighlight() { highlightedCells.value = new Set(); selectedWord.value = null; selectedWordScore.value = null; anagramHighlighted.value = false }
function highlightWordAnywhere(word) {
  const set = findHighlightForWord(word, baseGrid.value, editableGrid.value, isTargetCell)
  if (set && set.size) { highlightedCells.value = set } else { clearHighlight() }
}
function onPanelHighlight(item) {
  const w = String(item?.word || '')
  const ta = String(topAnagram.value || '')
  if (w && ta && w.toUpperCase() === ta.toUpperCase()) { clearHighlight(); selectedWord.value = w; anagramHighlighted.value = true; return }
  anagramHighlighted.value = false
  selectedWord.value = w
  selectedWordScore.value = (typeof item?.score === 'number') ? item.score : null
  // Prefer exact coordinates from metadata
  try {
    const setFromMeta = computeHighlightFromItem(item, baseGrid.value, editableGrid.value, isTargetCell)
    if (setFromMeta && setFromMeta.size) { highlightedCells.value = setFromMeta; return }
  } catch (_) { /* ignore */ }
  // Fallback to search-based
  highlightWordAnywhere(w)
}

const userHighlightedCells = ref(new Set())
const userSelectedWord = ref(null)
const userSelectedWordScore = ref(null)
function userClearHighlight() { userHighlightedCells.value = new Set(); userSelectedWord.value = null; userSelectedWordScore.value = null; userAnagramHighlighted.value = false }
function userHighlightWordAnywhere(word) {
  const set = findHighlightForWord(word, baseGrid.value, userEditableGrid.value, isTargetCell)
  if (set && set.size) { userHighlightedCells.value = set } else { userClearHighlight() }
}
function onUserPanelHighlight(item) {
  const w = String(item?.word || '')
  const ua = String(userTopAnagram.value || '')
  if (w && ua && w.toUpperCase() === ua.toUpperCase()) { userClearHighlight(); userSelectedWord.value = w; userAnagramHighlighted.value = true; return }
  userAnagramHighlighted.value = false
  userSelectedWord.value = w
  userSelectedWordScore.value = (typeof item?.score === 'number') ? item.score : null
  // Prefer exact coordinates from metadata (e.g., madness path)
  try {
    const setFromMeta = computeHighlightFromItem(item, baseGrid.value, userEditableGrid.value, isTargetCell)
    if (setFromMeta && setFromMeta.size) { userHighlightedCells.value = setFromMeta; return }
  } catch (_) { /* ignore */ }
  // Fallback to search-based highlight
  userHighlightWordAnywhere(w)
}

const endOfGame = ref(true) // read-only

const { initialized, userSub, userTier } = useMarganaAuth()

async function load() {
  loading.value = true
  error.value = null
  try {
    const yesterdayISO = getYesterdayDateISO()

    // OFFICIAL completed
    puzzle.value = await fetchOfficialPuzzle(yesterdayISO, 'completed')

    buildEditableGrid()
    // Apply any official skipped rows/solved letters if present in the payload
    try { applySolvedToGrid(puzzle.value, editableGrid) } catch (_) {}

    // Build official words
    let items = Array.isArray(puzzle.value?.valid_words_metadata) ? puzzle.value.valid_words_metadata : null
    if (!items) {
      const avws = puzzle.value?.all_valid_words_scores || {}
      items = Object.entries(avws)
        .map(([w, s]) => ({ word: String(w), type: 'completed', index: 0, direction: '—', score: typeof s === 'number' ? s : undefined }))
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.word.localeCompare(b.word))
    }
    marganaResult.value = { valid_words_metadata: items }

    // USER results (optional)
    if (userSub.value) {
      try {
        userResult.value = await fetchUserResults(userSub.value, yesterdayISO)
        if (userResult.value) {
          buildUserEditableGrid()
          applySolvedToGrid(userResult.value, userEditableGrid)
        }
      } catch (_) { /* ignore user fetch issues */ }
    }

    await nextTick()
    try {
      const panels = 1 + (userResult.value ? 1 : 0)
      dispatchUsage('compare_view', { date: yesterdayISO, panels, hasUser: !!userResult.value })
    } catch (_) {}
  } catch (e) {
    console.error('Failed to load yesterday\'s puzzle:', e)
    error.value = e?.message || String(e)
  } finally {
    loading.value = false
  }
}

// Trigger initial load once auth is ready
watch(initialized, (isInit) => {
  if (isInit) {
    load()
  }
}, { immediate: true })

// Reload data if the user logs in or out while on this page
watch(userTier, (newTier, oldTier) => {
  if (initialized.value && newTier !== oldTier) {
    load()
  }
})


const topAnagram = computed(() => {
  const v = puzzle.value?.meta?.longestAnagram || puzzle.value?.longest_anagram || ''
  return String(v || '').toUpperCase()
})
const userTopAnagram = computed(() => {
  let v = userResult.value?.meta?.userAnagram || ''
  if (!v && Array.isArray(userResult.value?.valid_words_metadata)) {
    const it = userResult.value.valid_words_metadata.find(x => x && x.type === 'anagram' && x.word)
    if (it && it.word) v = String(it.word)
  }
  return String(v || '').toUpperCase()
})

// Static highlight states for anagrams
const anagramHighlighted = ref(false)
const userAnagramHighlighted = ref(false)
</script>

<template>
  <div class="flex flex-col items-center min-h-full p-4">
    <div class="w-full max-w-5xl mx-auto px-3 sm:px-4 flex flex-col items-center justify-center mb-2">
      <h1 class="text-xl sm:text-2xl font-bold text-white drop-shadow-lg">
        Yesterday
      </h1>
    </div>

    <div v-if="error" class="text-red-300">{{ error }}</div>
    <div v-if="loading" class="flex flex-col items-center mt-12 space-y-6">
      <div class="dots-loader" role="img" aria-label="Loading">
        <span class="dot"></span>
        <span class="dot"></span>
        <span class="dot"></span>
      </div>
    </div>

    <div v-else class="w-full max-w-5xl mx-auto px-3 sm:px-4">
      <!-- Responsive grid of cards -->
      <div class="yesterday-postgame-scope grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <!-- Official card -->
        <PostGameView
          :marganaResult="puzzle"
          userLabel="Margana"
          :baseGrid="baseGrid"
          :editableGrid="editableGrid"
          :highlightedCells="highlightedCells"
          :scoreFor="scoreForOfficial"
          :isTargetCell="isTargetCell"
          :isVerticalTargetCell="isVerticalTargetCell"
          :isDiagonalCell="isDiagonalCell"
          :displayedValidWords="displayedValidWords"
          :selectedWord="selectedWord"
          :selectedWordScore="selectedWordScore"
          :totalValidScore="totalValidScore"
          :anagramHighlighted="anagramHighlighted"
          :showShare="false"
          :showPerformance="false"
          :showMadnessBanner="false"
          widthClass="w-full"
          @highlight="onPanelHighlight"
          @clear="clearHighlight"
        />

        <!-- User card -->
        <PostGameView
          v-if="userResult"
          :marganaResult="userResult"
          userLabel="You"
          :baseGrid="baseGrid"
          :editableGrid="userEditableGrid"
          :highlightedCells="userHighlightedCells"
          :scoreFor="scoreForUser"
          :isTargetCell="isTargetCell"
          :isVerticalTargetCell="isVerticalTargetCell"
          :isDiagonalCell="isDiagonalCell"
          :displayedValidWords="userDisplayedValidWords"
          :selectedWord="userSelectedWord"
          :selectedWordScore="userSelectedWordScore"
          :totalValidScore="userTotalValidScore"
          :anagramHighlighted="userAnagramHighlighted"
          :showShare="false"
          :showPerformance="false"
          :showMadnessBanner="false"
          widthClass="w-full"
          @highlight="onUserPanelHighlight"
          @clear="userClearHighlight"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>

</style>
