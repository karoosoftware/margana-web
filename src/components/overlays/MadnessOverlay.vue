<script setup lang="ts">
import marganaLogoM from '@/assets/margana_m_logo.svg'

defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()
</script>

<template>
  <Teleport to="body">
    <div v-if="show"
         class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div class="relative w-full max-w-[280px] sm:max-w-[320px] margana-proportions">
        <!-- Gradient Box Banner -->
        <div class="relative px-6 py-8 rounded-3xl text-white bg-gradient-to-r from-fuchsia-600 via-violet-600 to-indigo-600 shadow-2xl text-center pointer-events-auto">

          <!-- Score Bubble -->
          <div class="absolute right-2 top-[98%] -translate-y-1/2 translate-x-[65%] h-8 w-12
          rounded-full shadow-lg flex items-center justify-center font-bold text-white text-base bg-[linear-gradient(45deg,rgb(35,141,132)_10%,rgb(250,204,21)_90%)] pointer-events-none">+30</div>

          <!-- Sticking-out Logo -->
          <img :src="marganaLogoM"
               class="absolute -translate-y-[65%] -translate-x-[60%] object-contain select-none pointer-events-none"
               style="height: var(--margana-logo-h-large); width: var(--margana-logo-h-large)" />

          <div class="text-center mb-4">
            <div class="font-semibold text-[18px] sm:text-xl">Margana madness day!</div>
          </div>

          <div class="text-[14px] sm:text-[14px] opacity-90">
            Create 8 connected letters in the <br> correct order to spell 'Margana'
          </div>

          <button 
            @click="emit('close')"
            class="btn-common-button mt-4 text-lg sm:text-base"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
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
.animate-fade-in {
  animation: fadeIn 0.3s ease-out forwards;
}
</style>
