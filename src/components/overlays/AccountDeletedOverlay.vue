<script setup>
import marganaLogoM from '@/assets/margana_m_logo.svg'

defineProps({
  show: { type: Boolean, default: false }
})

const emit = defineEmits(['close'])
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/15 backdrop-blur-md" aria-hidden="true" @click="emit('close')"></div>
      
      <!-- Modal Content -->
      <div 
        role="dialog" 
        aria-modal="true"
        class="relative w-full max-w-sm rounded-2xl bg-gradient-to-br from-gray-900 via-purple-900 to-indigo-900 text-white shadow-2xl ring-1 ring-white/20 p-8 transition-all duration-300"
      >
        <!-- Overspilling Logo (top-left) -->
        <img
          :src="marganaLogoM"
          alt="Margana"
          class="absolute -top-23 -left-18 w-50 h-50 z-[110] drop-shadow-2xl select-none pointer-events-none"
          draggable="false"
        />

        <!-- Close Button (X) -->
        <button
          @click="emit('close')"
          aria-label="Close"
          class="absolute top-4 right-4 text-white/50 hover:text-white transition-colors z-30"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div class="text-center space-y-6">
          <div class="space-y-4 pt-4">
            <h2 class="text-2xl font-bold tracking-tight">Account deleted</h2>
            <p class="text-indigo-100/90 leading-relaxed">
              Your account has been successfully deleted <br><br>
              Thank you for playing Margana<br> We're sorry to see you go and you're always welcome back!
            </p>
          </div>

          <button
            @click="emit('close')"
            class="btn-common-button"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
</style>
