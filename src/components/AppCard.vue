<script setup>
const props = defineProps({
  title: { type: String, default: '' },
  showDot: { type: Boolean, default: true },
  // Deprecated: avoid in new code; kept for back-compat while migrating usage sites
  containerClass: { type: String, default: '' },
  bodyClass: { type: String, default: '' },
  padded: { type: Boolean, default: true },
})

// Declare an event the parent can listen for
const emit = defineEmits([])

</script>

<template>
  <div class="app-card w-full bg-white/10 backdrop-blur rounded-2xl shadow-md border border-white/10 mb-4"
      :class="[padded ? 'has-padding' : '', containerClass]">

    <div class="text-white/90 mb-1 flex items-start gap-2">
      <span v-if="showDot" class="inline-block w-2 h-2 mt-1 rounded-full bg-gradient-to-tr from-purple-500 to-orange-500 shadow shrink-0"></span>
      <div class="font-semibold flex-1">
        <slot name="title">{{ title }}</slot>
      </div>
      <div class="ml-auto flex items-center gap-2">
      </div>
      <slot name="header-right" />
    </div>
    <div :class="bodyClass">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.app-card {
  box-sizing: border-box;
  margin-left: auto;
  margin-right: auto;
  /* optional: let it fill its container but not exceed your desired max */
  width: 100%;
  max-width: 100%;
}

.has-padding { padding: 0.75rem; }

@media (max-width: 480px) {
  .app-card { max-width: 400px; }
  .has-padding { padding: 0.5rem; }
}

@media (min-width: 481px) and (max-width: 768px) {
  .app-card { max-width: 460px; }
}

@media (min-width: 769px) and (max-width: 1100px) {
  .app-card { max-width: 550px; }
}

/* Add a desktop rule if you want it constrained/centered there too */
@media (min-width: 1101px) {
  .app-card { max-width: 1024px; } /* or whatever you want */
}
</style>
