<script setup>
import { computed } from 'vue'
import NumberFlow from '@number-flow/vue'

const props = defineProps({
  score: { type: Number, default: null },
  enabled: { type: Boolean, default: true },
  reels: { type: Number, default: 3 },
  // Kept for API compatibility; NumberFlow handles animation internally
  stepMs: { type: Number, default: 30 },
  maxSteps: { type: Number, default: 250 },
  size: { type: String, default: 'large' }, // small | medium | large
})

// Clamp and normalize the incoming score
const value = computed(() => {
  const n = typeof props.score === 'number' && isFinite(props.score) ? Math.floor(props.score) : 0
  const max = Math.pow(10, Math.max(1, props.reels)) - 1
  return Math.min(Math.max(0, n), max)
})

// Intl formatting to force a minimum number of integer digits (reels) and no grouping
// const format = computed(() => ({ minimumIntegerDigits: Math.max(1, props.reels), useGrouping: false }))

const format = computed(() => ({
  useGrouping: false, // no thousand separators
  // no minimumIntegerDigits → 90 stays 90
}))

const sizeClass = computed(() => {
  switch (props.size) {
    case 'tiny': return 'margana-spinner-text-tiny'
    case 'small': return 'margana-spinner-text-small'
    case 'medium': return 'margana-spinner-text-medium'
    case 'large': return 'margana-spinner-text-large'
    case 'xl': return 'text-6xl'
    // Backward compatibility
    case 'sm': return 'margana-spinner-text-small'
    case 'md': return 'margana-spinner-text-medium'
    case 'lg': return 'margana-spinner-text-large'
    default: return 'margana-spinner-text-large'
  }
})
</script>

<template>
  <div class="inline-flex items-center select-none" aria-live="polite" aria-atomic="true">
    <div class="flex items-center gap-1">
      <NumberFlow
        v-if="enabled"
        :value="value"
        :format="format"
        class="font-extrabold tracking-tight text-purple-500 drop-shadow-sm"
        :class="sizeClass"
      />
      <span v-else class="font-extrabold text-indigo-200" :class="sizeClass">{{ value }}</span>
    </div>
    <span class="sr-only">{{ value }}</span>
  </div>
</template>

<style scoped>
</style>
