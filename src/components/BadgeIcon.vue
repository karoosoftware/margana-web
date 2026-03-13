<script setup>
import { computed, ref } from 'vue'
import { LockClosedIcon } from '@heroicons/vue/20/solid'
import badgeMilestones from '@/resources/badge-milestones.json'
import marganaLogo from '@/assets/margana_m_logo.svg'

const props = defineProps({
  type: { type: String, required: true }, // 'ANAGRAM_SOLVED', 'BEATEN_MARGANA', 'MADNESS_FOUND'
  currentCount: { type: Number, default: 0 },
  milestoneCount: { type: Number, required: true },
  previousMilestoneCount: { type: Number, default: 0 },
  milestoneName: { type: String, default: '' }
})

const badgeConfig = badgeMilestones

const isFlipped = ref(false)

const toggleFlip = () => {
  if (!isUnlocked.value) {
    isFlipped.value = !isFlipped.value
  }
}

const config = computed(() => {
  const typeKey = String(props.type || '').toLowerCase()
  return badgeConfig[typeKey] || badgeConfig.anagram_solved
})

const isUnlocked = computed(() => props.currentCount >= props.milestoneCount)

// Relative progress toward this specific milestone (resetting to 0 at each milestone)
const progressPercent = computed(() => {
  if (isUnlocked.value) return 100
  const range = props.milestoneCount - props.previousMilestoneCount
  if (range <= 0) return 0
  const progress = props.currentCount - props.previousMilestoneCount
  return Math.min(Math.max((progress / range) * 100, 0), 100)
})

// Points earned in this specific milestone range
const relativeCurrent = computed(() => {
  if (isUnlocked.value) return props.milestoneCount - props.previousMilestoneCount
  return Math.max(0, props.currentCount - props.previousMilestoneCount)
})

const relativeMilestone = computed(() => {
  return props.milestoneCount - props.previousMilestoneCount
})

const colorClass = computed(() => {
  const c = config.value.color
  // If it already contains bg-gradient-to- or is a custom gradient, use as is.
  // Otherwise, if it has from-, we add a default direction.
  if (c.includes('from-') && !c.includes('bg-gradient-to-')) {
    return `bg-gradient-to-br ${c}`
  }
  return c
})

const progressBarColorClass = computed(() => {
  const c = config.value.color
  if (c.startsWith('bg-[')) {
    // Custom arbitrary gradients are handled via inline style to ensure compatibility
    return ''
  }
  // Standard Tailwind gradients - standardized to horizontal for the bar
  return c.replace(/bg-gradient-to-(tr|br|tl|bl|t|b|l)/, 'bg-gradient-to-r')
})

const progressBarStyle = computed(() => {
  const style = { width: progressPercent.value + '%' }
  const c = config.value.color
  
  if (c.startsWith('bg-[')) {
    // Extract linear-gradient value and standardize angle for horizontal bar
    const gradient = c.match(/bg-\[(.*)\]/)?.[1]
    if (gradient) {
      // Replace Tailwind's space-placeholder (_) with actual spaces for inline style
      style.background = gradient.replace('45deg', '90deg').replace(/_/g, ' ')
    }
  }
  return style
})

</script>

<template>
  <div class="flex flex-col items-center gap-2 w-full" :style="{ maxWidth: 'var(--margana-badge-size)' }">
    <!-- Badge Container -->
    <div class="relative">
      <!-- Background Glow (for unlocked) -->
      <div
        v-if="isUnlocked"
        class="absolute rounded-full blur-xl opacity-20"
        :class="config.color"
        :style="{ inset: 'calc(var(--margana-badge-inset) * -2)' }"
      ></div>

      <!-- Main Coin Shape (Octagon) -->
      <div
        class="relative drop-shadow-[0_10px_25px_rgba(0,0,0,0.4)]"
        :style="{ width: 'var(--margana-badge-size)', height: 'var(--margana-badge-size)' }"
      >
        <!-- Outer Rim -->
        <div
          class="octagon absolute inset-0 flex items-center justify-center"
        >
          <!-- Inner Face -->
          <div v-if="isUnlocked" class="octagon absolute flex flex-col items-center justify-center overflow-hidden"
            :class="colorClass"
            :style="{ inset: 'var(--margana-badge-inset)' }"
          >
            <!-- Content for Unlocked Badge -->
            <div class="flex flex-col items-center" :style="{ gap: 'calc(var(--margana-badge-gap) * 0.75)' }">
              <!-- Logo -->
              <img
                  :src="marganaLogo"
                  alt="Margana"
                  class="w-full h-auto object-contain pointer-events-none"
                  :style="{ padding: 'var(--margana-badge-logo-pad)', transform: 'translateY(var(--margana-badge-logo-offset))' }"
              />

              <!-- Text -->
              <div class="flex flex-col items-center text-center" :style="{ transform: 'translateY(calc(var(--margana-badge-text-offset) * -1))' }">
                <div class="font-black text-white drop-shadow-md" :style="{ fontSize: 'var(--margana-badge-font-size)' }">
                  {{ milestoneName }}
                </div>
              </div>
            </div>
          </div>

          <!-- Locked Badge: 2-sided coin -->
          <div v-else class="coin-perspective absolute inset-0" :style="{ padding: 'var(--margana-badge-inset)' }">
            <div 
              class="coin-inner relative w-full h-full cursor-pointer transition-transform duration-700"
              :class="{ 'is-flipped': isFlipped }"
              @click="toggleFlip"
            >
              <!-- Front Side: Icon + Reveal Label -->
              <div class="coin-front octagon absolute inset-0 flex flex-col items-center justify-center bg-[#8b6aa8] border border-white/5 shadow-inner">
                <LockClosedIcon class="text-indigo-200/70" :style="{ height: 'calc(var(--margana-badge-icon-size) * 0.8)', width: 'calc(var(--margana-badge-icon-size) * 0.8)', marginBottom: 'calc(var(--margana-badge-gap) * 0.8)' }" />
                <div
                    class="font-black text-indigo-200/70"
                    :style="{ fontSize: 'calc(var(--margana-badge-font-size) * 0.7)' }"
                >
                  Show
                </div>
              </div>

              <!-- Back Side: Icon + Progress + Text + Count -->
              <div class="coin-back octagon absolute inset-0 flex flex-col items-center justify-center bg-[#8b6aa8] border border-white/5 shadow-inner">
                 <div
                    class="flex flex-col items-center justify-center w-full"
                    :style="{
                      paddingLeft: 'calc(var(--margana-badge-gap) * 0.75)',
                      paddingRight: 'calc(var(--margana-badge-gap) * 0.75)',
                      transform: 'translateY(var(--margana-badge-locked-offset))'
                    }"
                 >
                    <!-- Lock Icon -->
                    <LockClosedIcon class="text-indigo-200/70" :style="{ height: 'calc(var(--margana-badge-icon-size) * 0.7)', width: 'calc(var(--margana-badge-icon-size) * 0.7)', marginBottom: 'calc(var(--margana-badge-gap) * 0.8)' }" />

                   <!-- Internal Progress Bar -->
                   <div
                     class="bg-black/20 rounded-full overflow-hidden mx-auto"
                     :style="{
                       width: 'var(--margana-badge-pb-w)',
                       height: 'var(--margana-badge-pb-h)',
                       marginBottom: 'calc(var(--margana-badge-gap) * 0.9)',
                       transform: 'translateY(var(--margana-badge-pb-offset))'
                     }"
                   >
                     <div
                         class="h-full transition-all duration-1000 ease-out"
                         :class="progressBarColorClass"
                         :style="progressBarStyle"
                     ></div>
                   </div>

                    <div class="text-center">
                      <div
                        class="font-black text-indigo-200/70 leading-none"
                        :style="{
                          fontSize: 'calc(var(--margana-badge-font-size) * 0.95)',
                          marginBottom: '10px',
                          transform: 'translateY(var(--margana-badge-locked-text-offset))'
                        }"
                      >
                        {{ milestoneName }}
                      </div>
                      <!-- Number Count -->
<!--                      <div-->
<!--                        class="font-bold text-indigo-200/50 leading-none mb-1"-->
<!--                        :style="{ fontSize: 'calc(var(&#45;&#45;margana-badge-font-size) * 0.4)' }"-->
<!--                      >-->
<!--                        {{ relativeCurrent }} / {{ relativeMilestone }}-->
<!--                      </div>-->
                    </div>
                 </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.octagon {
  clip-path: polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%);
}

.coin-perspective {
  perspective: 1000px;
}

.coin-inner {
  transform-style: preserve-3d;
}

.is-flipped {
  transform: rotateY(180deg);
}

.coin-front, .coin-back {
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

.coin-back {
  transform: rotateY(180deg);
}
</style>
