<script setup>
import { computed } from 'vue'
import { useUserAchievements } from '@/composables/useUserAchievements'

const props = defineProps({
  userBadges: { type: Array, default: () => [] },
  currentWeekId: { type: String, default: '' }
})

const { highestScoreEver, highestWeeklyScoreEver, lastWeeksRanking } = useUserAchievements(
  computed(() => props.userBadges),
  computed(() => props.currentWeekId)
)
const hasLastWeeksRanking = computed(
  () => lastWeeksRanking.value && lastWeeksRanking.value !== 'Unranked'
)
const highestWeeklyScoreEverLabel = computed(() => {
  return new Intl.NumberFormat('en-GB').format(highestWeeklyScoreEver.value || 0)
})
</script>

<template>
  <div
      v-if="highestScoreEver > 0 || highestWeeklyScoreEver > 0 || lastWeeksRanking"
      class="flex flex-col gap-2 py-2 px-2 w-full"
  >
    <div class="flex flex-col sm:flex-row items-start sm:justify-start gap-y-2 gap-x-2 w-full">
      <!-- Highest Score -->
      <div v-if="highestScoreEver > 0" class="flex items-center justify-start gap-1 w-full sm:flex-1 min-w-0">
        <div class="w-[4rem] text-left font-medium text-sm text-indigo-100/80 text-nowrap">
          <div>Highest</div>
          <div>score ever</div>
        </div>
        <div class="flex-1 min-w-0 ml-auto sm:ml-0 text-right text-3xl sm:text-4xl self-end leading-none tabular-nums">
          <span class="font-extrabold bg-clip-text text-transparent bg-gradient-to-tr from-purple-500 to-orange-500">{{ highestScoreEver }}</span>
        </div>
      </div>
    </div>

    <div class="flex flex-col sm:flex-row items-start sm:justify-start gap-y-2 gap-x-2 w-full">
      <!-- Highest Weekly Score -->
      <div v-if="highestWeeklyScoreEver > 0" class="flex items-center justify-start gap-1 w-full sm:flex-1 min-w-0">
        <div class="w-[7rem] text-left font-medium text-sm text-indigo-100/80 text-nowrap">
          <div>Highest</div>
          <div>weekly score</div>
        </div>
        <div class="flex-1 min-w-0 ml-auto sm:ml-0 text-right text-3xl sm:text-4xl self-end leading-none tabular-nums">
          <span class="font-extrabold bg-clip-text text-transparent bg-gradient-to-tr from-purple-500 to-orange-500">{{ highestWeeklyScoreEverLabel }}</span>
        </div>
      </div>
    </div>

    <div class="flex flex-col sm:flex-row items-start sm:justify-start gap-y-2 gap-x-2 w-full">
      <!-- Current ranking -->
      <div v-if="highestScoreEver > 0" class="flex items-center justify-start gap-1 w-full sm:flex-1 min-w-0">
        <div class="w-[4rem] text-left font-medium text-sm text-indigo-100/80 text-nowrap">
          <div>Global</div>
          <div>ranking</div>
        </div>
        <div v-if="hasLastWeeksRanking" class="flex-1 min-w-0 ml-auto sm:ml-0 text-right text-3xl sm:text-4xl self-end leading-none tabular-nums">
          <span class="relative text-xl sm:text-2xl -top-2 sm:-top-3 font-extrabold bg-clip-text text-transparent bg-gradient-to-tr from-purple-500 to-orange-500">#</span>
          <span class="font-extrabold bg-clip-text text-transparent bg-gradient-to-tr from-purple-500 to-orange-500">{{ lastWeeksRanking }}</span>
        </div>
        <div v-else class="flex-1 min-w-0 ml-auto sm:ml-0 text-right text-1xl sm:text-2xl self-end leading-none tabular-nums">
          <span class="font-extrabold bg-clip-text text-transparent bg-gradient-to-tr from-purple-500 to-orange-500">Unranked</span>
        </div>
      </div>
    </div>
    <div v-if="!hasLastWeeksRanking" class="mt-1 text-[10px] italic text-indigo-100/70">
      At least one game required in previous week
    </div>
  </div>
</template>


<style scoped>
.tabular-nums {
  font-variant-numeric: tabular-nums;
}
</style>
