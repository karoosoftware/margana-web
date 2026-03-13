<script setup>
import { ref, computed } from 'vue'
import { useMarganaAuth, UserTier } from '@/composables/useMarganaAuth'

const props = defineProps({
  disabled: { type: Boolean, default: false },
  readonly: { type: Boolean, default: false },
  size: { type: String, default: 'large' }
})

const emit = defineEmits(['shuffle'])

const { userTier } = useMarganaAuth()

const sizeClass = computed(() => ({
  small: 'margana-controls-btn-small',
  medium: 'margana-controls-btn-medium',
  large: 'margana-controls-btn-large',
}[props.size] ?? 'margana-controls-btn-large'))

function handleShuffle() {
  // if (userTier.value === UserTier.GUEST) return
  emit('shuffle')
}

const isPressed = ref(false)
function onPressStart(e) { 
  if (props.readonly && e && !e.isTrusted) {
    // allow programmatic
  } else if (props.readonly) {
    return
  }
  isPressed.value = true 
}
function onPressEnd() { isPressed.value = false }
</script>

<!--Add this below to disable for the guest tier-->
<!--v-if="userTier !== UserTier.GUEST"-->
<template>
  <button
    @click="handleShuffle"
    @touchstart="onPressStart($event)"
    @touchend="onPressEnd"
    @touchcancel="onPressEnd"
    :disabled="disabled"
    title="Shuffle the anagram letters"
    aria-label="Shuffle the anagram letters"
    class="btn-common-button controls-btn"
    :class="[sizeClass, { 'is-pressed': isPressed, 'pointer-events-none': readonly }]"
  >
    Shuffle
  </button>
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
.controls-btn:disabled,
.controls-btn[disabled] {
  transform: none !important;
  filter: none !important;
  box-shadow: none;
}

@media (prefers-reduced-motion: reduce) {
  .controls-btn { transition: filter 120ms ease, box-shadow 120ms ease; }
  .controls-btn:active,
  .controls-btn.is-pressed { transform: none; }
}
</style>
