<script setup lang="ts">
defineProps<{
  show: boolean
  title: string
  message?: string
  confirmLabel: string
  confirmVariant?: 'danger' | 'primary'
  loading?: boolean
  loadingLabel?: string
  cancelLabel?: string
}>()

defineEmits<{
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()
</script>

<template>
  <Teleport to="body">
    <div v-if="show"
         class="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div class="bg-gradient-to-br from-gray-900 via-purple-900 to-indigo-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-white/5">
        <h3 class="text-white font-bold text-lg mb-2">{{ title }}</h3>
        
        <div class="text-white/60 text-sm mb-6">
          <slot>
            <p v-if="message">{{ message }}</p>
          </slot>
        </div>

        <div v-if="loading" class="flex items-center justify-center">
          <div class="dots-loader" role="status" aria-label="Loading">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </div>
        </div>
        <div v-else class="flex items-center justify-center gap-3">
          <button
            @click="$emit('confirm')"
            class="btn-common-button-small"
          >
            {{ confirmLabel }}
          </button>
          <button
            @click="$emit('cancel')"
            class="btn-common-button-small"
          >
            {{ cancelLabel || 'Cancel' }}
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
