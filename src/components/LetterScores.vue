<template>
  <BaseModal
      :show="showLetterScores"
      title=""
      :landscapeMobileMode="landscapeMobileMode"
      @close="onClose"
  >
    <template #header-actions>
      <!-- Single toggle button -->
      <button
          type="button"
          @click="toggleSort"
          class="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm shadow ring-1 ring-white/20 transition"
      >
        <!-- show the *other* option -->
        <span v-if="sortMode === 'alpha'">
          Sort by high score
        </span>
        <span v-else>
          Sort A → Z
        </span>
      </button>
    </template>
    <div class="flex flex-col gap-4">
      <div class="grid grid-cols-6 sm:grid-cols-7 gap-1 justify-items-center">
        <div
            v-for="item in sortedLetters"
            :key="item.letter"
            class="letter-score-tile relative flex items-center justify-center
               bg-gradient-to-tr from-pink-500 to-yellow-400
               rounded-xl shadow-xl text-sm font-medium"
        >
          <span class="letter-score-letter font-semibold">
            {{ item.letter }}
          </span>
          <span
              class="letter-score-score absolute bottom-1 right-1 font-semibold text-white"
          >
            {{ item.score }}
          </span>
        </div>
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import {computed, ref} from 'vue'
import BaseModal from './BaseModal.vue'

const props = withDefaults(
    defineProps<{
      showLetterScores: boolean
      landscapeMobileMode?: boolean
    }>(),
    {
      landscapeMobileMode: false,
    }
)

const emit = defineEmits<{ (e: 'update:showLetterScores', value: boolean): void }>()

type SortMode = 'alpha' | 'score'
const sortMode = ref<SortMode>('score')

const LETTER_SCORES = [
  {letter: 'A', score: 3},
  {letter: 'B', score: 7},
  {letter: 'C', score: 4},
  {letter: 'D', score: 4},
  {letter: 'E', score: 2},
  {letter: 'F', score: 7},
  {letter: 'G', score: 5},
  {letter: 'H', score: 6},
  {letter: 'I', score: 2},
  {letter: 'J', score: 12},
  {letter: 'K', score: 8},
  {letter: 'L', score: 4},
  {letter: 'M', score: 6},
  {letter: 'N', score: 3},
  {letter: 'O', score: 4},
  {letter: 'P', score: 5},
  {letter: 'Q', score: 13},
  {letter: 'R', score: 3},
  {letter: 'S', score: 2},
  {letter: 'T', score: 3},
  {letter: 'U', score: 5},
  {letter: 'V', score: 8},
  {letter: 'W', score: 8},
  {letter: 'X', score: 12},
  {letter: 'Y', score: 7},
  {letter: 'Z', score: 12},
] as const

const sortedLetters = computed(() => {
  const arr = [...LETTER_SCORES]
  if (sortMode.value === 'alpha') {
    return arr.sort((a, b) => a.letter.localeCompare(b.letter))
  }

  // score desc, then letter asc
  return arr.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.letter.localeCompare(b.letter)
  })
})

function toggleSort() {
  sortMode.value = sortMode.value === 'alpha' ? 'score' : 'alpha'
}

function onClose() {
  emit('update:showLetterScores', false)
}
</script>

<style scoped>
.letter-score-tile {
  width: 35px;
  height: 38px;
}

.letter-score-letter {
  font-size: 1rem;
}

.letter-score-score {
  font-size: 0.5rem;
}

@media (min-width: 640px) {
  .letter-score-tile {
    width: 40px;
    height: 46px;
  }

  .letter-score-letter {
    font-size: 1.1rem;
  }

  .letter-score-score {
    font-size: 0.55rem;
  }
}
</style>
