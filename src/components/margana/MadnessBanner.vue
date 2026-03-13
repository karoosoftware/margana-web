<script setup>
import { onBeforeUnmount, watch, toRef } from 'vue'
import { useOrientation } from '@/composables/useOrientation'
import marganaLogo from '@/assets/margana_m_logo.svg'
import marganaLogoFull from '@/assets/margana_full_logo.svg'
import marganaLogoM from '@/assets/margana_m_logo.svg'

const props = defineProps({
  madnessFound: { type: Boolean, default: false },
  madnessAvailable: { type: Boolean, default: false },
  endOfGame: { type: Boolean, default: false }
})

// Properly detect landscape mode to hide banner in immersive view
const { landscapeMobileMode } = useOrientation(toRef(props, 'endOfGame'))

// Toggle the 'has-special-banner' class only when the banner is actually visible in the NavBar.
// This ensures the hamburger only moves when the banner is there to overlap.
watch([() => props.madnessAvailable, landscapeMobileMode], ([avail, landscape]) => {
  if (avail && !landscape) {
    document.body.classList.add('has-special-banner')
  } else {
    document.body.classList.remove('has-special-banner')
  }
}, { immediate: true })

onBeforeUnmount(() => {
  document.body.classList.remove('has-special-banner')
})
</script>

<template>
  <Teleport to="#navbar-special-area" v-if="madnessAvailable && !landscapeMobileMode">
    <div class="madness-banner-nav-wrapper w-[260px] sm:w-[320px] mt-8 sm:mt-10 mb-2 sm:mb-4 pointer-events-none margana-proportions">

      <!-- Gradient Box Banner -->
      <div class="relative px-4 py-2 rounded-2xl text-white bg-gradient-to-r from-fuchsia-600 via-violet-600 to-indigo-600 shadow-lg text-center pointer-events-auto">

        <!-- Score Bubble (Playing mode only) -->
        <div v-if="!props.endOfGame" class="absolute right-2 sm:right-4 top-[90%] -translate-y-1/2 translate-x-[65%] sm:translate-x-1/2 h-8 w-12
        rounded-full shadow-lg flex items-center justify-center font-bold text-white text-base bg-[linear-gradient(45deg,rgb(35,141,132)_10%,rgb(250,204,21)_90%)] pointer-events-none">+30</div>

        <!-- Found Bubble (End of game only, if found) -->
        <div v-else-if="props.madnessFound" class="absolute right-5 sm:right-9 top-[90%] -translate-y-1/2 translate-x-1/2 h-6 w-20 sm:h-8 sm:w-25 rounded-full shadow-lg
         flex items-center justify-center font-bold text-white text-sm sm:text-base bg-[linear-gradient(45deg,rgb(35,141,132)_10%,rgb(250,204,21)_90%)] pointer-events-none">You did it!</div>

        <!-- Sticking-out Logo (Mirrored by Hamburger on the right) -->
        <img :src="marganaLogoM"
             class="absolute -translate-y-[50%] sm:-translate-y-[50%] -translate-x-[60%] sm:-translate-x-[60%] object-contain select-none pointer-events-none"
             style="height: var(--margana-logo-h-large); width: var(--margana-logo-h-large)" />

        <div class="text-center">
          <div class="font-semibold text-[14px] sm:text-[17px]">Margana madness day!</div>
        </div>

        <div class="text-[12px] sm:text-[14px] opacity-90">
          <template v-if="!props.endOfGame">Create 8 connected letters in the <br> correct order to spell 'Margana'</template>
          <template v-else-if="props.madnessFound">Congratulations!</template>
          <template v-else>Better luck next time!</template>
        </div>
      </div>

    </div>
  </Teleport>
</template>
