<script setup>
import {ref, computed, watch} from 'vue'
import {
  RocketLaunchIcon,
  StarIcon,
  TrophyIcon
} from '@heroicons/vue/20/solid'
import AppCard from '../AppCard.vue'
import BadgeIcon from '../BadgeIcon.vue'
import AchievementSummary from './AchievementSummary.vue'
import AchievementCelebration from './AchievementCelebration.vue'
import LineWeeklySingleRace from '../charts/LineWeeklySingleRace.vue'
import {useMarganaAuth, UserTier} from '@/composables/useMarganaAuth'
import {
  fmtDayLetter,
  maskFutureAndToday,
  todayIsoLocal,
  useGuestMetrics
} from '@/composables/useGuestMetrics'
import {useRegisteredMetrics} from '@/composables/useRegisteredMetrics'
import {LockClosedIcon} from "@heroicons/vue/20/solid";

const props = defineProps({
  userLabel: {type: String, default: ''},
  newAchievements: {type: Array, default: () => []}
})

const emit = defineEmits(['see-results'])

const showCelebration = ref(false)
const localAchievements = ref([])

// Trigger celebration overlay if there are new achievements
watch(() => props.newAchievements, (newVal) => {
  if (newVal && newVal.length > 0 && !showCelebration.value) {
    localAchievements.value = [...newVal]
    showCelebration.value = true
  }
}, { immediate: true })

const {userTier, initialized} = useMarganaAuth()
const isGuest = computed(() => userTier.value === UserTier.GUEST)
const cardTitle = computed(() => {
  if (isGuest.value) return 'Guest'
  return props.userLabel || 'You'
})

// --- Registered Metric Logic ---
const {
  loading: regLoading,
  error: regError,
  data: regData,
  loadRegisteredData
} = useRegisteredMetrics()

const formatNumber = (n) => new Intl.NumberFormat('en-GB').format(n)
const registeredStreak = computed(() => regData.value?.current_streak || 0)
const registeredStreakPoints = computed(() => regData.value?.streak_points || 0)
const registeredStreakPointsLabel = computed(() => formatNumber(registeredStreakPoints.value))

const registeredDailyScores = computed(() => {
  const uds = regData.value?.user_daily_scores || {}
  const ds = regData.value?.days || []
  return ds.map(d => (uds[d] ?? 0))
})

const registeredTargetLine = computed(() => {
  const scores = registeredDailyScores.value
  const target = []
  let high = 0
  for (const s of scores) {
    if (s > high) high = s
    target.push(high)
  }
  return target
})

const chartYouValues = computed(() => {
  if (isGuest.value) return maskFutureAndToday(guestDailyScores.value, guestDays.value)
  return maskFutureAndToday(registeredDailyScores.value, regData.value?.days || [])
})

const chartTargetValues = computed(() => {
  if (isGuest.value) return guestTargetLine.value
  return registeredTargetLine.value
})

// --- Guest Metric Logic ---
const {
  days: guestDays,
  youDailyScores: guestDailyScores,
  guestTargetLine,
  guestStreak,
  guestStreakPoints,
  loadGuestData
} = useGuestMetrics()

const currentLabels = computed(() => {
  if (isGuest.value) return guestDays.value.map(fmtDayLetter)
  return (regData.value?.days || []).map(fmtDayLetter)
})

const todayScore = computed(() => {
  const today = todayIsoLocal()
  if (isGuest.value) {
    const idx = guestDays.value.indexOf(today)
    if (idx === -1) return 0
    return guestDailyScores.value[idx] || 0
  } else {
    const uds = regData.value?.user_daily_scores || {}
    return uds[today] || 0
  }
})

const catchScore = computed(() => {
  const targetLine = chartTargetValues.value
  const validScores = (targetLine || []).filter(v => Number.isFinite(Number(v)) && Number(v) > 0)
  return validScores.length > 0 ? Math.max(...validScores) : 0
})

async function load() {
  if (isGuest.value) {
    loadGuestData()
  } else {
    try {
      await loadRegisteredData()
    } catch (e) {
      console.error('Failed to load registered metrics:', e)
    }
  }
}

// Trigger initial load once auth is ready
watch(initialized, (isInit) => {
  if (isInit) {
    load()
  }
}, { immediate: true })

// Reload data if the user logs in or out while on this page
watch(userTier, (newTier, oldTier) => {
  if (initialized.value && newTier !== oldTier) {
    load()
  }
})

</script>

<template>
  <div class="w-full max-w-xl mx-auto px-3 sm:px-4 mb-4">
    <AppCard :title="cardTitle" :showDot="true">
      <div class="flex flex-col items-center justify-center py-1 mt-6">
        <div class="text-center">
          <p class="text-white/80 text-lg mb-4">Your game has been submitted!</p>
        </div>

        <!-- Today's Score + Streaks -->
        <div v-if="todayScore > 0" class="flex flex-col items-center gap-2 sm:gap-4 w-full">
          <!-- Row 1: Today's Score (always its own row) -->
          <div class="flex flex-col items-center">
            <div class="font-medium text-sm text-indigo-100/80 mb-2">Today's score</div>
            <div
                class="text-5xl font-black bg-clip-text text-transparent bg-gradient-to-tr from-purple-500 to-orange-500 drop-shadow-sm">
              {{ todayScore }}
            </div>
          </div>

          <!-- New Achievements Celebration (Registered Only) -->
          <AchievementCelebration
              v-if="!isGuest && showCelebration"
              :achievements="localAchievements"
              @close="showCelebration = false"
          />

          <!-- Row 2: Streaks -->
          <div class="w-full flex justify-center">
            <!-- Streak for Guests -->
            <div v-if="userTier === UserTier.GUEST"
                 class="flex flex-col sm:flex-row flex-nowrap items-center justify-center gap-4 py-2">
              <div
                  class="inline-flex items-center gap-3 px-2 py-2">
                <div
                    class="relative flex items-center justify-center w-12 h-12 sm:w-12 sm:h-12 rounded-full bg-[linear-gradient(45deg,rgb(35,141,132)_10%,rgb(250,204,21)_90%)] shadow-lg opacity-50">
                  <RocketLaunchIcon class="w-8 h-8 text-white/70"/>
                </div>
                <div class="flex flex-col">
                <span class="font-medium text-sm text-indigo-100/80">
                  Current streak
                </span>
                  <span class="inline-flex items-center justify-center gap-2 text-lg sm:text-xl font-bold text-indigo-200/70 leading-none">
                  <LockClosedIcon class="w-8 h-8" />
                </span>
                </div>
              </div>

              <div
                  class="inline-flex items-center gap-3 px-2 py-2">
                <div
                    class="relative flex items-center justify-center w-12 h-12 sm:w-12 sm:h-12 rounded-full bg-gradient-to-tr from-[rgb(255,72,153)] to-[rgb(250,204,21)] shadow-lg opacity-50">
                  <StarIcon class="w-8 h-8 text-white/70"/>
                </div>
                <div class="flex flex-col">
                <span class="font-medium text-sm text-indigo-100/80">
                  Streak points
                </span>
                  <span class="inline-flex items-center justify-center gap-2 text-lg sm:text-xl font-bold text-indigo-200/70 leading-none">
                  <LockClosedIcon class="w-8 h-8" />
                </span>
                </div>
              </div>
            </div>

            <!-- Streak for Registered Users -->
            <div v-else-if="!isGuest && registeredStreak > 0" class="flex flex-col sm:flex-row flex-wrap items-start sm:items-center justify-center gap-3">
              <div class="flex items-center gap-3 px-2 py-2">
                <div
                    class="flex items-center justify-center w-12 h-12 sm:w-12 sm:h-12 rounded-full bg-[linear-gradient(45deg,rgb(35,141,132)_10%,rgb(250,204,21)_90%)] shadow-lg">
                  <RocketLaunchIcon class="w-8 h-8 sm:w-8 sm:h-8 text-white"/>
                </div>
                <div class="flex flex-col">
                  <span class="font-medium text-sm text-indigo-100/80">Current streak</span>
                  <span class="text-xl sm:text-2xl font-black text-white leading-none">
                    {{ registeredStreak }} {{ registeredStreak === 1 ? 'day' : 'days' }}
                  </span>
                </div>
              </div>

              <div class="flex items-center gap-3 px-2 py-2">
                <div
                    class="flex items-center justify-center w-12 h-12 sm:w-12 sm:h-12 rounded-full bg-gradient-to-tr from-[rgb(255,72,153)] to-[rgb(250,204,21)] shadow-lg">
                  <StarIcon class="w-8 h-8 sm:w-8 sm:h-8 text-white"/>
                </div>
                <div class="flex flex-col">
                  <span class="font-medium text-sm text-indigo-100/80">Streak points</span>
                  <span class="text-xl sm:text-2xl font-black text-white leading-none">
                    {{ registeredStreakPointsLabel }}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div class="h-[2px] w-full bg-white/10"></div>

          <!-- Row 3: Global Best Stats (Registered Only) -->
          <div v-if="!isGuest" class="w-full flex justify-center">
            <AchievementSummary :userBadges="regData?.badges" :currentWeekId="regData?.week_id" />
          </div>
          <div v-if="!isGuest" class="h-[2px] w-full bg-white/10 my-4"></div>
        </div>

        <div v-if="regLoading" class="flex flex-col items-center mt-12 space-y-6">
          <div class="dots-loader" role="img" aria-label="Loading">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </div>
        </div>

        <!-- Performance Metric Chart -->
        <div v-if="(isGuest && guestDays.length) || (!isGuest && regData)"
             class="w-full  mx-auto rounded-xl p-2">
          <LineWeeklySingleRace
              :labels="currentLabels"
              :youValues="chartYouValues"
              :youLabel="'You'"
              :title="'Your weekly score'"
              :singleLabel="true"
              :beginAtZero="true"
              :grace="'5%'"
              :days="isGuest ? guestDays : (regData?.days || [])"
              :today="todayIsoLocal()"
          />
        </div>

        <button
            v-if="!regLoading"
            @click="emit('see-results')"
            class="btn-common-button"
        >
          See results
        </button>
      </div>
    </AppCard>

  </div>
</template>

<style scoped>
.tabular-nums {
  font-variant-numeric: tabular-nums;
}
</style>
