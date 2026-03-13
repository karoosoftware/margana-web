<script setup>
defineProps({
  show: { type: Boolean, default: false },
  title: { type: String, default: '' },
  landscapeMobileMode: { type: Boolean, default: false },
  hideClose: { type: Boolean, default: false }
})

const emit = defineEmits(['close'])
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/15 backdrop-blur-sm" aria-hidden="true"></div>
      
      <!-- Modal Content -->
      <div 
        role="dialog" 
        aria-modal="true"
        :class="[
          'relative w-75 sm:w-100 max-w-2xl rounded-xl bg-gradient-to-br from-gray-900 via-purple-900 to-indigo-900 text-white shadow-xl ring-1 ring-white/10 max-h-[75vh] overflow-y-auto overflow-x-hidden transition-all duration-300',
          landscapeMobileMode ? 'text-scale-landscape' : ''
        ]"
      >
        <div class="p-5">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2 min-w-0">
              <h2 v-if="title" class="text-xl font-bold truncate">{{ title }}</h2>
              <slot name="header-actions"></slot>
            </div>
            <button
              v-if="!hideClose"
              @click="emit('close')"
              aria-label="Close"
              class="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              ✕
            </button>
          </div>
          
          <slot></slot>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.text-scale-landscape { font-size: 1.06rem; }
.text-scale-landscape h3 { font-size: 1.2rem; }
</style>
