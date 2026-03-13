<script setup lang="ts">
import { onMounted, ref, computed, onBeforeUnmount } from 'vue'
import { useMarganaAuth } from '@/composables/useMarganaAuth'
import { useLeaderboard } from '@/composables/useLeaderboard'
import marganaLogo from '@/assets/margana_m_logo.svg'
import { CheckIcon, TrashIcon } from '@heroicons/vue/20/solid'

const props = defineProps<{
  id: string
  isHistory?: boolean
}>()

const { userSub } = useMarganaAuth()
const { 
  leaderboardScores, 
  loadingScores, 
  scoresError, 
  fetchLeaderboardScores,
  currentLeaderboard,
  historicalStandings,
  loadingHistory,
  historyError
} = useLeaderboard()

const emit = defineEmits<{
  (e: 'kick', userSub: string): void
}>()

const formatNumber = (n: number) => new Intl.NumberFormat('en-GB').format(n)

// Week dates: compute Monday..Sunday for current week
function getWeekDates(startDate = new Date()) {
  const d = new Date(startDate)
  // getDay: 0=Sun..6=Sat. We want Monday as start.
  const day = d.getDay()
  const diffToMon = (day === 0 ? -6 : 1 - day)
  const monday = new Date(d)
  monday.setDate(d.getDate() + diffToMon)
  const days = []
  for (let i = 0; i < 7; i++) {
    const x = new Date(monday)
    x.setDate(monday.getDate() + i)
    const yyyy = x.getFullYear()
    const mm = String(x.getMonth() + 1).padStart(2, '0')
    const dd = String(x.getDate()).padStart(2, '0')
    days.push({
      iso: `${yyyy}-${mm}-${dd}`,
      ymd: `${yyyy}${mm}${dd}`,
      dow: i,
    })
  }
  return { monday, days }
}

const week = ref(getWeekDates())
const dayLetters = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const dayBadgeBg = [
  'from-indigo-500 to-violet-600',
  'from-violet-500 to-purple-600',
  'from-purple-500 to-fuchsia-600',
  'from-fuchsia-500 to-pink-600',
  'from-orange-500 to-pink-600',
  'from-orange-500 to-amber-600',
  'from-amber-500 to-orange-600',
]

const todayIso = new Date().toISOString().split('T')[0]

onMounted(() => {
  window.addEventListener('margana-played-status', onPlayedRefresh)
})

onBeforeUnmount(() => {
  window.removeEventListener('margana-played-status', onPlayedRefresh)
})

const onPlayedRefresh = (evt: any) => {
  if (evt?.detail?.date === todayIso && evt?.detail?.hasPlayed) {
    fetchLeaderboardScores(props.id, true)
  }
}

const displayNameForSub = (sub: string) => {
  return currentLeaderboard.value?.user_labels?.[sub] || sub.slice(0, 8)
}

const scoreFor = (sub: string, iso: string) => {
  return leaderboardScores.value?.[sub]?.[iso]
}

const isFutureDate = (iso: string) => iso > todayIso

const totalForSub = (sub: string) => {
  let sum = 0
  for (const day of week.value.days) {
    if (isFutureDate(day.iso)) continue
    const val = scoreFor(sub, day.iso)
    if (typeof val === 'number') sum += val
  }
  return sum
}

const sortedMembers = computed(() => {
  const subs = Object.keys(leaderboardScores.value)
  if (subs.length === 0) return []
  
  const arr = subs.map(sub => ({
    sub,
    total: totalForSub(sub)
  }))
  
  arr.sort((a, b) => b.total - a.total || displayNameForSub(a.sub).localeCompare(displayNameForSub(b.sub)))
  
  const topTotal = arr[0].total
  return arr.map(m => ({
    ...m,
    isLeader: topTotal > 0 && m.total === topTotal
  }))
})

const maxScoreForDay = (iso: string) => {
  let max = -1
  for (const sub in leaderboardScores.value) {
    const val = scoreFor(sub, iso)
    if (typeof val === 'number' && val > max) max = val
  }
  return max
}

const isTopForDay = (sub: string, iso: string) => {
  const val = scoreFor(sub, iso)
  return typeof val === 'number' && val > 0 && val === maxScoreForDay(iso)
}

const canManage = computed(() => {
  return currentLeaderboard.value?.role === 'admin' && props.id !== 'play-margana'
})
</script>

<template>
  <div class="leaderboard-score-table">
    <!-- History View -->
    <div v-if="isHistory">
       <div v-if="loadingHistory" class="p-12 flex flex-col items-center justify-center text-white/40">
         <div class="dots-loader mb-4">
           <span class="dot"></span>
           <span class="dot"></span>
           <span class="dot"></span>
         </div>
         <p class="text-xs font-bold">Loading last week's podium</p>
       </div>
       <div v-else-if="historyError" class="p-4 text-center bg-red-500/10 border border-red-500/20 rounded-xl">
         <p class="text-red-400 text-sm">{{ historyError }}</p>
       </div>
       <div v-else-if="historicalStandings.length > 0" class="space-y-2">
          <div v-for="s in historicalStandings" :key="s.sub" 
               class="flex items-center gap-3 p-3 group transition-all">
            <div class="flex items-center gap-4 min-w-0">
              <div class="w-8 flex justify-center flex-shrink-0">
                <img v-if="s.rank === 1" :src="marganaLogo" alt="" class="w-6 h-6 transform scale-250" />
                <div v-else class="font-medium tabular-nums leading-none text-base">
                  <span class="relative text-[12px] -top-1.5 font-extrabold bg-clip-text text-transparent bg-gradient-to-tr from-purple-500 to-orange-500">#</span>
                  <span class="font-extrabold bg-clip-text text-transparent bg-gradient-to-tr from-purple-500 to-orange-500">{{ s.rank }}</span>
                </div>
              </div>
              <div class="min-w-0">
                <p class="text-white font-semibold text-sm">{{ s.username }}</p>
                <p v-if="s.games_played > 0" class="text-white/40 text-[10px] tracking-widest font-bold">
                  {{ s.games_played }} {{ s.games_played === 1 ? 'day' : 'days' }}
                </p>
              </div>
            </div>
            <div class="flex-1 h-px bg-gradient-to-r from-white/5 via-white/20 to-white/5"></div>
            <div class="flex items-center gap-3">
               <div class="px-3 py-1 rounded bg-[linear-gradient(45deg,rgb(35,141,132)_10%,rgb(250,204,21)_90%)] text-white font-bold text-sm shadow-md min-w-[60px] text-center">
                {{ formatNumber(s.score) }}
              </div>
            </div>
          </div>
       </div>
       <div v-else class="p-12 text-center text-white">
         <p class="text-sm">No results found for last week</p>
       </div>
    </div>

    <!-- Live View -->
    <template v-else>
      <div v-if="scoresError" class="p-4 text-center bg-red-500/10 border border-red-500/20 rounded-xl">
        <p class="text-red-400 text-sm">{{ scoresError }}</p>
      </div>

      <div v-else-if="sortedMembers.length > 0" class="space-y-6">
      <!-- Mobile Table View -->
      <div class="min-[1101px]:hidden overflow-x-auto scrollbar-hide">
        <div class="inline-grid grid-cols-[repeat(7,minmax(0,34px))_auto] gap-x-1 items-center pb-2 min-w-max">
          <div v-for="(day, idx) in week.days" :key="idx" class="text-center">
            <span class="text-base font-bold uppercase text-white">{{ dayLetters[idx] }}</span>
          </div>
          <div></div>
        </div>

        <div>
          <div v-for="m in sortedMembers" :key="m.sub" class="py-2">
            <div class="grid grid-cols-8 gap-0.5 items-center pb-2">
              <div class="col-span-7 flex items-center gap-2 min-w-0">
                <span class="text-base font-semibold text-white truncate max-w-[220px]">
                  {{ displayNameForSub(m.sub) }}
                </span>
                <img v-if="m.isLeader" :src="marganaLogo" alt="" class="w-6 h-6 transform scale-125" />
              </div>
              <div class="col-span-1 flex justify-end">
                <button
                  v-if="canManage && m.sub !== userSub && m.sub !== 'margana'"
                  @click="emit('kick', m.sub)"
                  class="inline-flex h-7 w-7 items-center justify-center rounded text-white/40 hover:text-white transition-all"
                  title="Remove Member"
                >
                  <TrashIcon class="w-5 h-5" />
                </button>
                <span v-else class="inline-flex h-7 w-7 opacity-0" aria-hidden="true"></span>
              </div>
            </div>

            <div class="grid grid-cols-[repeat(7,minmax(0,34px))_1fr] gap-x-1 items-center px-0 w-full min-w-max">
              <div v-for="(day, idx) in week.days" :key="idx" class="text-left">
                <div v-if="scoreFor(m.sub, day.iso) === 'LOCKED'" class="inline-flex items-center justify-center p-1 rounded bg-white/5 text-white/20">
                  <CheckIcon class="w-3.5 h-3.5 text-white" />
                </div>
                <div v-else-if="typeof scoreFor(m.sub, day.iso) === 'number'" 
                     class="inline-block w-[34px] py-[1px] rounded font-semi text-sm border text-center"
                     :class="[
                       isTopForDay(m.sub, day.iso)
                         ? `bg-gradient-to-br ${dayBadgeBg[idx]} text-white border-white/20 shadow-sm`
                         : 'bg-white/5 text-white/60 border-white/5'
                     ]">
                  {{ scoreFor(m.sub, day.iso) }}
                </div>
                <div
                  v-else
                  class="inline-block w-[34px] py-[1px] rounded font-semi text-sm border text-center bg-white/5 text-white/60 border-white/5"
                >
                  -
                </div>
              </div>
              <div class="flex justify-end">
                <div class="inline-flex min-w-[46px] px-1.5 py-[1px] rounded border border-white/20 bg-[linear-gradient(45deg,rgb(35,141,132)_10%,rgb(250,204,21)_90%)] text-white font-semi text-sm shadow-sm text-center justify-center whitespace-nowrap tabular-nums">
                  {{ formatNumber(m.total) }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Desktop Table View -->
      <div class="hidden min-[1101px]:block overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr>
              <th></th>
              <th v-for="(day, idx) in week.days" :key="idx" class="py-4 px-2 text-center">
                <div class="flex flex-col items-center gap-1">
                  <span class="text-sm font-bold uppercase text-white">{{ dayLetters[idx] }}</span>
                </div>
              </th>
              <th class="py-4 px-6 text-center"></th>
              <th v-if="canManage" class="py-4 px-2 text-center"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in sortedMembers" :key="m.sub" class="group hover:bg-white/[0.02] transition-colors">
              <td class="py-2 px-4">
                <div class="flex items-center gap-3">
                  <span class="text-sm font-semibold text-white truncate max-w-[120px]">
                    {{ displayNameForSub(m.sub) }}
                  </span>
                  <div class="relative flex-shrink-0">
                    <img v-if="m.isLeader" :src="marganaLogo" alt="" class="w-8 h-8 transform scale-125 transition-transform group-hover:scale-[1.35]" />
                  </div>
                </div>
              </td>
              
              <td v-for="(day, idx) in week.days" :key="idx" class="px-2 text-center">
                <div v-if="scoreFor(m.sub, day.iso) === 'LOCKED'" class="inline-flex items-center justify-center p-1.5 rounded bg-white/5 text-white/20">
                  <CheckIcon class="w-4 h-4 text-white" />
                </div>
                <div v-else-if="typeof scoreFor(m.sub, day.iso) === 'number'" 
                     class="inline-block w-[34px] py-[1px] rounded font-semi text-sm border text-center"
                     :class="[
                       isTopForDay(m.sub, day.iso)
                         ? `bg-gradient-to-br ${dayBadgeBg[idx]} text-white border-white/20 shadow-sm`
                         : 'bg-white/5 text-white/60 border-white/5'
                     ]">
                  {{ scoreFor(m.sub, day.iso) }}
                </div>
                <div
                  v-else
                  class="inline-block w-[34px] py-[1px] rounded font-semi text-sm border text-center bg-white/5 text-white/60 border-white/5"
                >
                  -
                </div>
              </td>

              <td class="py-2 px-1 text-center">
                <div class="inline-flex min-w-[46px] px-1.5 py-[1px] rounded font-semi text-sm border text-center border-white/20 bg-[linear-gradient(45deg,rgb(35,141,132)_10%,rgb(250,204,21)_90%)] text-white shadow-sm justify-center whitespace-nowrap tabular-nums">
                  {{ formatNumber(m.total) }}
                </div>
              </td>
              <td v-if="canManage" class="py-1 px-1 text-center">
                <button
                    v-if="m.sub !== userSub && m.sub !== 'margana'"
                    @click="emit('kick', m.sub)"
                    class="p-1 rounded text-white/40 hover:text-white transition-all"
                    title="Remove Member"
                >
                  <TrashIcon class="w-4 h-4" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="py-12 text-center">
      <p class="text-white/40 text-sm italic">No scores available for this week yet.</p>
    </div>
    </template>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
