<script setup>
import {ref, computed, onMounted, watch} from 'vue'
import {useRouter} from 'vue-router'
import {
  QuestionMarkCircleIcon,
  RocketLaunchIcon,
  StarIcon,
  LockClosedIcon,
  ArrowPathIcon
} from '@heroicons/vue/20/solid'
import AppCard from '@/components/AppCard.vue'
import BadgeIcon from '@/components/BadgeIcon.vue'
import AchievementSummary from '@/components/margana/AchievementSummary.vue'
import AchievementCelebration from '@/components/margana/AchievementCelebration.vue'
import badgeMilestones from '@/resources/badge-milestones.json'
import marganaLogo from '@/assets/margana_m_logo.svg'
import LineWeeklySingleRace from '@/components/charts/LineWeeklySingleRace.vue'
import {useMarganaAuth, UserTier} from '@/composables/useMarganaAuth'
import {
  buildWeekFromStart,
  todayIsoLocal,
  fmtDayLetter,
  maskFutureAndToday,
  useGuestMetrics
} from '@/composables/useGuestMetrics'
import {useRegisteredMetrics} from '@/composables/useRegisteredMetrics'
import {ActivityTracker} from '@/usage/ActivityTracker'

const {loading, error, data, loadRegisteredData} = useRegisteredMetrics()
const noData = ref(false)

const formatNumber = (n) => new Intl.NumberFormat('en-GB').format(n)
const registeredStreak = computed(() => data.value?.current_streak || 0)
const registeredStreakPoints = computed(() => data.value?.streak_points || 0)
const registeredStreakPointsLabel = computed(() => formatNumber(registeredStreakPoints.value))

// Badge and Achievement mapping
const userBadges = computed(() => data.value?.badges || [])
const showCelebration = ref(false)
const localCelebrations = ref([])
const pendingAchievements = computed(() => {
  return userBadges.value.filter(b => b.last_milestone_name && b.last_milestone_name !== b.last_celebrated_name)
})

watch(pendingAchievements, (newVal) => {
  if (newVal && newVal.length > 0 && !showCelebration.value) {
    localCelebrations.value = [...newVal]
    showCelebration.value = true
  }
}, {immediate: true})

const getBadgeMilestones = (type) => {
  const typeKey = String(type || '').toLowerCase()
  const config = badgeMilestones[typeKey]
  const userBadge = userBadges.value.find(x => String(x.type || '').toLowerCase() === typeKey)
  const currentCount = userBadge?.count || 0

  if (!config) return {currentCount, achievedList: [], next: null, previousForNext: 0}

  const strategy = config.milestone_strategy || {}
  const achievedList = []
  let next = null
  let previousForNext = 0

  if (strategy.type === 'tiered') {
    const tiers = strategy.tiers || []
    let currentVal = 0
    for (const tier of tiers) {
      const upto = tier.upto || Infinity
      const interval = tier.interval || 1

      let nextM = (Math.floor(currentVal / interval) + 1) * interval
      while (nextM <= upto) {
        if (currentCount >= nextM) {
          achievedList.push({count: nextM, name: String(nextM)})
          previousForNext = nextM
          currentVal = nextM
          nextM += interval
        } else {
          next = {count: nextM, name: String(nextM)}
          break
        }
      }
      if (next || currentCount < upto) break
      currentVal = upto
    }
  } else if (strategy.type === 'linear') {
    const interval = strategy.interval || 1
    let m = interval
    while (m <= currentCount) {
      achievedList.push({count: m, name: String(m)})
      previousForNext = m
      m += interval
    }
    next = {count: m, name: String(m)}
  }

  return {
    currentCount,
    achievedList,
    next,
    previousForNext
  }
}

// Refs for badge rows to handle auto-scroll
const badgeRowRefs = ref({})
const setBadgeRowRef = (type) => (el) => {
  if (el) badgeRowRefs.value[type] = el
}

function scrollToLatest() {
  // Small delay to ensure DOM is rendered with all v-for items
  setTimeout(() => {
    Object.values(badgeRowRefs.value).forEach(el => {
      el.scrollTo({
        left: el.scrollWidth,
        behavior: 'smooth'
      })
    })
  }, 300)
}

// Router state (to expose navigation links)
const router = useRouter()

// Week selection state — default to today
const selectedDate = ref(new Date())

// Date label helpers
// Header: show only the day number (e.g., "02")
function fmtDayOnly(d) {
  try {
    const dt = new Date(d + 'T00:00:00Z')
    return dt.toLocaleDateString(undefined, {day: '2-digit'})
  } catch {
    return d
  }
}

// Week starting: use full month name (e.g., "02 December")
function fmtWeekStart(d) {
  try {
    const dt = new Date(d + 'T00:00:00Z')
    return dt.toLocaleDateString(undefined, {day: '2-digit', month: 'long'})
  } catch {
    return d
  }
}

const days = computed(() => {
  const ws = data.value?.week_start
  if (typeof ws === 'string' && ws.length === 10) {
    return buildWeekFromStart(ws)
  }
  return Array.isArray(data.value?.days) ? data.value.days : []
})

// Table layout helpers: show first letter of weekday as the column headings
const dayHeaders = computed(() => days.value.map(d => ({key: d, label: fmtDayLetter(d)})))

// ---- New series for additional charts ----
const youDailyScores = computed(() => {
  const map = data.value?.user_daily_scores || {}
  return days.value.map(d => (map[d] ?? null))
})

const youCumScores = computed(() => {
  const map = data.value?.user_cumulative || {}
  return days.value.map(d => (map[d] ?? null))
})

// ---- Hide only today's data if user hasn't played yet (keep labels) ----

// Helper to mask today's point (if not played) AND all future dates for user-specific series.
// Target/benchmark series should NOT use this if they need to stretch over the week.
function maskFutureAndTodayHelper(series) {
  return maskFutureAndToday(series, days.value, data.value?.user_daily_scores)
}

const youDailyScoresMasked = computed(() => maskFutureAndTodayHelper(youDailyScores.value || []))
const youCumScoresMasked = computed(() => maskFutureAndTodayHelper(youCumScores.value || []))
const chartYouValues = computed(() => youDailyScoresMasked.value)

const guestTargetLine = computed(() => {
  const map = data.value?.guest_target_line || {}
  return days.value.map(d => (map[d] ?? null))
})
const guestTargetLineMasked = computed(() => maskFutureAndTodayHelper(guestTargetLine.value || []))

// Show a no‑plays hint when there are no days or all points across the key series are NaN/null
const showNoPlaysHint = computed(() => {
  const D = days.value || []
  if (D.length === 0) return true

  function hasData(arr) {
    return Array.isArray(arr) && arr.some(v => v !== null && Number.isFinite(v) && v > 0)
  }

  return !hasData(youDailyScoresMasked.value)
})

// ---- Personal Best (PB) chart (You vs Your Personal Best) ----
const pbData = computed(() => data.value?.pb || null)
const pbDates = computed(() => {
  const ds = pbData.value?.dates
  return Array.isArray(ds) && ds.length ? ds : []
})
const pbDaily = computed(() => pbData.value?.daily || {})
const pbCumScores = computed(() => {
  const ds = pbDates.value
  let run = 0
  return ds.map(d => {
    const v = Number(pbDaily.value?.[d] ?? 0)
    run += Number.isFinite(v) ? v : 0
    return run
  })
})
const pbLabels = computed(() => pbDates.value.map(fmtDayLetter))
// Align PB series to current week's label count so datasets match lengths
const currentLabels = computed(() => (days.value || []).map(fmtDayLetter))
const pbCumAligned = computed(() => {
  const n = (days.value || []).length
  if (!n) return []
  const arr = pbCumScores.value || []
  return arr.slice(0, n)
})
// If no available PB days found, fall back to a zero line so the chart still renders
const pbCumOrZeros = computed(() => {
  const n = (days.value || []).length
  if (!n) return []
  const arr = pbCumAligned.value || []
  const anyFinite = Array.isArray(arr) && arr.some(v => Number.isFinite(Number(v)))
  return (Array.isArray(arr) && arr.length === n && anyFinite) ? arr : Array.from({length: n}, () => 0)
})
const pbAvailable = computed(() => {
  // Available when the backend provided a PB object and there is at least one non-zero value in its daily map
  if (!pbData.value) return false
  const vals = Object.values(pbDaily.value || {})
  return vals.some(v => Number(v) > 0)
})

// ---- Margana chart (You vs Margana) ----
const marganaCumScores = computed(() => {
  const map = data.value?.margana_cumulative || {}
  return days.value.map(d => (map[d] ?? null))
})
const marganaAvailable = computed(() => {
  const vals = Object.values(data.value?.margana_daily_scores || {})
  return vals.some(v => Number(v) > 0)
})

const registeredTargetLine = computed(() => {
  const scores = youDailyScores.value
  const target = []
  let high = 0
  for (const s of scores) {
    const n = Number(s ?? 0)
    if (n > high) high = n
    target.push(high)
  }
  return target
})

const registeredTargetLineMasked = computed(() => maskFutureAndTodayHelper(registeredTargetLine.value || []))

// Legend label for PB line:
// - If PB found: show the week id (YYYY-Www), same format used in the router-link above
// - If not found: show "Personal Best (Unregistered)"
const pbLegendLabel = computed(() => {
  const wid = pbData.value?.week_id
  return wid ? `Personal best (${wid})` : 'Personal best (Unregistered)'
})

// ---- Mobile-first helpers (inspired by GroupsCardScore.vue) ----
const selectedDayIndex = ref(0)

function initSelectedDayIndex() {
  try {
    const today = new Date()
    const yyyy = today.getUTCFullYear()
    const mm = String(today.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(today.getUTCDate()).padStart(2, '0')
    const iso = `${yyyy}-${mm}-${dd}`
    const idx = (days.value || []).findIndex(d => d === iso)
    selectedDayIndex.value = idx >= 0 ? idx : 0
  } catch (_) {
    selectedDayIndex.value = 0
  }
}

// Keep index within range when days change
watch(days, (newDays) => {
  if (!Array.isArray(newDays) || newDays.length === 0) {
    selectedDayIndex.value = 0
    return
  }
  if (selectedDayIndex.value < 0 || selectedDayIndex.value >= newDays.length) {
    selectedDayIndex.value = Math.min(Math.max(selectedDayIndex.value, 0), newDays.length - 1)
  }
})

function selectDay(idx) {
  if (!Array.isArray(days.value)) return
  if (idx < 0 || idx >= days.value.length) return
  selectedDayIndex.value = idx
}

const selectedDayKey = computed(() => {
  try {
    return (days.value || [])[selectedDayIndex.value] || null
  } catch {
    return null
  }
})


const {userTier, isAuthenticated, initialized} = useMarganaAuth()

const {
  days: guestDays,
  youDailyScores: guestDailyScores,
  guestTargetLine: guestTargetLineRef,
  youCumScores: guestCumScores,
  guestStreak,
  guestStreakPoints,
  loadGuestData: runLoadGuestData
} = useGuestMetrics()

async function loadGuestData() {
  const guestResult = await runLoadGuestData(selectedDate.value)

  data.value = {
    ...guestResult,
    user_daily_scores: guestResult.user_daily_scores_map,
    margana_daily_scores: {},
    user_cumulative: guestCumScores.value.reduce((acc, v, i) => {
      acc[guestResult.days[i]] = v
      return acc
    }, {}),
    margana_cumulative: {},
    percentage_daily: {},
    percentage_cumulative: {},
    position_daily: {},
    users_in_week: 0,
    is_guest: true,
    guest_target_line: guestTargetLineRef.value.reduce((acc, v, i) => {
      acc[guestResult.days[i]] = v
      return acc
    }, {})
  }
  noData.value = !Object.values(data.value.user_daily_scores).some(v => v > 0)
}

async function load() {
  noData.value = false

  if (userTier.value === UserTier.GUEST) {
    loading.value = true
    await loadGuestData()
    loading.value = false
    initSelectedDayIndex() // Re-init index for mobile if guest
    return
  }

  try {
    const resData = await loadRegisteredData(selectedDate.value)
    if (!resData || (resData.days && resData.days.length === 0)) {
      noData.value = true
    }
  } catch (e) {
    // Error is handled in useRegisteredMetrics
  }
}

async function refresh() {
  if (userTier.value === UserTier.GUEST) {
    await load()
    return
  }
  try {
    await loadRegisteredData(selectedDate.value, true)
  } catch (e) {
    // Error is handled in useRegisteredMetrics
  }
}


onMounted(() => {
  // Initialize mobile selected day (will be refined once data loads)
  initSelectedDayIndex()

  if (data.value && data.value.badges) {
    scrollToLatest()
  }
})

// Trigger initial load once auth is ready
watch(initialized, (isInit) => {
  if (isInit) {
    load()
  }
}, {immediate: true})

watch(data, (newData) => {
  if (newData && newData.badges) {
    scrollToLatest()
  }
}, {deep: true})

// Reload data if the user logs in or out while on this page
watch(userTier, (newTier, oldTier) => {
  if (initialized.value && newTier !== oldTier) {
    load()
  }
})


// Format a YYYY-MM-DD string to dd.MM.yyyy
function fmtDateDots(iso) {
  if (!iso || typeof iso !== 'string') return ''
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return ''
  const [, y, mo, d] = m
  return `${d}.${mo}.${y}`
}

function signup() {
  ActivityTracker.record('landing_signup_guest_played')
  router.push({name: 'login', query: {signup: 'true'}})
}

function login() {
  ActivityTracker.record('landing_login')
  router.push({name: 'login'})
}

</script>

<template>
  <div class="flex flex-col items-center justify-center min-h-full p-4">
    <div class="w-full max-w-xl mx-auto px-3 sm:px-4">

      <div v-if="error" class="text-red-300 text-sm">{{ error }}</div>

      <div v-else-if="loading" class="flex flex-col items-center mt-12 space-y-6">
        <div class="dots-loader" role="img" aria-label="Loading">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>
      </div>

      <div v-else>
        <h1 class="text-2xl sm:text-3xl font-bold text-white mb-6 drop-shadow text-center">Performance</h1>
        <AppCard :title="userTier === UserTier.GUEST ? 'Guest' : 'You'">
          <template #header-right>
            <button
                @click="refresh"
                class="p-1 rounded text-white/40 hover:text-white transition-all flex items-center justify-center"
                :class="{ 'animate-spin': loading }"
                title="Refresh"
            >
              <ArrowPathIcon class="w-5 h-5" />
            </button>
          </template>
          <div class="space-y-4">

            <!-- Streaks -->
            <div v-if="userTier === UserTier.GUEST"
                 class="flex flex-col sm:flex-row flex-nowrap items-center justify-center gap-4 py-2">
              <div
                  class="inline-flex items-center gap-3 px-2 py-2">
                <div
                    class="relative flex items-center justify-center w-9 h-9 rounded-full bg-[linear-gradient(45deg,rgb(35,141,132)_10%,rgb(250,204,21)_90%)] shadow-lg opacity-50">
                  <RocketLaunchIcon class="w-5 h-5 text-white/70"/>
                </div>
                <div class="flex flex-col">
                  <span class="font-medium text-sm text-indigo-100/80">
                    Current streak
                  </span>
                  <span
                      class="inline-flex items-center justify-center gap-2 text-lg sm:text-xl font-bold text-indigo-200/70 leading-none">
                    <LockClosedIcon class="w-5 h-5"/>
                  </span>
                </div>
              </div>

              <div
                  class="inline-flex items-center gap-3 px-2 py-2">
                <div
                    class="relative flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-tr from-[rgb(255,72,153)] to-[rgb(250,204,21)] shadow-lg opacity-50">
                  <StarIcon class="w-5 h-5 text-white/70"/>
                </div>
                <div class="flex flex-col">
                  <span class="font-medium text-sm text-indigo-100/80">
                    Streak points
                  </span>
                  <span
                      class="inline-flex items-center justify-center gap-2 text-lg sm:text-xl font-bold text-indigo-200/70 leading-none">
                    <LockClosedIcon class="w-5 h-5"/>
                  </span>
                </div>
              </div>
            </div>

            <template v-else>
              <!-- Streak for Registered Users -->
              <div v-if="registeredStreak > 0"
                   class="flex flex-col sm:flex-row items-start sm:items-center justify-center gap-4 py-2">
                <div
                    class="inline-flex items-center gap-3 px-2 py-2">
                  <div
                      class="flex items-center justify-center w-12 h-12  rounded-full bg-[linear-gradient(45deg,rgb(35,141,132)_10%,rgb(250,204,21)_90%)] shadow-lg">
                    <RocketLaunchIcon class="w-8 h-8 text-white"/>
                  </div>
                  <div class="flex flex-col">
                    <span class="font-medium text-sm text-indigo-100/80">Current streak</span>
                    <span class="text-xl sm:text-2xl  font-black text-white leading-none">
                      {{ registeredStreak }} {{ registeredStreak === 1 ? 'day' : 'days' }}
                    </span>
                  </div>
                </div>

                <div
                    class="inline-flex items-center gap-3 px-2 py-2">
                  <div
                      class="flex items-center justify-center w-12 h-12  rounded-full bg-gradient-to-tr from-[rgb(255,72,153)] to-[rgb(250,204,21)] shadow-lg">
                    <StarIcon class="w-8 h-8 text-white"/>
                  </div>
                  <div class="flex flex-col">
                    <span class="font-medium text-sm text-indigo-100/80">Streak points</span>
                    <span class="text-xl sm:text-2xl  font-black text-white leading-none">
                      {{ registeredStreakPointsLabel }}
                    </span>
                  </div>
                </div>
              </div>
            </template>

            <div v-if="userTier === UserTier.GUEST || registeredStreak > 0"
                 class="h-[1px] w-full bg-white/10 my-4"></div>

            <!-- New Achievements Celebration (only for registered) -->
            <AchievementCelebration
                v-if="userTier !== UserTier.GUEST && showCelebration"
                :achievements="localCelebrations"
                @close="showCelebration = false"
            />

            <!-- Charts area -->
            <div class="mt-1 space-y-6">
              <div v-if="userTier === UserTier.GUEST">
                <LineWeeklySingleRace
                    :labels="currentLabels"
                    :youValues="chartYouValues"
                    :youLabel="'You'"
                    :title="'This week\'s scores'"
                    :singleLabel="true"
                    :beginAtZero="true"
                    :grace="'5%'"
                    :days="days"
                    :today="todayIsoLocal()"
                />

                <div v-if="showNoPlaysHint" class="text-center">
                  <p class="text-indigo-200/80 text-sm">
                    No results have been found for this week<br>
                    Play Margana to start filling your daily score
                  </p>
                </div>

                <!-- Locked PB Chart for Guests -->
                <div
                    class="mt-8 bg-white/5 border border-white/10 rounded-xl p-6 flex flex-col items-center justify-center text-center relative overflow-hidden">
                  <LockClosedIcon class="w-8 h-8 text-indigo-200/70 mb-3"/>
                  <h3 class="text-indigo-200/70 font-bold text-base mb-1">You vs personal best</h3>
                  <p class="text-indigo-200/70 text-xs max-w-[280px]">
                    Create an account to compare your current performance against your personal best week
                  </p>
                </div>

                <!-- Locked Margana Chart for Guests -->
                <div
                    class="mt-8 bg-white/5 border border-white/10 rounded-xl p-6 flex flex-col items-center justify-center text-center relative overflow-hidden">
                  <LockClosedIcon class="w-8 h-8 text-indigo-200/70 mb-3"/>
                  <h3 class="text-indigo-200/70 font-bold text-base mb-1">You vs Margana</h3>
                  <p class="text-indigo-200/70 text-xs max-w-[280px]">
                    Create an account to compare your current performance against Margana
                  </p>
                </div>

                <div class="h-[1px] w-full bg-white/10"></div>

                <div class="flex flex-col items-center justify-center gap-3 mt-8 text-left">
                  <!-- Encouragement text -->
                  <p class="text-indigo-100 text-sm">
                    Create a free account to unlock more performance statistics &ndash; including streak history, your
                    scoring trends, personal best and Margana comparisons and how you rank
                    against other players
                  </p>

                  <!-- Main CTA button (centered) -->
                  <button
                      @click="signup"
                      class="btn-common-button"
                  >
                    Create account
                  </button>

                  <!-- Link under the button -->
                  <button
                      @click="login"
                      class="text-indigo-200 hover:text-white text-sm font-medium transition-colors"
                  >
                    Already have an account? Log in
                  </button>
                </div>
              </div>

              <template v-else>
                <div class="space-y-6">
                  <div>
                    <LineWeeklySingleRace
                        :labels="currentLabels"
                        :youValues="chartYouValues"
                        :youLabel="'You'"
                        :title="'Your weekly score'"
                        :singleLabel="true"
                        :beginAtZero="true"
                        :grace="'5%'"
                        :days="userTier === UserTier.GUEST ? guestDays : (data?.days || [])"
                        :today="todayIsoLocal()"
                    />
                    <div v-if="showNoPlaysHint" class="text-center">
                      <p class="text-indigo-200/80 text-sm">
                        No data available for this week yet<br>
                        Play Margana to start filling your daily score
                      </p>
                    </div>
                  </div>
                  <div class="h-[1px] w-full bg-white/10"></div>
                  <!-- Achievements Section for Registered Users -->
                  <div class="px-2 mb-3 mt-8 flex items-center justify-between">
                    <h3 class=" text-indigo-100/80 font-medium text-lg">Your achievements</h3>
                  </div>

                  <!-- Global Best Stats Row -->
                  <AchievementSummary :userBadges="userBadges" :currentWeekId="data?.week_id"/>


                  <div class="flex flex-col px-2 py-4" :style="{ gap: 'var(--margana-badge-row-margin)' }">
                    <div v-for="type in ['anagram_solved', 'days_outplayed_margana', 'weeks_outplayed_margana', 'madness_solved']" :key="type"
                         class="flex flex-col gap-4">
                      <!-- Row Header -->
                      <div class="flex items-center gap-3">
                        <h4 class="font-medium text-sm text-indigo-100/80 whitespace-nowrap">
                          {{ badgeMilestones[type]?.title }}
                        </h4>
                        <div class="h-[1px] flex-1 bg-white/10"></div>
                      </div>

                      <!-- Badges Row -->
                      <div
                          :ref="setBadgeRowRef(type)"
                          class="flex items-center overflow-x-auto scrollbar-hide snap-x w-full min-w-0 p-3"
                          :style="{ gap: 'var(--margana-badge-row-gap)' }"
                      >
                        <!-- Arrow between badges -->
                        <div class="text-white/40 text-base font-medium">|</div>

                        <!-- Achieved Badges -->
                        <template v-for="(milestone, idx) in getBadgeMilestones(type).achievedList"
                                  :key="milestone.count">
                          <BadgeIcon
                              :type="type"
                              :currentCount="getBadgeMilestones(type).currentCount"
                              :milestoneCount="milestone.count"
                              :milestoneName="milestone.name"
                              class="flex-shrink-0 snap-center"
                          />

                          <!-- Arrow between badges -->
                          <div class="text-white/40 flex-shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="3"
                                 stroke="currentColor"
                                 :style="{ width: 'var(--margana-badge-arrow-size)', height: 'var(--margana-badge-arrow-size)' }">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M9 5l7 7-7 7"/>
                            </svg>
                          </div>
                        </template>

                        <!-- Next Badge -->
                        <BadgeIcon
                            v-if="getBadgeMilestones(type).next"
                            :type="type"
                            :currentCount="getBadgeMilestones(type).currentCount"
                            :milestoneCount="getBadgeMilestones(type).next.count"
                            :previousMilestoneCount="getBadgeMilestones(type).previousForNext"
                            :milestoneName="getBadgeMilestones(type).next.name"
                            class="flex-shrink-0 snap-center"
                        />
                      </div>
                    </div>
                  </div>

                </div>
              </template>
            </div>
          </div>
        </AppCard>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tabular-nums {
  font-variant-numeric: tabular-nums;
}

@keyframes grow-shrink {
  0%, 100% {
    transform: scale(1);
    opacity: 0.7;
  }
  50% {
    transform: scale(1.15);
    opacity: 1;
  }
}

.animate-grow-shrink {
  animation: grow-shrink 2s infinite ease-in-out;
}
</style>
