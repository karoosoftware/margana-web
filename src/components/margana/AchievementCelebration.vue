<script setup>
import { computed, onMounted, onBeforeUnmount } from 'vue'
import BadgeIcon from '../BadgeIcon.vue'
import { XMarkIcon } from '@heroicons/vue/20/solid'
import confetti from 'canvas-confetti'
import { useRegisteredMetrics } from '@/composables/useRegisteredMetrics'

const formatNumber = (n) => new Intl.NumberFormat('en-GB').format(n)

const props = defineProps({
  achievements: { type: Array, default: () => [] }
})

const emit = defineEmits(['close'])
const { acknowledgeAchievement } = useRegisteredMetrics()

let acknowledgeTimeout = null

const celebratoryTitle = computed(() => {
  const titles = [
    "New achievements",
  ]
  return titles[Math.floor(Math.random() * titles.length)]
})

const toSentenceCase = (str) => {
  if (!str) return ''
  const words = str.replace(/_/g, ' ').toLowerCase().split(' ')
  const adjusted = words.map(w => (w === 'margana' ? 'Margana' : w))
  const sentence = adjusted.join(' ')
  return sentence.replace(/^\w/, c => c.toUpperCase())
}

const handleAcknowledge = async () => {
  if (acknowledgeTimeout) {
    clearTimeout(acknowledgeTimeout)
    acknowledgeTimeout = null
  }
  // Acknowledge all achievements
  for (const ach of props.achievements) {
    await acknowledgeAchievement(ach)
  }
}

onMounted(() => {
  if (props.achievements.length > 0) {
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#238d84', '#e879f9', '#ec4899', '#f59e0b', '#f97316', '#9333ea', '#6366f1']
    })

    // Automatically acknowledge after a short delay so the user can see the celebration
    acknowledgeTimeout = setTimeout(() => {
      handleAcknowledge()
    }, 2000)
  }
})

onBeforeUnmount(() => {
  if (acknowledgeTimeout) {
    handleAcknowledge()
  }
})

</script>

<template>
  <div
    v-if="achievements.length > 0"
    class="w-full rounded-2xl p-2 relative border border-white/10 bg-purple-900"
  >

    <div class="relative z-10">
      <div class="text-center mb-1">
        <h2 class="text-indigo-100/80 font-medium text-lg">
          {{ celebratoryTitle }}
        </h2>
      </div>

      <!-- Achievements Display -->
      <div class="flex flex-wrap items-end justify-center gap-x-12 gap-y-10 py-2">
        <div v-for="ach in achievements" :key="ach.type + (ach.name || ach.last_milestone_name)" class="flex flex-col items-center group">
          
          <template v-if="ach.prefix === 'BADGE'">
             <div class="relative transition-transform duration-300">
               <BadgeIcon 
                  :type="ach.type" 
                  :currentCount="ach.count" 
                  :milestoneCount="ach.milestone"
                  :milestoneName="ach.name || ach.last_milestone_name"
                  class="my-2"
                />
             </div>
          </template>

          <template v-else>
            <!-- Text Achievement Visual -->
            <div class="w-24 h-24 sm:w-28 sm:h-28 flex flex-col items-center justify-center text-center transition-transform duration-300">
               <div class="font-medium tabular-nums leading-none text-3xl sm:text-4xl">
                  <template v-if="ach.type === 'CURRENT_RANKING'">
                    <span class="relative text-xl sm:text-2xl -top-2 sm:-top-3 font-extrabold bg-clip-text text-transparent bg-gradient-to-tr from-purple-500 to-orange-500">#</span>
                  </template>
                  <span class="font-extrabold bg-clip-text text-transparent bg-gradient-to-tr from-purple-500 to-orange-500">{{ formatNumber(ach.count) }}</span>
               </div>
            </div>
          </template>

          <div class="text-center">
            <h3 class="font-medium text-sm text-indigo-100/80 whitespace-nowrap">
              {{ ach.title || toSentenceCase(ach.type) }}
            </h3>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tabular-nums {
  font-variant-numeric: tabular-nums;
}

@keyframes bounce-slow {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}
.animate-bounce-slow {
  animation: bounce-slow 3s ease-in-out infinite;
}

@keyframes fade-in {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in {
  animation: fade-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
</style>
