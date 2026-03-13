<script setup>
// AnagramBuilder.vue
// Purpose: Encapsulates the top anagram tiles and the placeholder/builder row
// with full drag-and-drop and touch support. Styling is preserved from the
// original Margana.vue. The component maintains its own internal state and
// exposes a small API to the parent for validation flows.

import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import marganaLogo from '@/assets/margana_full_logo.svg'
import ShuffleButton from './margana/ShuffleButton.vue'

const emit = defineEmits(['builder-change', 'builder-snapshot', 'shuffle', 'reset', 'exit-immersive', 'verify-anagram'])

const props = defineProps({
  // Uppercased longest anagram string (parent computes and passes)
  topAnagram: { type: String, default: '' },
  // Boolean mask: for each index in the anagram, true = letter available to use
  // (parent derives this from grid letter counts; disabled tiles are not draggable)
  anagramRevealMask: { type: Array, default: () => [] },
  // Whether the game has concluded (affects rendering: disables inputs, shows final)
  endOfGame: { type: Boolean, default: false },
  // Parent indicates hydration phase to suppress initial reset emissions
  hydrating: { type: Boolean, default: false },
  // Parent can pass an initial snapshot to hydrate builder rows on mount/refresh
  initialSnapshot: { type: Object, default: null },
  // Function to compute letter score for badges in the corners
  scoreFor: { type: Function, required: true },
  // Landscape immersive mode for mobile: enlarge tiles and controls
  landscape: { type: Boolean, default: false },
  // Master toggle from parent to show/hide the numeric help chip (2)
  showHelpControls: { type: Boolean, default: false },
  readonly: { type: Boolean, default: false },
  isTutorial: { type: Boolean, default: false },
  showControls: { type: Boolean, default: true },
  size: { type: String, default: 'large' }, // small | medium | large
  showCoachArrow: { type: Boolean, default: false },
})

// --- Internal state --------------------------------------------------------
// Display order for the top anagram tiles. Stores original indices 0..n-1
const topOrder = ref([])
// Tracks which top tiles (by original index) were consumed into the builder
const topConsumed = ref([])
// Letters placed into the placeholder row under the anagram
const placeholderLetters = ref([])
// Marks which builder slots were filled via a paid Buy placement.
// Purely for styling; cleared if the letter is moved out or on reset.
const boughtMarks = ref([])
// Internal flag to suppress watcher resets while a parent-driven restore is in progress
const restoring = ref(false)

// Drag-and-drop state
const draggedLetter = ref(null)
const draggedFromOrigIndex = ref(null)
const draggedFromDisplayIndex = ref(null)
const draggedFromBuilderIndex = ref(null)
const draggedOriginType = ref(null) // 'top' | 'builder' | null
const dropSucceeded = ref(false)
const deniedBounceIndex = ref(null) // for top-row bounce (uses display index)
const deniedBuilderBounceIndex = ref(null) // for builder-row bounce

// Hover indices for visual feedback during drag-over (top tiles and builder slots)
const hoverTopIndex = ref(null)
const hoverBuilderIndex = ref(null)

// Transient error state to paint the builder row (used during validation)
const builderError = ref(false)
// Shake index: -1 is builder area; maintained internally for UX feedback
const shakeRow = ref(null)

// Touch support mirrors desktop DnD
const isTouchDragging = ref(false)
const touchX = ref(0)
const touchY = ref(0)

const pulseTopIndices = ref(new Set())
const pulseBuilderIndices = ref(new Set())
const highlightAction = ref(null)

function triggerPulseTop(idx, duration = 2000) {
  pulseTopIndices.value.add(idx)
  setTimeout(() => pulseTopIndices.value.delete(idx), duration)
}

function triggerPulseBuilder(idx, duration = 2000) {
  pulseBuilderIndices.value.add(idx)
  setTimeout(() => pulseBuilderIndices.value.delete(idx), duration)
}

function triggerHighlightAction(actionId) {
  highlightAction.value = actionId
}

function clearHighlightAction() {
  highlightAction.value = null
}


// One-time guard to avoid initial reset wipe regardless of prop ordering
let __topAnagramWatcherInitialized = false
// Keep arrays sized to the anagram length
watch(() => props.topAnagram, (text) => {
  const len = (text || '').length
  // During hydration, avoid wiping/restoring state via the immediate watcher.
  // Only ensure array lengths match; do not emit builder changes.
  if (props.hydrating) {
    const needResize = (topOrder.value?.length !== len) || (topConsumed.value?.length !== len) || (placeholderLetters.value?.length !== len)
    if (needResize) {
      topOrder.value = Array.from({ length: len }, (_, i) => i)
      topConsumed.value = Array(len).fill(false)
      placeholderLetters.value = Array(len).fill('')
      boughtMarks.value = Array(len).fill(false)
    }
    __topAnagramWatcherInitialized = true
    return
  }
  // Unconditional first-run guard: do not emit/reset on the very first immediate run
  if (!__topAnagramWatcherInitialized) {
    __topAnagramWatcherInitialized = true
    const needResize = (topOrder.value?.length !== len) || (topConsumed.value?.length !== len) || (placeholderLetters.value?.length !== len)
    if (needResize) {
      topOrder.value = Array.from({ length: len }, (_, i) => i)
      topConsumed.value = Array(len).fill(false)
      placeholderLetters.value = Array(len).fill('')
      boughtMarks.value = Array(len).fill(false)
    }
    return
  }
  // If we already have meaningful builder state, avoid wiping it; just ensure sizes
  const hasLetters = Array.isArray(placeholderLetters.value) && placeholderLetters.value.some(ch => !!(ch && String(ch).trim()))
  const hasConsumed = Array.isArray(topConsumed.value) && topConsumed.value.some(Boolean)
  if (hasLetters || hasConsumed) {
    const needResize = (topOrder.value?.length !== len) || (topConsumed.value?.length !== len) || (placeholderLetters.value?.length !== len)
    if (needResize) {
      topOrder.value = Array.from({ length: len }, (_, i) => i)
      // Preserve content up to new length; pad/truncate
      const newCons = Array(len).fill(false)
      for (let i = 0; i < Math.min(len, topConsumed.value.length); i++) newCons[i] = !!topConsumed.value[i]
      topConsumed.value = newCons
      const newSlots = Array(len).fill('')
      for (let i = 0; i < Math.min(len, placeholderLetters.value.length); i++) newSlots[i] = (placeholderLetters.value[i] || '').toString().toUpperCase()
      placeholderLetters.value = newSlots
      const newBought = Array(len).fill(false)
      for (let i = 0; i < Math.min(len, boughtMarks.value.length); i++) newBought[i] = !!boughtMarks.value[i]
      boughtMarks.value = newBought
      emitBuilderChanged()
    } else {
      // no-op
    }
    return
  }
  // No meaningful existing state: safe to reset
  topOrder.value = Array.from({ length: len }, (_, i) => i)
  topConsumed.value = Array(len).fill(false)
  placeholderLetters.value = Array(len).fill('')
  emitBuilderChanged()
}, { immediate: true })

// Hydrate from an initial snapshot provided by the parent (on mount/refresh)
watch(() => props.initialSnapshot, (snap) => {
  try {
    if (!snap) return
    const slotsArr = Array.isArray(snap.slots) ? snap.slots : []
    const bankArr = Array.isArray(snap.bank) ? snap.bank : []
    const orderArr = Array.isArray(snap.topOrder) ? snap.topOrder : []
    const hasLetters = slotsArr.some(ch => !!(ch && String(ch).trim()))
    const hasBank = bankArr.some(Boolean)
    const hasOrder = orderArr.length > 0
    if (!(hasLetters || hasBank || hasOrder)) return
    // Apply restore using the existing method; restoring flag guards watchers
    restoreBuilderSnapshot(snap)
  } catch (_) { /* ignore */ }
}, { immediate: true, deep: false })

// Reconcile the builder row when availability changes (e.g., user deletes a grid letter)
function reconcileBuilderWithAvailability() {
  try {
    if (props.endOfGame) return
    // During hydration or explicit restore, do not reconcile (prevents wiping restored state)
    if (props.hydrating || restoring.value) return
    // Avoid fighting with an active drag operation
    if (draggedLetter.value || isTouchDragging.value) return
    const ana = (props.topAnagram || '')
    const mask = Array.isArray(props.anagramRevealMask) ? props.anagramRevealMask : []
    const consumed = Array.isArray(topConsumed.value) ? topConsumed.value : []
    const letters = Array.isArray(placeholderLetters.value) ? placeholderLetters.value : []
    if (!ana || !mask.length || !consumed.length || !letters.length) return

    let changed = false
    // For every consumed anagram index that is no longer available, free it and remove one matching letter from builder
    for (let j = 0; j < ana.length; j++) {
      if (consumed[j] === true && !mask[j]) {
        const L = ana[j]
        // remove the rightmost matching letter from the builder row
        for (let k = letters.length - 1; k >= 0; k--) {
          const ch = (letters[k] || '').toString().toUpperCase()
          if (ch === L) {
            letters[k] = ''
            changed = true
            break
          }
        }
        consumed[j] = false
        changed = true
      }
    }

    if (changed) {
      placeholderLetters.value = letters.slice()
      topConsumed.value = consumed.slice()
      // Clear any prior error and notify parent about the new builder word
      emitBuilderChanged()
    }
  } catch (_) { /* ignore */ }
}

  // When the reveal mask changes (driven by the grid), reconcile the builder with availability
watch(() => props.anagramRevealMask, () => {
  reconcileBuilderWithAvailability()
}, { deep: true })

// Watch for topOrder changes from parent/snapshot
watch(() => props.initialSnapshot?.topOrder, (newOrder) => {
  if (Array.isArray(newOrder) && newOrder.length === topOrder.value.length) {
    topOrder.value = newOrder.slice()
  }
}, { deep: true })

const consumedMask = computed(() => {
  const arr = topConsumed.value || []
  const len = (props.topAnagram || '').length
  if (arr.length !== len) return Array(len).fill(false)
  return arr
})

// --- Utils -----------------------------------------------------------------
function sanitizeLetter(v) {
  return (v || '').replace(/[^a-zA-Z]/g, '').slice(0, 1).toUpperCase()
}

// Enable Verify button only when all placed letters form a single contiguous
// block (no gaps) of length ≥ 3. If there are any extra non-contiguous letters
// outside that block, the button stays disabled.
const canVerifyAnagram = computed(() => {
  try {
    if (props.endOfGame) return false
    const slots = Array.isArray(placeholderLetters.value) ? placeholderLetters.value : []
    const filledIdx = []
    for (let i = 0; i < slots.length; i++) {
      if (sanitizeLetter(slots[i] || '')) filledIdx.push(i)
    }
    if (filledIdx.length < 3) return false
    const min = filledIdx[0]
    const max = filledIdx[filledIdx.length - 1]
    // They must already be sorted by iteration order; verify no gaps and that
    // count matches span length.
    const spanLen = (max - min + 1)
    if (spanLen !== filledIdx.length) return false
    // Also ensure every index in the span is actually filled (no holes)
    for (let i = min; i <= max; i++) {
      if (!sanitizeLetter(slots[i] || '')) return false
    }
    // Single solid block with length >= 3
    return spanLen >= 3
  } catch (_) {
    return false
  }
})

// Local verifying guard to prevent rapid double-clicks
const isVerifyAnagram = ref(false)
// Show a success tick next to Verify for 5 seconds after a successful verification
const verifyOkVisible = ref(false)
let _verifyOkTimer = null

function verifyAnagram() {
  try {
    if (props.endOfGame) return
    if (isVerifyAnagram.value) return
    if (!canVerifyAnagram.value) return
    isVerifyAnagram.value = true
    // Emit current builder word for parent to validate
    try { emit('verify-anagram', getBuilderWord()) } catch (_) {}
  } finally {
    // Keep the button disabled for a very short time to debounce
    setTimeout(() => { isVerifyAnagram.value = false }, 250)
  }
}

// Called by parent when server accepts the anagram verification
function indicateVerifyOk() {
  try {
    if (props.isTutorial) return
    verifyOkVisible.value = true
    if (_verifyOkTimer) { clearTimeout(_verifyOkTimer) }
    _verifyOkTimer = setTimeout(() => {
      try { verifyOkVisible.value = false } catch (_) {}
      _verifyOkTimer = null
    }, 2000)
  } catch (_) { /* ignore */ }
}

// The current anagram word built in the placeholder row (skips blanks)
function getBuilderWord() {
  try {
    const letters = Array.isArray(placeholderLetters.value) ? placeholderLetters.value : []
    return letters.map(ch => sanitizeLetter(ch)).filter(Boolean).join('')
  } catch (_) {
    return ''
  }
}

// Expose non-empty final letters (used for end-of-game display if needed)
function getFinalLetters() {
  try {
    const letters = Array.isArray(placeholderLetters.value) ? placeholderLetters.value : []
    return letters.map(ch => sanitizeLetter(ch)).filter(Boolean)
  } catch (_) {
    return []
  }
}

function getBuilderSnapshot() {
  try {
    const word = getBuilderWord()
    const slots = Array.isArray(placeholderLetters.value) ? placeholderLetters.value.slice() : []
    const bank = Array.isArray(topConsumed.value) ? topConsumed.value.slice() : []
    const order = Array.isArray(topOrder.value) ? topOrder.value.slice() : []
    return { word, slots, bank, topOrder: order }
  } catch (_) {
    return { word: '', slots: [], bank: [], topOrder: [] }
  }
}

function emitBuilderChanged() {
  try {
    builderError.value = false
    emit('builder-change', getBuilderWord())
    emit('builder-snapshot', getBuilderSnapshot())
  } catch (_) { /* ignore */ }
}

// Allow parent to trigger a brief error indication (shake + highlight)
function indicateError() {
  builderError.value = true
  shakeRow.value = -1
  setTimeout(() => { if (shakeRow.value === -1) shakeRow.value = null }, 600)
}

// Shuffle and Reset controls (public API as well)
function shuffleTopRow() {
  try {
    // 1. Shuffle the local display order
    const arr = topOrder.value.slice()
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp
    }
    topOrder.value = arr

    // 2. Notify the parent (for analytics and state sync)
    emit('shuffle', { len: (props.topAnagram || '').length })
    emitBuilderChanged()
  } catch (_) { /* no-op */ }
}

function resetAnagramBuilder() {
  try {
    const len = (props.topAnagram || '').length
    // Clear all builder slots
    placeholderLetters.value = Array(len).fill('')
    // Mark all top tiles as available again
    topConsumed.value = Array(len).fill(false)
    // Clear bought marks
    boughtMarks.value = Array(len).fill(false)
    // Notify after both slots and bank are reset so parent snapshot reflects cleared bank
    emitBuilderChanged()
    // Clear transient drag state/bounce indicators
    draggedLetter.value = null
    draggedFromOrigIndex.value = null
    draggedFromDisplayIndex.value = null
    draggedFromBuilderIndex.value = null
    draggedOriginType.value = null
    dropSucceeded.value = false
    deniedBounceIndex.value = null
    deniedBuilderBounceIndex.value = null
    builderError.value = false
    try { emit('reset', { len }) } catch (_) {}
  } catch (_) { /* no-op */ }
}

// --- DnD core --------------------------------------------------------------
function allowDrop(ev) {
  try {
    ev?.preventDefault?.()
    if (ev?.dataTransfer) {
      if (draggedOriginType.value === 'builder') ev.dataTransfer.dropEffect = 'move'
      else ev.dataTransfer.dropEffect = 'copy'
    }
  } catch (_) {}
}

function handleTopDragStart(ch, origIdx, dispIdx, ev) {
  const L = sanitizeLetter(ch)
  draggedLetter.value = L || null
  draggedFromOrigIndex.value = typeof origIdx === 'number' ? origIdx : null
  draggedFromDisplayIndex.value = typeof dispIdx === 'number' ? dispIdx : null
  draggedFromBuilderIndex.value = null
  draggedOriginType.value = 'top'
  dropSucceeded.value = false
  try {
    if (ev?.dataTransfer) {
      ev.dataTransfer.setData('text/plain', L || '')
      ev.dataTransfer.effectAllowed = 'copyMove'
    }
  } catch (_) {}
}

function handleBuilderDragStart(idx, ev) {
  const L = sanitizeLetter(placeholderLetters.value?.[idx] || '')
  if (!L) { try { ev?.preventDefault?.() } catch(_){}; return }
  draggedLetter.value = L
  draggedFromOrigIndex.value = null
  draggedFromDisplayIndex.value = null
  draggedFromBuilderIndex.value = idx
  draggedOriginType.value = 'builder'
  dropSucceeded.value = false
  // User is modifying the builder; clear previous error highlight
  builderError.value = false
  try {
    if (ev?.dataTransfer) {
      ev.dataTransfer.setData('text/plain', L)
      ev.dataTransfer.effectAllowed = 'move'
    }
  } catch (_) {}
}

function handleDragEnd() {
  if (!dropSucceeded.value) {
    if (draggedOriginType.value === 'top' && draggedFromDisplayIndex.value !== null && draggedFromDisplayIndex.value !== undefined) {
      const idx = draggedFromDisplayIndex.value
      deniedBounceIndex.value = idx
      setTimeout(() => { if (deniedBounceIndex.value === idx) deniedBounceIndex.value = null }, 300)
    } else if (draggedOriginType.value === 'builder' && draggedFromBuilderIndex.value !== null && draggedFromBuilderIndex.value !== undefined) {
      const bIdx = draggedFromBuilderIndex.value
      deniedBuilderBounceIndex.value = bIdx
      setTimeout(() => { if (deniedBuilderBounceIndex.value === bIdx) deniedBuilderBounceIndex.value = null }, 300)
    }
  }
  hoverTopIndex.value = null
  hoverBuilderIndex.value = null
  draggedLetter.value = null
  draggedFromOrigIndex.value = null
  draggedFromDisplayIndex.value = null
  draggedFromBuilderIndex.value = null
  draggedOriginType.value = null
  dropSucceeded.value = false
  // After a drag completes, reconcile builder with new availability in case the mask changed mid-drag
  setTimeout(() => reconcileBuilderWithAvailability(), 0)
}

function onDragEnterTop(displayTargetIdx) { hoverTopIndex.value = displayTargetIdx }
function onDragLeaveTop(displayTargetIdx) { if (hoverTopIndex.value === displayTargetIdx) hoverTopIndex.value = null }
function onDragEnterBuilder(idx) { hoverBuilderIndex.value = idx }
function onDragLeaveBuilder(idx) { if (hoverBuilderIndex.value === idx) hoverBuilderIndex.value = null }

function handleDropOnTop(displayTargetIdx, ev) {
  try { ev?.preventDefault?.() } catch(_) {}
  hoverTopIndex.value = null
  hoverBuilderIndex.value = null
  const anagram = (props.topAnagram || '')
  const hoveredOrig = Array.isArray(topOrder.value) ? topOrder.value[displayTargetIdx] : displayTargetIdx
  const hoveredEnabled = !!(props.anagramRevealMask?.[hoveredOrig])
  if (!hoveredEnabled) return

  // Reorder within top row when dragging from top
  if (draggedOriginType.value === 'top' && draggedFromDisplayIndex.value !== null && draggedFromDisplayIndex.value !== undefined) {
    const fromDisp = draggedFromDisplayIndex.value
    const toDisp = displayTargetIdx
    if (fromDisp !== toDisp && Array.isArray(topOrder.value)) {
      const arr = topOrder.value.slice()
      const [moved] = arr.splice(fromDisp, 1)
      arr.splice(toDisp, 0, moved)
      topOrder.value = arr
      dropSucceeded.value = true
    }
    return
  }

  // Accept drops from the builder only on enabled tiles: free any matching consumed tile
  if (draggedOriginType.value === 'builder' && draggedFromBuilderIndex.value !== null && draggedFromBuilderIndex.value !== undefined) {
    const from = draggedFromBuilderIndex.value
    const L = sanitizeLetter(draggedLetter.value)
    if (L && anagram) {
      let targetOrigIndex = null
      const hoveredMatches = anagram[hoveredOrig] === L && Array.isArray(topConsumed.value) && topConsumed.value[hoveredOrig] === true
      if (hoveredMatches) {
        targetOrigIndex = hoveredOrig
      } else if (Array.isArray(topConsumed.value)) {
        for (let j = 0; j < anagram.length; j++) {
          if (topConsumed.value[j] === true && anagram[j] === L && props.anagramRevealMask?.[j]) { targetOrigIndex = j; break }
        }
      }
      if (targetOrigIndex !== null && targetOrigIndex !== undefined) {
        if (placeholderLetters.value?.[from]) placeholderLetters.value[from] = ''
        // Clear any bought mark from the source slot when letter returns to top
        if (Array.isArray(boughtMarks.value) && boughtMarks.value.length > from) boughtMarks.value[from] = false
        if (Array.isArray(topConsumed.value) && topConsumed.value.length > targetOrigIndex) topConsumed.value[targetOrigIndex] = false
        // Builder contents changed: notify parent
        emitBuilderChanged()
        dropSucceeded.value = true
      }
    }
  }
}

function findNearestEmptyInPlaceholder(startIdx) {
  const n = placeholderLetters.value.length
  for (let d = 1; d < n; d++) {
    const left = startIdx - d
    if (left >= 0) {
      const v = sanitizeLetter(placeholderLetters.value[left] || '')
      if (!v) return left
    }
    const right = startIdx + d
    if (right < n) {
      const v = sanitizeLetter(placeholderLetters.value[right] || '')
      if (!v) return right
    }
  }
  return null
}

function handleDropOnPlaceholder(idx, ev) {
  try { ev?.preventDefault?.() } catch(_) {}
  hoverTopIndex.value = null
  hoverBuilderIndex.value = null
  let L = draggedLetter.value
  try { if (!L && ev?.dataTransfer) L = sanitizeLetter(ev.dataTransfer.getData('text/plain')) } catch (_) {}
  L = sanitizeLetter(L)
  if (!L) return

  const current = sanitizeLetter(placeholderLetters.value?.[idx] || '')

  // If dragging from builder, move and clear origin
  if (draggedOriginType.value === 'builder' && draggedFromBuilderIndex.value !== null && draggedFromBuilderIndex.value !== undefined) {
    const from = draggedFromBuilderIndex.value
    if (from === idx) { dropSucceeded.value = true; return }
    if (!current) {
      placeholderLetters.value[idx] = L
      placeholderLetters.value[from] = ''
      // Clear bought mark from source slot when moved elsewhere; do not transfer
      if (Array.isArray(boughtMarks.value) && boughtMarks.value.length > from) boughtMarks.value[from] = false
      // Also clear any existing mark at the destination when replacing emptiness
      if (Array.isArray(boughtMarks.value) && boughtMarks.value.length > idx) boughtMarks.value[idx] = false
      // Builder changed: clear error and notify parent with full snapshot
      builderError.value = false
      emitBuilderChanged()
      dropSucceeded.value = true
      return
    }
    const dest = findNearestEmptyInPlaceholder(idx)
    if (dest !== null && dest !== undefined) {
      placeholderLetters.value[dest] = current
      placeholderLetters.value[idx] = L
      placeholderLetters.value[from] = ''
      // Moving builder→builder: clear bought mark from source; do not carry to new positions
      if (Array.isArray(boughtMarks.value) && boughtMarks.value.length > from) boughtMarks.value[from] = false
      // The previous "current" letter moved away from idx; ensure idx mark cleared
      if (Array.isArray(boughtMarks.value) && boughtMarks.value.length > idx) boughtMarks.value[idx] = false
      // Destination received a moved letter; ensure no bought mark applied
      if (Array.isArray(boughtMarks.value) && boughtMarks.value.length > dest) boughtMarks.value[dest] = false
      // Builder changed: clear error and notify parent with full snapshot
      builderError.value = false
      emitBuilderChanged()
      dropSucceeded.value = true
    } else {
      // no space → shake builder area and let snapback animate
      shakeRow.value = -1
      setTimeout(() => { if (shakeRow.value === -1) shakeRow.value = null }, 400)
    }
    return
  }

  // Default behavior (dragging from top): place or shift within builder
  if (!current) {
    placeholderLetters.value[idx] = L
    if (draggedOriginType.value === 'top' && draggedFromOrigIndex.value !== null && draggedFromOrigIndex.value !== undefined) {
      if (Array.isArray(topConsumed.value) && topConsumed.value.length > draggedFromOrigIndex.value) {
        topConsumed.value[draggedFromOrigIndex.value] = true
      }
    }
    // Clear any previous bought mark at destination when simply placing
    if (Array.isArray(boughtMarks.value) && boughtMarks.value.length > idx) boughtMarks.value[idx] = false
    // User is building again; clear any previous error and emit full snapshot
    builderError.value = false
    emitBuilderChanged()
    dropSucceeded.value = true
    return
  }
  const dest = findNearestEmptyInPlaceholder(idx)
  if (dest !== null && dest !== undefined) {
    placeholderLetters.value[dest] = current
    placeholderLetters.value[idx] = L
    if (draggedOriginType.value === 'top' && draggedFromOrigIndex.value !== null && draggedFromOrigIndex.value !== undefined) {
      if (Array.isArray(topConsumed.value) && topConsumed.value.length > draggedFromOrigIndex.value) {
        topConsumed.value[draggedFromOrigIndex.value] = true
      }
    }
    // We changed letters at idx and dest; ensure marks cleared
    if (Array.isArray(boughtMarks.value) && boughtMarks.value.length > idx) boughtMarks.value[idx] = false
    if (Array.isArray(boughtMarks.value) && boughtMarks.value.length > dest) boughtMarks.value[dest] = false
    // User is building again; clear any previous error and emit full snapshot
    builderError.value = false
    emitBuilderChanged()
    dropSucceeded.value = true
  } else {
    shakeRow.value = -1
    setTimeout(() => { if (shakeRow.value === -1) shakeRow.value = null }, 400)
  }
}

// --- Touch support ---------------------------------------------------------
function setTouchPosFromEvent(ev) {
  try {
    const t = ev?.touches?.[0] || ev?.changedTouches?.[0]
    if (t) {
      // Use pageX/Y to ensure the avatar stays under the finger even when
      // the keyboard shifts the viewport on mobile devices.
      touchX.value = t.pageX
      touchY.value = t.pageY
    }
  } catch (_) { /* ignore */ }
}

function onTouchStartTop(ch, origIdx, dispIdx, ev) {
  if (props.readonly && ev && !ev.isTrusted) {
    // allow programmatic events
  } else if (props.readonly) {
    return
  }
  try { ev?.preventDefault?.() } catch(_) {}
  setTouchPosFromEvent(ev)
  isTouchDragging.value = true
  handleTopDragStart(ch, origIdx, dispIdx, ev)
}

function onTouchStartBuilder(idx, ev) {
  if (props.readonly && ev && !ev.isTrusted) {
    // allow programmatic
  } else if (props.readonly) {
    return
  }
  try { ev?.preventDefault?.() } catch(_) {}
  const L = sanitizeLetter(placeholderLetters.value?.[idx] || '')
  if (!L) return
  setTouchPosFromEvent(ev)
  isTouchDragging.value = true
  handleBuilderDragStart(idx, ev)
}

function findClosestDndTarget(el) {
  let node = el
  while (node) {
    const ds = node.dataset || {}
    if (ds.dndTopIndex !== undefined) {
      const idx = Number(ds.dndTopIndex)
      if (!Number.isNaN(idx)) return { type: 'top', index: idx }
    }
    if (ds.dndBuilderIndex !== undefined) {
      const idx = Number(ds.dndBuilderIndex)
      if (!Number.isNaN(idx)) return { type: 'builder', index: idx }
    }
    node = node.parentElement
  }
  return null
}

function onTouchMove(ev) {
  try { ev?.preventDefault?.() } catch(_) {}
  setTouchPosFromEvent(ev)
  const t = ev?.touches?.[0]
  if (t) {
    const el = document.elementFromPoint(t.clientX, t.clientY)
    const target = findClosestDndTarget(el)
    if (target) {
      if (target.type === 'top') { hoverTopIndex.value = target.index; hoverBuilderIndex.value = null }
      else if (target.type === 'builder') { hoverBuilderIndex.value = target.index; hoverTopIndex.value = null }
    } else { hoverTopIndex.value = null; hoverBuilderIndex.value = null }
  }
}

function onTouchEnd(ev) {
  try { ev?.preventDefault?.() } catch(_) {}
  const touch = ev?.changedTouches && ev.changedTouches[0]
  if (touch) {
    const el = document.elementFromPoint(touch.clientX, touch.clientY)
    const target = findClosestDndTarget(el)
    if (target) {
      if (target.type === 'top') handleDropOnTop(target.index, ev)
      else if (target.type === 'builder') handleDropOnPlaceholder(target.index, ev)
    }
  }
  hoverTopIndex.value = null
  hoverBuilderIndex.value = null
  handleDragEnd()
  isTouchDragging.value = false
}

// --- Expose minimal API to parent -----------------------------------------
const anagramHighlighted = ref(false)
function setAnagramHighlighted(v = true) { anagramHighlighted.value = !!v }

function setBuilderWord(word) {
  try {
    const text = (word || '').toString().toUpperCase()
    const anaLen = (props.topAnagram || '').length
    const len = Math.max(anaLen, text.length)
    const letters = Array(len).fill('')
    for (let i = 0; i < Math.min(len, text.length); i++) {
      const ch = sanitizeLetter(text[i])
      if (ch) letters[i] = ch
    }
    placeholderLetters.value = letters
    // Mark consumed matches from the top anagram (best-effort)
    const ana = (props.topAnagram || '')
    const consumed = Array(anaLen || len).fill(false)
    // Greedy match: for each placed letter, consume first matching available anagram letter that is revealable
    for (let i = 0; i < (anaLen || len); i++) {
      const L = sanitizeLetter(letters[i])
      if (!L) continue
      for (let j = 0; j < anaLen; j++) {
        if (!consumed[j] && ana[j] === L && (!!props.anagramRevealMask?.[j])) { consumed[j] = true; break }
      }
    }
    topConsumed.value = consumed
    emit('builder-change', getBuilderWord())
  } catch (_) { /* ignore */ }
}

function restoreBuilderSnapshot(snapshot) {
  try {
    restoring.value = true
    const snap = snapshot || {}
    const len = (props.topAnagram || '').length
    // slots: array of letters for builder row
    if (Array.isArray(snap.slots)) {
      const letters = Array(len).fill('')
      for (let i = 0; i < Math.min(len, snap.slots.length); i++) {
        const ch = sanitizeLetter(snap.slots[i])
        if (ch) letters[i] = ch
      }
      placeholderLetters.value = letters
    } else {
      placeholderLetters.value = Array(len).fill('')
    }
    // bank: top consumed flags
    if (Array.isArray(snap.bank)) {
      const bank = Array(len).fill(false)
      for (let i = 0; i < Math.min(len, snap.bank.length); i++) {
        bank[i] = !!snap.bank[i]
      }
      topConsumed.value = bank
    } else {
      topConsumed.value = Array(len).fill(false)
    }
    // topOrder: display order of the top row
    if (Array.isArray(snap.topOrder) && snap.topOrder.length === len) {
      topOrder.value = snap.topOrder.slice()
    } else {
      topOrder.value = Array.from({ length: len }, (_, i) => i)
    }
    // Notify parent of the new word derived from slots (after microtask)
    nextTick(() => {
      try { emitBuilderChanged() } catch (_) {}
      restoring.value = false
    })
  } catch (_) { restoring.value = false /* ignore */ }
}

defineExpose({
  getBuilderWord,
  getFinalLetters,
  getBuilderSnapshot,
  indicateError,
  indicateVerifyOk,
  shuffleTopRow,
  resetAnagramBuilder,
  setAnagramHighlighted,
  setBuilderWord,
  restoreBuilderSnapshot,
  triggerPulseTop,
  triggerPulseBuilder,
  triggerHighlightAction,
  clearHighlightAction,
  // New: manually mark a tile as consumed (used by tutorial to show "pick up")
  setTileConsumed(origIdx, consumed) {
    try {
      const idx = parseInt(origIdx)
      if (isNaN(idx)) return
      if (!Array.isArray(topConsumed.value)) return
      topConsumed.value[idx] = !!consumed
    } catch (_) {}
  },
  // New: Place a specific letter into a specific builder slot by consuming
  // any available matching top tile (revealed and not yet consumed).
  // Returns true on success.
  placeLetterAt(builderIndex, letter, sourceTopIndex = -1) {
    try {
      const ana = (props.topAnagram || '')
      const len = ana.length
      const idx = Number(builderIndex)
      const L = sanitizeLetter(letter)
      if (!Number.isInteger(idx) || idx < 0 || idx >= len) return false
      if (!L) return false
      // Slot must be empty
      if (Array.isArray(placeholderLetters.value) && placeholderLetters.value[idx]) return false
      
      // Find a matching, revealed, not-consumed top tile for this letter
      const reveal = props.anagramRevealMask || []
      const bank = Array.isArray(topConsumed.value) ? topConsumed.value : []
      
      let finalSourceIdx = -1
      // If a specific source index was provided, try it first (even if already marked consumed by tutorial)
      if (sourceTopIndex >= 0 && sourceTopIndex < len) {
        if (reveal[sourceTopIndex] && sanitizeLetter(ana[sourceTopIndex]) === L) {
          finalSourceIdx = sourceTopIndex
        }
      }
      
      // If no valid specific index, search for one that is NOT consumed
      if (finalSourceIdx < 0) {
        for (let i = 0; i < len; i++) {
          if (!bank[i] && reveal[i] && sanitizeLetter(ana[i]) === L) {
            finalSourceIdx = i
            break
          }
        }
      }

      if (finalSourceIdx < 0) return false

      // Consume source and place letter into requested builder slot
      placeholderLetters.value[idx] = L
      if (Array.isArray(topConsumed.value) && topConsumed.value.length === len) {
        topConsumed.value[finalSourceIdx] = true
      } else {
        const newBank = Array(len).fill(false)
        newBank[finalSourceIdx] = true
        topConsumed.value = newBank
      }
      // Do not auto-mark as bought here; parent will explicitly mark on successful Buy
      emitBuilderChanged()
      return true
    } catch (_) {
      return false
    }
  },
  // New: Place a letter at a specific builder slot with displacement.
  // If the target slot is occupied by a different letter, return that letter
  // to the top bank (free one matching consumed tile) and then place the
  // intended letter. If the same letter is already there, succeed without
  // changes. Returns true on success.
  placeLetterAtWithDisplacement(builderIndex, letter) {
    try {
      const ana = (props.topAnagram || '')
      const len = ana.length
      const idx = Number(builderIndex)
      const L = sanitizeLetter(letter)
      if (!Number.isInteger(idx) || idx < 0 || idx >= len) return false
      if (!L) return false

      const reveal = props.anagramRevealMask || []
      const bank = Array.isArray(topConsumed.value) ? topConsumed.value.slice() : Array(len).fill(false)

      // If the same letter is already in the slot, do NOT treat as success.
      // Return false so caller can keep trying other candidate indices.
      const current = Array.isArray(placeholderLetters.value) ? sanitizeLetter(placeholderLetters.value[idx]) : ''
      if (current && current === L) {
        return false
      }

      // Need a source top tile for L (revealed and not consumed)
      let sourceTopIndex = -1
      for (let i = 0; i < len; i++) {
        if (!bank[i] && reveal[i] && sanitizeLetter(ana[i]) === L) {
          sourceTopIndex = i
          break
        }
      }
      if (sourceTopIndex < 0) return false

      // If slot occupied by a different letter, free one consumed tile of that letter
      if (current && current !== L) {
        let freed = false
        for (let i = 0; i < len; i++) {
          if (bank[i] && sanitizeLetter(ana[i]) === current) {
            bank[i] = false
            freed = true
            break
          }
        }
        // Clear the builder slot regardless; if no matching consumed tile was found,
        // we still clear the slot to honor displacement preference.
        placeholderLetters.value[idx] = ''
        // Clear any bought-mark that was attached to this slot since its occupant is leaving
        if (Array.isArray(boughtMarks.value) && boughtMarks.value.length > idx) boughtMarks.value[idx] = false
        // Apply possibly updated bank
        topConsumed.value = bank.slice()
      }

      // Place intended letter and consume its source
      placeholderLetters.value[idx] = L
      bank[sourceTopIndex] = true
      topConsumed.value = bank.slice()
      emitBuilderChanged()
      return true
    } catch (_) {
      return false
    }
  },
  // Explicitly mark a builder slot as a bought placement. Will only mark
  // when the slot currently contains the provided letter (if given).
  markBoughtAt(builderIndex, letter) {
    try {
      const len = (props.topAnagram || '').length
      const idx = Number(builderIndex)
      if (!Number.isInteger(idx) || idx < 0 || idx >= len) return false
      const L = sanitizeLetter(letter)
      const current = sanitizeLetter(placeholderLetters.value?.[idx] || '')
      if (L && current && L !== current) return false
      if (current) {
        if (!Array.isArray(boughtMarks.value) || boughtMarks.value.length !== len) {
          boughtMarks.value = Array(len).fill(false)
        }
        boughtMarks.value[idx] = true
        return true
      }
      return false
    } catch (_) {
      return false
    }
  },
})

// Provide tactile visual feedback on mobile/touch when pressing controls
function onPressStart(e) {
  if (props.readonly && e && !e.isTrusted) {
    // allow programmatic
  } else if (props.readonly) {
    return
  }
  try {
    const el = e?.currentTarget
    if (!el || el.disabled) return
    el.classList.add('is-pressed')
  } catch (_) { /* ignore */ }
}
function onPressEnd(e) {
  try {
    const el = e?.currentTarget
    if (!el) return
    el.classList.remove('is-pressed')
  } catch (_) { /* ignore */ }
}

const tileSizeKey = computed(() => {
  if (props.size === 'small') return 'small'
  if (props.size === 'medium') return 'medium'
  return 'large'
})

const gapClass = computed(() => ({
  tiny: 'margana-anagram-gap-small',
  small: 'margana-anagram-gap-small',
  medium: 'margana-anagram-gap-medium',
  large: 'margana-anagram-gap-large',
}[tileSizeKey.value] ?? 'margana-anagram-gap-medium'))

const tileSizeClass = computed(() => ({
  tiny: 'margana-anagram-tile-tiny',
  small: 'margana-anagram-tile-small',
  medium: 'margana-anagram-tile-medium',
  large: 'margana-anagram-tile-large',
}[tileSizeKey.value] ?? 'margana-anagram-tile-large'))

const tileTextClass = computed(() => '')

const finalTileSizeClass = computed(() => tileSizeClass.value)
const finalTextClass = computed(() => tileTextClass.value)

const labelTextClass = computed(() => ({
  tiny: 'text-[9px]',
  small: 'text-[11px]',
  medium: 'text-[12px]',
  large: 'text-[13px] sm:text-[14px]',
}[tileSizeKey.value] ?? 'text-[13px] sm:text-[14px]'))

const controlsBtnSizeClass = computed(() => ({
  tiny: 'margana-controls-btn-small',
  small: 'margana-controls-btn-small',
  medium: 'margana-controls-btn-medium',
  large: 'margana-controls-btn-large',
}[props.size] ?? 'margana-controls-btn-large'))

</script>

<template>
  <div class="margana-anagram-wrap w-full max-w-3xl flex flex-col items-center justify-center select-none"
       :class="props.landscape ? 'landscape-mode' : ''">

    <div
      v-if="topAnagram && !endOfGame && props.landscape"
      class="inline-flex items-center justify-start self-start w-full margana-proportions"
    >
      <img
        :src="marganaLogo"
        alt=""
        aria-hidden="true"
        class="select-none"
        style="height: var(--margana-logo-h-medium); margin-left: calc(var(--margana-navbar-logo-x) * -2.5)"
        draggable="false"
      />
    </div>


    <!-- Top anagram tiles (draggable if revealed and not consumed) -->
    <div id="anagram-bank-area" v-if="topAnagram || (endOfGame && getFinalLetters().length)" class="max-w-full px-0 margana-anagram-inner">
      <div v-if="!endOfGame" class="tiles-row flex flex-wrap justify-center max-w-full px-2" :class="gapClass">
        <div v-for="(origIdx, dispIdx) in topOrder" :key="'top-'+dispIdx"
             :id="`anagram-tile-${origIdx}`"
             :draggable="!props.readonly && !consumedMask[origIdx] && anagramRevealMask[origIdx]"
             :data-dnd-top-index="dispIdx"
             @dragstart="(!props.readonly && !consumedMask[origIdx] && anagramRevealMask[origIdx]) ? handleTopDragStart(topAnagram[origIdx], origIdx, dispIdx, $event) : $event.preventDefault()"
             @dragend="handleDragEnd"
             @dragover.prevent="allowDrop($event)"
             @dragenter="onDragEnterTop(dispIdx)"
             @dragleave="onDragLeaveTop(dispIdx)"
             @drop="handleDropOnTop(dispIdx, $event)"
             @touchstart.prevent="(!props.readonly && !consumedMask[origIdx] && anagramRevealMask[origIdx]) ? onTouchStartTop(topAnagram[origIdx], origIdx, dispIdx, $event) : $event.preventDefault()"
             @touchmove.prevent="onTouchMove($event)"
             @touchend.prevent="onTouchEnd($event)"
             :aria-grabbed="!!draggedLetter"
             :class="[
              'tile margana-anagram-tile relative flex items-center justify-center rounded-lg sm:rounded-xl bg-gradient-to-tr from-purple-600 to-orange-600 text-white tracking-widest shadow transition-opacity transition-transform duration-150 pb-1',
              tileSizeClass,
              tileTextClass,
              consumedMask[origIdx] ? 'opacity-20 cursor-default' : (anagramRevealMask[origIdx] ? (props.readonly ? 'cursor-default' : 'cursor-grab active:cursor-grabbing') : 'cursor-not-allowed'),
              (!anagramRevealMask[origIdx] || props.readonly) ? 'pointer-events-none' : '',
              deniedBounceIndex === dispIdx ? 'animate-snapback' : '',
              anagramRevealMask[origIdx] ? 'opacity-100' : 'opacity-30',
              (hoverTopIndex === dispIdx && draggedLetter && anagramRevealMask[origIdx]) ? 'scale-125 sm:scale-110 landscape:scale-110 sm:landscape:scale-105 ring-4 ring-violet-300 ring-offset-2 ring-offset-transparent' : '',
              anagramHighlighted ? 'ring-4 ring-violet-300' : ''
             ]">
          <div v-if="pulseTopIndices.has(origIdx)" class="ring-4 ring-violet-300 pointer-events-none absolute inset-0 rounded-lg z-40"></div>
          <template v-if="!consumedMask[origIdx]">
            <span class="pointer-events-none">{{ topAnagram[origIdx] }}</span>
            <span class="score-badge pointer-events-none absolute bottom-0.5 right-0.5 font-semibold opacity-90 z-10"
                  :class="labelTextClass">
              {{ scoreFor(topAnagram[origIdx]) }}
            </span>
          </template>
        </div>
      </div>

      <div v-if="props.showCoachArrow" class="flex justify-center mt-1 mb-1 z-10">
        <div class="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[linear-gradient(45deg,rgb(35,141,132)_10%,rgb(250,204,21)_90%)] flex items-center justify-center shadow-md pointer-events-none select-none">
          <svg class="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 9l7 7 7-7" />
          </svg>
        </div>
      </div>

      <!-- Placeholder/builder row (droppable) -->
      <div id="anagram-builder-area" v-if="!endOfGame" class="builder-row margana-anagram-row-gap flex flex-wrap justify-center max-w-full px-2 relative"
           :class="[
             shakeRow === -1 ? 'animate-shake' : '',
             gapClass
           ]">
        <div v-for="i in topAnagram.length" :key="'top-empty-'+i"
             :id="`builder-slot-${i-1}`"
             :draggable="!props.readonly && !!placeholderLetters[i-1]"
             :data-dnd-builder-index="i-1"
             @dragstart="(!props.readonly && placeholderLetters[i-1]) ? handleBuilderDragStart(i-1, $event) : $event.preventDefault()"
             @dragend="handleDragEnd"
             @dragover.prevent="allowDrop($event)"
             @dragenter="onDragEnterBuilder(i-1)"
             @dragleave="onDragLeaveBuilder(i-1)"
             @drop="handleDropOnPlaceholder(i-1, $event)"
             @touchstart.prevent="(!props.readonly && placeholderLetters[i-1]) ? onTouchStartBuilder(i-1, $event) : $event.preventDefault()"
             @touchmove.prevent="onTouchMove($event)"
             @touchend.prevent="onTouchEnd($event)"
             :class="[
              'slot margana-anagram-tile relative flex items-center justify-center rounded-lg sm:rounded-xl tracking-widest shadow transition-opacity transition-transform duration-150 pb-1',
              tileSizeClass,
              tileTextClass,
              boughtMarks[i-1]
                ? 'bg-gradient-to-tr from-purple-500 to-fuchsia-600'
                : 'bg-gradient-to-tr from-purple-600 to-orange-600',
              builderError ? 'text-red-700' : 'text-white',
              'opacity-100',
              !!placeholderLetters[i-1] ? (props.readonly ? 'cursor-default' : 'cursor-grab active:cursor-grabbing') : 'cursor-default',
              props.readonly ? 'pointer-events-none' : '',
              deniedBuilderBounceIndex === (i-1) ? 'animate-snapback' : '',
              (hoverBuilderIndex === (i-1) && draggedLetter) ? 'scale-125 sm:scale-110 landscape:scale-110 sm:landscape:scale-105 ring-4 ring-violet-300 ring-offset-2 ring-offset-transparent' : '',
              anagramHighlighted ? 'ring-4 ring-violet-300' : ''
             ]">
          <div v-if="pulseBuilderIndices.has(i-1)" class="ring-4 ring-violet-300 pointer-events-none absolute inset-0 rounded-lg z-40"></div>
          <template v-if="placeholderLetters[i-1]">
            <span class="pointer-events-none">{{ placeholderLetters[i-1] }}</span>
            <span class="score-badge pointer-events-none absolute bottom-0.5 right-0.5 font-semibold opacity-90 z-10"
                  :class="labelTextClass">
              {{ scoreFor(placeholderLetters[i-1]) }}
            </span>
          </template>
        </div>
      </div>

      <!-- Bottom controls row: center Shuffle/Reset; allow right-aligned custom controls via slot -->
      <div v-if="topAnagram && !endOfGame" v-show="props.showControls" class="controls margana-controls-wrap w-full px-2 flex flex-nowrap items-center justify-between" :style="{ gap: 'var(--margana-btn-gap)', marginTop: 'var(--margana-anagram-mb)' }">

        <!-- Center controls: Shuffle + Reset -->
        <div class="flex items-center min-w-0" :style="{ gap: 'var(--margana-btn-gap)' }">
          <button
            id="margana-anagram-reset-btn"
            @click="resetAnagramBuilder"
            @touchstart="onPressStart"
            @touchend="onPressEnd"
            @touchcancel="onPressEnd"
            title="Reset: move all letters back to the anagram row"
            aria-label="Reset the builder to move all letters back to the anagram row"
            class="btn-common-button controls-btn relative"
            :class="[controlsBtnSizeClass, { 'pointer-events-none': props.readonly }]">
            Reset
            <div v-if="highlightAction === 'margana-anagram-reset-btn'" class="absolute inset-0 rounded-full ring-4 ring-violet-300 pointer-events-none z-10"></div>
          </button>
          <div class="relative">
            <ShuffleButton
              id="margana-anagram-shuffle-btn"
              :disabled="(topAnagram?.length || 0) < 2"
              :readonly="props.readonly"
              :size="props.size"
              @shuffle="shuffleTopRow"
            />
            <div v-if="highlightAction === 'margana-anagram-shuffle-btn'" class="absolute inset-0 rounded-full ring-4 ring-violet-300 pointer-events-none z-10"></div>
          </div>
          <div class="relative inline-block">
            <button
              id="margana-anagram-verify-btn"
              @click="verifyAnagram"
              :disabled="!canVerifyAnagram || isVerifyAnagram"
              aria-label="Verify anagram is a valid word"
              class="btn-common-button controls-btn relative"
              :class="[controlsBtnSizeClass, { 'pointer-events-none': props.readonly }]"
            >
              Verify
              <div v-if="highlightAction === 'margana-anagram-verify-btn'" class="absolute inset-0 rounded-full ring-4 ring-violet-300 pointer-events-none z-10"></div>
            </button>

            <div
              v-if="verifyOkVisible"
              class="pointer-events-none absolute right-2 bottom-0 translate-x-1/2 translate-y-1/2
                     h-6 w-6 sm:h-7 sm:w-7 rounded-full shadow-md
                     flex items-center justify-center font-bold text-white text-sm sm:text-base
                     bg-[linear-gradient(45deg,rgb(35,141,132)_10%,rgb(250,204,21)_90%)]"
              aria-hidden="true"
            >
              ✓
            </div>
          </div>


        </div>
        <!-- Right slot: consumers can inject buttons (e.g., Buy) aligned to the far right -->
        <div class="flex items-center flex-shrink-0">
          <slot name="right-controls" :controlsBtnSizeClass="controlsBtnSizeClass"></slot>
        </div>
      </div>


      <!-- End-of-game display: show only filled boxes (no DnD) -->
      <div v-else class="mt-2 flex justify-center"
           :class="gapClass">
        <div v-for="(L, idx) in getFinalLetters()" :key="'final-'+idx"
             class="tile relative flex items-center justify-center rounded-lg sm:rounded-xl bg-gradient-to-tr from-purple-600 to-orange-600 text-white font-semibold shadow select-none pb-1"
             :class="[
               finalTileSizeClass,
               finalTextClass,
               anagramHighlighted ? 'ring-4 ring-violet-300' : ''
             ]">
          <span class="pointer-events-none">{{ L }}</span>
          <span class="score-badge pointer-events-none absolute bottom-0.5 right-0.5 text-[10px] sm:text-[12px] landscape:text-[9px] sm:landscape:text-[11px] font-semibold opacity-90 z-10">
            {{ scoreFor(L) }}
          </span>
        </div>
      </div>
    </div>

    <!-- Note: Shuffle and Reset are now placed under the anagram rows in all modes -->

    <!-- Floating drag avatar for touch devices -->
    <Teleport to="body">
      <div v-if="isTouchDragging && draggedLetter"
           class="absolute z-[9999] pointer-events-none"
           :style="{ left: touchX + 'px', top: touchY + 'px', transform: 'translate(-50%, -55%)' }">
        <div class="drag-avatar margana-anagram-avatar flex items-center justify-center rounded-lg bg-gradient-to-tr from-purple-600 to-orange-600 text-white font-semibold text-base sm:text-xl md:text-xl shadow-2xl pb-1">
          <span class="pointer-events-none select-none">{{ draggedLetter }}</span>
          <span class="pointer-events-none absolute bottom-1 right-1 text-[9px] sm:text-[11px] font-semibold opacity-90 z-10 score-badge">
            {{ scoreFor(draggedLetter) }}
          </span>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>

.controls-btn {
  transition: transform 120ms ease, filter 120ms ease, box-shadow 120ms ease;
  will-change: transform, filter;
}
.controls-btn:active,
.controls-btn.is-pressed {
  transform: scale(0.96);
  filter: brightness(1.15) saturate(1.08);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.15), 0 6px 14px rgba(0,0,0,0.35);
}
/* Keep disabled state calm and suppress pressed feedback */
.controls-btn:disabled,
.controls-btn[disabled] {
  transform: none !important;
  filter: none !important;
  box-shadow: none;
}

/* Respect reduced motion */
@media (prefers-reduced-motion: reduce) {
  .controls-btn { transition: filter 120ms ease, box-shadow 120ms ease; }
  .controls-btn:active,
  .controls-btn.is-pressed { transform: none; }
}
</style>

<style scoped>
@keyframes shake { 10%, 90% { transform: translate3d(-1px, 0, 0); } 20%, 80% { transform: translate3d(2px, 0, 0); } 30%, 50%, 70% { transform: translate3d(-4px, 0, 0); } 40%, 60% { transform: translate3d(4px, 0, 0); } }
.animate-shake { animation: shake 0.6s both; }
@keyframes snapback { from { transform: translateY(-6px); } to { transform: translateY(0); } }
.animate-snapback { animation: snapback 0.25s ease-out; }

/* Removed previous landscape-mode upscaling so Tailwind landscape utilities can take effect */
</style>
