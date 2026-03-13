<script setup>
import { computed } from 'vue'
// ValidWordsPanel.vue
// Purpose: Display the list of valid words discovered (and/or the builder word),
// allow highlighting them on the grid, and show per-word score and total score.
// Keeps all visuals responsive and preserves original styling.


const props = defineProps({
  items: { type: Array, default: () => [] },
  interactive: { type: Boolean, default: false },
  totalValidScore: { type: Number, default: 0 },
  selectedWord: { type: String, default: null },
  selectedWordScore: { type: Number, default: null },
})

const emit = defineEmits(['highlight', 'clear'])

const sortedItems = computed(() => {
  if (!props.items) return []
  const order = ['anagram', 'diagonal', 'row', 'palindrome', 'semordnilap', 'madness']
  
  return [...props.items].sort((a, b) => {
    const getCategory = (item) => {
      const word = String(item?.word || '').toLowerCase()
      if (item?.type === 'madness' || word === 'margana') return 'madness'
      if (item?.semordnilap) return 'semordnilap'
      if (item?.palindrome || word === 'palindrome') return 'palindrome'
      if (String(item?.type || '').toLowerCase() === 'row') return 'row'
      if (String(item?.type || '').toLowerCase() === 'diagonal') return 'diagonal'
      if (String(item?.type || '').toLowerCase() === 'anagram') return 'anagram'
      return 'standard'
    }

    const catA = getCategory(a)
    const catB = getCategory(b)
    const idxA = order.indexOf(catA)
    const idxB = order.indexOf(catB)
    
    // If both are in the same category or neither is in the order list, maintain relative order or put at end
    if (idxA === idxB) return 0
    if (idxA === -1) return 1
    if (idxB === -1) return -1
    return idxA - idxB
  })
})

// Compute a gentle variant within the same indigo/purple theme
function getCategoryInfo(item) {
  const word = String(item?.word || '').toLowerCase()
  const isPal = !!item?.palindrome || word === 'palindrome'
  const isSem = !!item?.semordnilap
  const isAna = String(item?.type || '').toLowerCase() === 'anagram'
  const isDiag = String(item?.type || '').toLowerCase() === 'diagonal'
  const isMadness = item?.type === 'madness' || word === 'margana'

  if (isMadness) {
    return {
      circle: 'bg-[linear-gradient(45deg,rgb(35,141,132)_10%,rgb(250,204,21)_90%)] shadow-lg shadow-yellow-500/20 ring-1 ring-yellow-400/30',
      text: 'text-white'
    }
  }
  if (isPal) {
    return {
      circle: 'from-fuchsia-600 via-pink-600 to-violet-700 shadow-lg shadow-fuchsia-500/30 ring-1 ring-fuchsia-400/20',
      text: 'text-white'
    }
  }
  if (isSem) {
    return {
      circle: 'from-amber-500 via-orange-500 to-rose-500 shadow-lg shadow-orange-500/30 ring-1 ring-orange-400/20',
      text: 'text-white'
    }
  }
  if (isAna) {
    return {
      circle: 'from-purple-600 to-orange-600 shadow-md ring-1 ring-purple-400/20',
      text: 'text-white'
    }
  }
  if (isDiag) {
    return {
      circle: 'from-purple-500 to-fuchsia-600 shadow-md ring-1 ring-purple-400/20',
      text: 'text-white'
    }
  }
  // Default - Standard word
  return {
    circle: 'from-indigo-500 to-violet-600 shadow-sm ring-1 ring-indigo-400/20',
    text: 'text-indigo-50'
  }
}

function displayScore(item) {
  if (item?.word?.toLowerCase() === 'palindrome') {
     return '??';
  }
  const s = Number(item?.score);
  return Number.isFinite(s) ? String(s) : '';
}

</script>

<template>
  <div v-if="items && items.length" class="mt-4 text-white text-sm w-full flex flex-col items-center">

    <div class="w-full max-w-[var(--margana-play-max)] mx-auto grid grid-cols-2 gap-x-4 gap-y-3 px-2 mb-2">
      <div
        v-for="(item, idx) in sortedItems"
        :key="'vw-item-'+idx"
        class="flex items-center gap-1 min-w-0"
      >
        <button
          v-if="interactive"
          type="button"
          @click="emit('highlight', item)"
          class="flex items-center gap-2 group focus:outline-none text-left min-w-0 w-full transition-all duration-200"
          :class="[
            (props.selectedWord === item.word && props.selectedWordScore === Number(item.score))
              ? 'rounded-lg px-2 -mx-2 py-1 -my-1'
              : 'hover:bg-white/5 rounded-lg px-2 -mx-2 py-1 -my-1'
          ]"
          :title="`${item.word} (${item.type} ${(item.index ?? 0) + 1}, ${item.direction})`"
        >
          <!-- Score Circle -->
          <div
            class="flex-none rounded-full bg-gradient-to-tr flex items-center justify-center shadow-md transition-transform group-hover:scale-110"
            style="width: var(--margana-postgame-valid-words-circle-size); height: var(--margana-postgame-valid-words-circle-size);"
            :class="getCategoryInfo(item).circle"
          >
            <span class="font-bold text-white leading-none" style="font-size: var(--margana-postgame-valid-words-score-font-size)">{{ displayScore(item) }}</span>
          </div>
          <!-- Word Text -->
          <span
            class="truncate text-indigo-50 group-hover:text-white transition-colors"
            style="font-size: var(--margana-postgame-valid-words-font-size)"
            :class="getCategoryInfo(item).text || 'font-semibold'"
          >
            {{ item.word }}
          </span>
        </button>

        <div
          v-else
          class="flex items-center gap-2 min-w-0 w-full"
          :title="`${item.word} (${item.type} ${(item.index ?? 0) + 1}, ${item.direction})`"
        >
          <!-- Score Circle -->
          <div
            class="flex-none rounded-full bg-gradient-to-tr flex items-center justify-center shadow-md"
            style="width: var(--margana-postgame-valid-words-circle-size); height: var(--margana-postgame-valid-words-circle-size);"
            :class="getCategoryInfo(item).circle"
          >
            <span class="font-bold text-white leading-none" style="font-size: var(--margana-postgame-valid-words-score-font-size)">{{ displayScore(item) }}</span>
          </div>
          <!-- Word Text -->
          <span
            class="truncate text-indigo-50"
            style="font-size: var(--margana-postgame-valid-words-font-size)"
            :class="getCategoryInfo(item).text || 'font-semibold'"
          >
            {{ item.word }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
