<script setup>
import { computed } from 'vue'

const emit = defineEmits(['update:modelValue', 'change'])

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  onLabel: { type: String, default: 'On' },
  offLabel: { type: String, default: 'Off' },
  size: { type: String, default: 'md' }, // 'sm' | 'md' | 'lg'
  ariaLabel: { type: String, default: 'Toggle' },
})

const isOn = computed(() => !!props.modelValue)

const sizeMap = {
  // Slightly reduced heights and thumb sizes for a slimmer appearance
  // Add matching min-w to keep the toggle a fixed size and prevent flex shrink when text is long.
  // Small size: per request, track is exactly 3rem wide; adjust thumb travel to match
  sm: { track: 'w-[3rem] min-w-[3rem] h-5', thumbOn: 'translate-x-[28px]', thumbOff: 'translate-x-0.1', thumb: 'h-5 w-5', text: 'text-[10px]' },
  md: { track: 'w-16 min-w-[4rem] h-7', thumbOn: 'translate-x-8', thumbOff: 'translate-x-1', thumb: 'h-6 w-6', text: 'text-[10px]' },
  lg: { track: 'w-20 min-w-[5rem] h-9', thumbOn: 'translate-x-10', thumbOff: 'translate-x-1.5', thumb: 'h-8 w-8', text: 'text-xs' },
}

const sz = computed(() => sizeMap[props.size] || sizeMap.md)

function toggle() {
  if (props.disabled) return
  const next = !props.modelValue
  emit('update:modelValue', next)
  emit('change', next)
}

function onKeydown(e) {
  if (props.disabled) return
  if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Enter') {
    e.preventDefault()
    toggle()
  }
}
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="isOn ? 'true' : 'false'"
    :aria-label="ariaLabel"
    :disabled="disabled"
    @click="toggle"
    @keydown="onKeydown"
    class="relative inline-flex items-center rounded-full transition-colors duration-300 ease-out focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-transparent focus:ring-indigo-300 select-none shadow ring-1 ring-white/20 shrink-0 flex-none touch-manipulation"
    :class="[
      sz.track,
      disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
      isOn
        ? 'bg-gradient-to-tr from-[rgb(255,72,153)] to-[rgb(250,204,21)] hover:from-[rgb(255,110,175)] hover:to-[rgb(255,220,80)]'
        : 'bg-white/15 hover:bg-white/25'
    ]"
  >

    <!-- Thumb -->
    <span
      class="inline-block transform rounded-full bg-white shadow-md transition-transform duration-300 ease-out"
      :class="[ sz.thumb, isOn ? sz.thumbOn : sz.thumbOff ]"
      aria-hidden="true"
    />
  </button>
</template>

<style scoped>
@media (prefers-reduced-motion: reduce) {
  .transition,
  .transition-colors,
  .transform {
    transition: none !important;
  }
}
</style>
