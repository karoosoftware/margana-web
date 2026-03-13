<script setup>
import {onMounted, ref, onBeforeUnmount, computed, watch} from 'vue'
import {useRouter} from 'vue-router'
import {fetchAuthSession} from 'aws-amplify/auth'
import {useMarganaAuth} from '@/composables/useMarganaAuth'
import {API} from '@/config/api'
import marganaLogo from '@/assets/margana_m_logo.svg'

const formatNumber = (n) => new Intl.NumberFormat('en-GB').format(n)

// Lightweight helper to dispatch usage events app-wide
function dispatchUsage(name, data) {
  try {
    window.dispatchEvent(new CustomEvent('margana-usage', {detail: {name, data}}))
  } catch (_) {
  }
}

// Mobile-first weekly leaderboard per active group

const loading = ref(true)
const error = ref('')
const groups = ref([])
const userLabels = ref({})
const {userSub, initialized, userTier} = useMarganaAuth()

// Today detection and viewer play status
const todayIso = (() => {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
})()
const todayYmd = todayIso.replace(/-/g, '')

// Caching helpers
const CACHE_KEY = 'margana.dashboard.cache'
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

function saveCache(data, sub) {
  try {
    const entry = {
      data,
      sub,
      ymd: todayYmd,
      ts: Date.now()
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry))
  } catch (_) {}
}

function loadCache(sub) {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const entry = JSON.parse(raw)
    // Cache must match user sub and current day
    if (!entry || entry.sub !== sub || entry.ymd !== todayYmd) return null
    return entry
  } catch (_) {
    return null
  }
}

function applyData(data) {
  if (!data) return
  groups.value = Array.isArray(data.groups) ? data.groups : []
  userLabels.value = (typeof data.user_labels === 'object') ? data.user_labels : {}
  scores.value = data.scores ? data.scores : {}
}

// Week dates: compute Monday..Sunday for current week
function getWeekDates(startDate = new Date()) {
  const d = new Date(startDate)
  // getDay: 0=Sun..6=Sat. We want Monday as start.
  const day = d.getDay()
  const diffToMon = (day === 0 ? -6 : 1 - day) // if Sunday (0), go back 6 days; else back to Monday
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
      dow: i, // 0..6 (Mon..Sun here)
    })
  }
  return {monday, days}
}

const week = ref(getWeekDates())
const dayLetters = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

// Mobile day selection state
const selectedDayIndex = ref(0)

function _initSelectedDayIndex() {
  try {
    const d = new Date()
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const iso = `${yyyy}-${mm}-${dd}`
    const idx = (week.value?.days || []).findIndex(day => day.iso === iso)
    selectedDayIndex.value = idx >= 0 ? idx : 0
  } catch (_) {
    selectedDayIndex.value = 0
  }
}

_initSelectedDayIndex()

function selectDay(idx) {
  const n = (week.value?.days || []).length
  if (idx < 0 || idx >= n) return
  selectedDayIndex.value = idx
}

const selectedDay = computed(() => {
  try {
    return (week.value?.days || [])[selectedDayIndex.value] || null
  } catch (_) {
    return null
  }
})

// Active groups only
const activeGroups = computed(() => {
  try {
    return (groups.value || []).filter(g => {
      const role = String(g?.role || '').toLowerCase()
      const status = String(g?.status || '').toLowerCase()
      // treat explicit member/admin/owner as active; anything explicitly pending as inactive
      if (role === 'member' || role === 'admin' || role === 'owner') return true
      if (status && status.includes('pending')) return false
      return !status // default to active if no status and not clearly pending
    })
  } catch (_) {
    return []
  }
})

// Scores map: { sub: { yyyymmdd: number } }
const scores = ref({})

function shortSub(sub) {
  return (sub || '').slice(0, 8) || 'unknown'
}

function displayNameForSub(sub) {
  try {
    const raw = (userLabels.value && userLabels.value[sub]) || shortSub(sub)
    const name = String(raw || '').trim()
    const parts = name.split(/\s+/).filter(Boolean)
    if (parts.length <= 1) return name
    const [first, ...rest] = parts
    return `${first}\n${rest.join(' ')}`
  } catch {
    return shortSub(sub)
  }
}

function initialForSub(sub) {
  try {
    const name = String(displayNameForSub(sub) || '').trim()
    return name ? name.charAt(0).toUpperCase() : '?'
  } catch (_) {
    return '?'
  }
}

async function fetchScores(forceLoading = false) {
  if (forceLoading) loading.value = true
  try {
    const session = await fetchAuthSession()
    const idToken = session?.tokens?.idToken?.toString()
    if (!idToken) throw new Error('Missing auth token')

    const mySub = userSub.value
    const dates = (week.value.days || []).map(d => d.ymd)
    const endpoint = API.MARGANA_DASHBOARD_SUMMARY
    
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ dates })
    })
    
    const txt = await res.text()
    let data = null
    try {
      data = JSON.parse(txt)
    } catch {
      data = null
    }
    
    if (!res.ok) throw new Error((data && (data.error || data.message)) || `API error ${res.status}`)

    // Update state and cache
    applyData(data)
    saveCache(data, mySub)

    // Re-inject synthetic Margana group if needed
    injectMarganaGroup()
  } finally {
    if (forceLoading) loading.value = false
  }
}

function injectMarganaGroup() {
  try {
    if (!userLabels.value['margana']) {
      userLabels.value = {...(userLabels.value || {}), margana: 'Margana'}
    }
    
    const mySub = userSub.value

    const exists = (groups.value || []).some(g => {
      const id = String(g?.id || g?.leaderboard_id || '')
      const nm = String(g?.name || '')
      return id === 'local:margana' || nm.toLowerCase() === 'margana'
    })
    
    if (!exists) {
      const memberSubs = []
      if (mySub) memberSubs.push(mySub)
      memberSubs.push('margana')
      const localGroup = {
        id: 'local:margana',
        name: 'Margana',
        role: 'member',
        member_count: 2,
        admin_count: 1,
        created_at: '',
        admin_subs: ['margana'],
        member_subs: memberSubs,
      }
      groups.value = [localGroup, ...(groups.value || [])]
    }
  } catch (_) {}
}

function scoreFor(sub, ymd) {
  try {
    return (scores.value?.[sub]?.[ymd] ?? null)
  } catch {
    return null
  }
}

function viewerHasScore(ymd) {
  try {
    const me = userSub.value
    if (!me) return false
    const v = scores.value?.[me]?.[ymd]
    return typeof v === 'number' && !Number.isNaN(v)
  } catch (_) {
    return false
  }
}

function formatDate(d) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${dd}.${mm}.${yyyy}`
}

// Compute the end (Sunday) of the current week based on the computed Monday
const weekEndDate = computed(() => {
  try {
    const mon = week.value?.monday
    if (!(mon instanceof Date)) return null
    const end = new Date(mon)
    end.setDate(end.getDate() + 6)
    return end
  } catch (_) {
    return null
  }
})

async function loadAll() {
  error.value = ''
  
  const mySub = userSub.value

  const cached = loadCache(mySub)
  if (cached) {
    applyData(cached.data)
    injectMarganaGroup()
    
    loading.value = false // Cache applied, stop showing initial loading state
    
    // If cache is very fresh, we can skip the network call entirely
    const age = Date.now() - (cached.ts || 0)
    if (age < CACHE_TTL_MS) {
      return
    }
    // Otherwise, we continue to background refresh
  } else {
    // No valid cache, show loading state
    loading.value = true
  }

  try {
    // Background (or foreground if no cache) refresh
    await fetchScores()
  } catch (e) {
    // Only surface error if we have no data at all to show
    if (!cached && !groups.value.length) {
      error.value = e?.message || String(e)
    }
  } finally {
    loading.value = false
  }
}

// Trigger initial load once auth is ready
watch(initialized, (isInit) => {
  if (isInit) {
    try {
      dispatchUsage('open_groups')
    } catch (_) {}
    loadAll()
  }
}, { immediate: true })

// Reload data if the user logs in or out while on this page
watch(userTier, (newTier, oldTier) => {
  if (initialized.value && newTier !== oldTier) {
    loadAll()
  }
})

const router = useRouter()

// Viewer is considered to have played today only when the server returns their score for today
const viewerPlayedToday = computed(() => viewerHasScore(todayYmd))

// Optional: listen for a play-completed event to re-fetch scores from the server (no local flags)
function onPlayedRefresh(evt) {
  try {
    const d = String(evt?.detail?.date || '')
    const played = !!evt?.detail?.hasPlayed
    if (d === todayIso && played) {
      fetchScores().catch(() => {
      })
    }
  } catch (_) { /* no-op */
  }
}

onMounted(() => {
  try {
    window.addEventListener('margana-played-status', onPlayedRefresh)
  } catch (_) {
  }
})

onBeforeUnmount(() => {
  try {
    window.removeEventListener('margana-played-status', onPlayedRefresh)
  } catch (_) {
  }
})

// Compute list of week date keys (yyyymmdd) for quick sums
const weekDateKeys = computed(() => (week.value?.days || []).map(d => d.ymd))

function totalForSubInGroup(g, sub) {
  try {
    let sum = 0
    const keys = weekDateKeys.value || []
    for (const ymd of keys) {
      // Visibility-aligned rules for totals:
      // - Future days: never include
      if (String(ymd) > String(todayYmd)) continue
      // - Today: include only after the viewer has played (same as cell visibility)
      if (ymd === todayYmd && !viewerHasScore(ymd)) continue
      const v = scores.value?.[sub]?.[ymd]
      if (typeof v === 'number' && !Number.isNaN(v)) sum += v
    }
    return sum
  } catch (_) {
    return 0
  }
}

function sortedMembers(g) {
  try {
    const members = Array.isArray(g?.member_subs) ? g.member_subs : []
    const arr = members.map(sub => ({sub, total: totalForSubInGroup(g, sub)}))
    // Stable sort: by total desc, then by display name asc for determinism
    arr.sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total
      const an = String(displayNameForSub(a.sub) || '')
      const bn = String(displayNameForSub(b.sub) || '')
      return an.localeCompare(bn)
    })
    const top = arr.length ? arr[0].total : null
    const hasPositiveTop = typeof top === 'number' && top > 0
    return arr.map(x => ({...x, isLeader: hasPositiveTop && x.total === top}))
  } catch (_) {
    return []
  }
}

// Themed day styles (Mon..Sun) inspired by Margana (indigo/purple/violet/orange)
const dayBadgeBg = [
  'from-indigo-500 to-violet-600',
  'from-violet-500 to-purple-600',
  'from-purple-500 to-fuchsia-600',
  'from-fuchsia-500 to-pink-600',
  'from-orange-500 to-pink-600',
  'from-orange-500 to-amber-600',
  'from-amber-500 to-orange-600',
]

// Helpers to detect Margana group and compare dates
function isMarganaGroup(g) {
  try {
    const id = String(g?.id || g?.leaderboard_id || '').toLowerCase()
    const nm = String(g?.name || '').toLowerCase()
    return id === 'local:margana' || nm === 'margana'
  } catch (_) {
    return false
  }
}

function isFutureDateISO(iso) {
  try {
    return String(iso) > String(todayIso)
  } catch (_) {
    return false
  }
}

function isPastDateISO(iso) {
  try {
    return String(iso) < String(todayIso)
  } catch (_) {
    return false
  }
}

// Determine the maximum score for a given group and day (returns null if no scores)
function maxScoreForGroupDay(g, ymd) {
  try {
    const members = Array.isArray(g?.member_subs) ? g.member_subs : []
    let any = false
    let max = -Infinity
    for (const sub of members) {
      const v = scoreFor(sub, ymd)
      if (typeof v === 'number' && !Number.isNaN(v)) {
        any = true
        if (v > max) max = v
      }
    }
    return any ? max : null
  } catch (_) {
    return null
  }
}

// True if this member has the top score (and top > 0) for that day in their group
function isTopForDay(g, sub, ymd) {
  try {
    const s = scoreFor(sub, ymd)
    if (s == null) return false
    const max = maxScoreForGroupDay(g, ymd)
    return (typeof max === 'number' && max > 0 && s === max)
  } catch (_) {
    return false
  }
}
</script>

<template>
  <div class="flex flex-col items-center justify-start min-h-full p-4">
    <div class="w-fit min-w-[24rem] max-w-3xl mx-auto px-3 sm:px-4">
      <div class="mb-1 flex flex-col sm:flex-row items-baseline justify-between gap-2">
        <div class="flex items-center gap-3">
          <h1 class="text-2xl sm:text-3xl font-bold text-white drop-shadow">
            Leaderboards
          </h1>
          <button 
            @click="fetchScores(true)" 
            :disabled="loading"
            class="p-1.5 rounded-full bg-white/10 text-white/80 hover:bg-white/20 transition-colors disabled:opacity-50"
            title="Refresh scores"
          >
            <svg
              class="w-5 h-5"
              :class="{ 'animate-spin': loading }" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Groups management hint -->
      <div
          class="w-full mb-4 px-2 py-3 backdrop-blur-md rounded-2xl p-3 sm:p-4 text-indigo-100
     transition-all duration-200 ease-out
    flex items-center justify-center gap-3 text-sm sm:text-base font-semibold"
      >

        <div class="flex items-center gap-2 flex-shrink-0">
          <span class="text-sm sm:text-base font-semibold text-indigo-100">Manage leaderboards</span>
          <router-link
              :to="{ name: 'groups' }"
              class="w-7 h-7 sm:w-8 sm:h-8
        p-1.5 rounded-full bg-white/10 text-white/80 hover:bg-white/20 transition-colors disabled:opacity-50
        flex items-center justify-center shadow-md"
              aria-label="Manage leaderboards"
          >
            <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M9 5l7 7-7 7"/>
            </svg>
          </router-link>
        </div>
      </div>

      <div v-if="loading" class="flex flex-col items-center mt-12 space-y-6">
        <div class="dots-loader" role="img" aria-label="Loading">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>
      </div>
      <div v-else-if="error" class="text-red-200">{{ error }}</div>

      <div v-else>
        <div v-if="!activeGroups || !activeGroups.length" class="text-indigo-100/80">You have no active groups.</div>
        <!-- Cards: stacked on mobile, grid on larger screens -->
        <div class="grid grid-cols-1 sm:grid-cols-1 gap-4">
          <div v-for="g in activeGroups" :key="g.id || g.leaderboard_id"
               class="bg-white/10 backdrop-blur rounded-lg p-4 shadow-lg border border-white/10 overflow-x-auto">
            <div class="mb-3 flex items-center justify-between">
              <div>
                <div class="text-white font-semibold text-lg flex items-center gap-3">
                  <span
                      class="inline-block w-2 h-2 rounded-full bg-gradient-to-tr from-purple-500 to-orange-500 shadow"></span>
                  {{ g.name || 'Untitled leaderboard' }}
                </div>
              </div>
            </div>

            <!-- Mobile view: day selector + member cards -->
            <div class="md:hidden">
              <!-- Day selector strip -->
              <div class="-mx-1 mb-3 overflow-x-auto">
                <div class="flex gap-2 px-1">
                  <button
                      v-for="(d, idx) in week.days"
                      :key="idx"
                      class="shrink-0 px-3 py-2 rounded-full text-sm transition shadow-sm ring-1 ring-white/10"
                      :class="[
                      selectedDayIndex === idx ? 'bg-gradient-to-tr from-violet-600 to-indigo-600 text-white' : 'bg-white/10 text-white/90',
                      isFutureDateISO(d.iso) ? 'opacity-60' : 'opacity-100'
                    ]"
                      :aria-selected="selectedDayIndex === idx"
                      role="tab"
                      @click="selectDay(idx)"
                  >
                    <span class="mr-1">{{ dayLetters[idx] }}</span>
                  </button>
                </div>
              </div>

              <!-- Selected day content: member cards -->
              <div v-if="selectedDay" class="space-y-2">
                <div
                    v-for="m in sortedMembers(g)"
                    :key="m.sub"
                    class="flex items-center justify-between px-3 py-2 rounded-lg shadow"
                >
                  <div class="flex items-center gap-2 min-w-0">
                    <div class="flex items-center justify-center text-white text-sm">
                      <span class="whitespace-pre-line">{{ displayNameForSub(m.sub) }}</span>
                    </div>
                    <div class="flex justify-center">
                      <img
                          v-if="m.isLeader"
                          :src="marganaLogo"
                          class="w-12 h-12 drop-shadow select-none"
                          aria-hidden="true"
                          title="Leader"
                      />
                    </div>
                  </div>


                  <!-- Score badge area per rules -->
                  <div class="flex items-center gap-2">
                    <template v-if="isMarganaGroup(g) && m.sub === 'margana'">
                      <!-- Future day: dash -->
                      <span v-if="isFutureDateISO(selectedDay.iso)"
                            class="inline-block min-w-[2.5rem] text-center tabular-nums px-2 py-1 rounded bg-white/5 text-white italic font-semibold">—</span>
                      <!-- Past day: show number and allow click -->
                      <template v-else-if="isPastDateISO(selectedDay.iso)">
                        <span v-if="scoreFor(m.sub, selectedDay.ymd) != null"
                              class="inline-block px-3 py-1 rounded text-white text-sm font-semibold shadow-sm"
                              :class="isTopForDay(g, m.sub, selectedDay.ymd) ? ['bg-gradient-to-tr', dayBadgeBg[selectedDayIndex]] : ['bg-white/10', 'ring-1', 'ring-white/10']"
                              :title="`Open game board for ${selectedDay.iso}`">
                          {{ scoreFor(m.sub, selectedDay.ymd) }}
                        </span>
                        <span v-else
                              class="inline-block min-w-[2.5rem] text-center tabular-nums px-2 py-1 rounded bg-white/5 text-white italic font-semibold">—</span>
                      </template>
                      <!-- Today: before viewer plays show tick, after viewer plays show score and allow click -->
                      <template v-else>
                        <template v-if="!viewerPlayedToday">
                          <span v-if="scoreFor(m.sub, selectedDay.ymd) != null"
                                class="inline-flex items-center justify-center gap-1 px-2 py-1 rounded text-white font-semibold shadow-sm ring-1 ring-white/10 bg-white/10"
                                :title="'Scores locked — play this day to view'">
                            <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none"
                                 xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                              <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                                    stroke-linejoin="round"/>
                            </svg>
                          </span>
                          <span v-else
                                class="inline-block min-w-[2.5rem] text-center tabular-nums px-2 py-1 rounded bg-white/5 text-white italic font-semibold">—</span>
                        </template>
                        <template v-else>
                          <span v-if="scoreFor(m.sub, selectedDay.ymd) != null"
                                class="inline-block px-3 py-1 rounded text-white text-sm font-semibold shadow-sm"
                                :class="isTopForDay(g, m.sub, selectedDay.ymd) ? ['bg-gradient-to-tr', dayBadgeBg[selectedDayIndex]] : ['bg-white/10', 'ring-1', 'ring-white/10']"
                                :title="`Open game board for ${selectedDay.iso}`">
                            {{ scoreFor(m.sub, selectedDay.ymd) }}
                          </span>
                          <span v-else
                                class="inline-block min-w-[2.5rem] text-center tabular-nums px-2 py-1 rounded bg-white/5 text-white italic font-semibold">—</span>
                        </template>
                      </template>
                    </template>

                    <!-- Default rules for others -->
                    <template v-else>
                      <template v-if="selectedDay.iso === todayIso && !viewerPlayedToday">
                        <span v-if="scoreFor(m.sub, selectedDay.ymd) != null"
                              class="inline-flex items-center justify-center gap-1 px-2 py-1 rounded text-white font-semibold shadow-sm ring-1 ring-white/10 bg-white/10"
                              :title="'Scores locked — play this day to view'">
                          <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none"
                               xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                                  stroke-linejoin="round"/>
                          </svg>
                        </span>
                        <span v-else
                              class="inline-block min-w-[2.5rem] text-center tabular-nums px-2 py-1 rounded bg-white/5 text-white italic font-semibold">—</span>
                      </template>
                      <template v-else>
                        <template v-if="scoreFor(m.sub, selectedDay.ymd) != null">
                          <span
                              class="inline-block px-3 py-1 rounded text-white text-sm font-semibold shadow-sm"
                              :class="isTopForDay(g, m.sub, selectedDay.ymd) ? ['bg-gradient-to-tr', dayBadgeBg[selectedDayIndex]] : ['bg-white/10', 'ring-1', 'ring-white/10']"
                              :title="`Open game board for ${selectedDay.iso}`"
                          >
                            {{ scoreFor(m.sub, selectedDay.ymd) }}
                          </span>
                        </template>
                        <span v-else
                              class="inline-block min-w-[2.5rem] text-center tabular-nums px-2 py-1 rounded bg-white/5 text-white italic font-semibold">—</span>
                      </template>
                    </template>

                    <!-- Weekly total badge -->
                    <span
                        class="inline-block min-w-[2.5rem] text-center tabular-nums px-2 py-1 rounded font-semibold text-sm shadow-sm ring-1 ring-white/10 bg-[linear-gradient(45deg,rgb(35,141,132)_10%,rgb(250,204,21)_90%)] text-white">
                      {{ formatNumber(m.total) }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Desktop/tablet view: original weekly table -->
            <div class="hidden md:block overflow-x-auto">
              <table class="w-full text-xs">
                <thead>
                <tr class="text-indigo-100/90">
                  <th class="text-left font-semibold pr-2 pb-2"></th>
                  <th class="px-2 pb-2 text-center font-semibold text-white select-none"></th>
                  <th
                      v-for="(d, idx) in week.days"
                      :key="idx"
                      class="px-2 pb-2 text-center font-semibold text-white select-none"
                  >
                    {{ dayLetters[idx] }}
                  </th>
                  <th class="px-2 pb-2 text-center font-semibold text-white select-none"></th>
                </tr>
                </thead>
                <tbody>
                <tr v-for="m in sortedMembers(g)" :key="m.sub">
                  <td class="py-1 pr-1">
                    <div class="inline-flex items-center gap-2">
                        <span
                            class="px-2 py-1 rounded-md text-white text-xs sm:text-sm font-semibold shadow-sm flex items-center gap-1">
                          <span class="whitespace-pre-line leading-tight">{{ displayNameForSub(m.sub) }}</span>
                        </span>
                    </div>
                  </td>
                  <td class="px-1 py-1 text-center">
                    <span class="inline-flex justify-center">
                      <img
                          v-if="m.isLeader"
                          :src="marganaLogo"
                          class="w-12 h-12 drop-shadow select-none"
                          aria-hidden="true"
                          title="Leader"
                      />
                    </span>
                  </td>
                  <td
                      v-for="(d, idx) in week.days"
                      :key="idx"
                      class="px-2 py-2 text-center rounded"
                  >
                    <!-- Special rules for Margana user within the default Margana group -->
                    <template v-if="isMarganaGroup(g) && m.sub === 'margana'">
                      <!-- Future days: always show dash (not clickable) -->
                      <span v-if="isFutureDateISO(d.iso)"
                            class="inline-block min-w-[2.5rem] text-center tabular-nums px-2 py-1 rounded bg-white/5 text-white italic font-semibold"
                            :title="'Not available yet'">—</span>
                      <!-- Past days: reveal Margana's score number; clickable to open the game board -->
                      <template v-else-if="isPastDateISO(d.iso)">
                          <span v-if="scoreFor(m.sub, d.ymd) != null"
                                class="inline-block min-w-[2.5rem] text-center tabular-nums px-2 py-1 rounded text-white font-semibold shadow-sm"
                                :class="isTopForDay(g, m.sub, d.ymd) ? ['bg-gradient-to-tr', dayBadgeBg[idx]] : ['bg-white/10', 'ring-1', 'ring-white/10']"
                                :title="`Open game board for ${d.iso}`">
                            {{ scoreFor(m.sub, d.ymd) }}
                          </span>
                        <span v-else
                              class="inline-block min-w-[2.5rem] text-center tabular-nums px-2 py-1 rounded bg-white/5 text-white italic font-semibold">—</span>
                      </template>
                      <!-- Current day: before viewer plays show tick, after viewer plays show score and allow click -->
                      <template v-else>
                        <template v-if="!viewerPlayedToday">
                            <span
                                v-if="scoreFor(m.sub, d.ymd) != null"
                                class="inline-flex items-center justify-center gap-1 px-2 py-1 rounded text-white font-semibold shadow-sm ring-1 ring-white/10 bg-white/10"
                                :title="'Scores locked — play this day to view'"
                            >
                              <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none"
                                   xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                                      stroke-linejoin="round"/>
                              </svg>
                            </span>
                          <span v-else
                                class="inline-block min-w-[2.5rem] text-center tabular-nums px-2 py-1 rounded bg-white/5 text-white italic font-semibold">—</span>
                        </template>
                        <template v-else>
                            <span v-if="scoreFor(m.sub, d.ymd) != null"
                                  class="inline-block min-w-[2.5rem] text-center tabular-nums px-2 py-1 rounded text-white font-semibold shadow-sm"
                                  :class="isTopForDay(g, m.sub, d.ymd) ? ['bg-gradient-to-tr', dayBadgeBg[idx]] : ['bg-white/10', 'ring-1', 'ring-white/10']"
                                  :title="`Open game board for ${d.iso}`"
                            >
                              {{ scoreFor(m.sub, d.ymd) }}
                            </span>
                          <span v-else
                                class="inline-block min-w-[2.5rem] text-center tabular-nums px-2 py-1 rounded bg-white/5 text-white italic font-semibold">—</span>
                        </template>
                      </template>
                    </template>

                    <!-- Default rules for all other members/groups -->
                    <template v-else>
                      <!-- For current day: hide numbers until viewer has played. Show tick if member has a score. -->
                      <template v-if="d.iso === todayIso && !viewerPlayedToday">
                          <span
                              v-if="scoreFor(m.sub, d.ymd) != null"
                              class="inline-flex items-center justify-center gap-1 px-2 py-1 rounded text-white font-semibold shadow-sm ring-1 ring-white/10 bg-white/10"
                              :title="'Scores locked — play this day to view'"
                          >
                            <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none"
                                 xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                              <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                                    stroke-linejoin="round"/>
                            </svg>
                          </span>
                        <span v-else
                              class="inline-block min-w-[2.5rem] text-center tabular-nums px-2 py-1 rounded bg-white/5 text-white italic font-semibold">—</span>
                      </template>
                      <!-- Other days or after viewer has played: show real numbers with top-score highlight only -->
                      <template v-else>
                        <template v-if="scoreFor(m.sub, d.ymd) != null">
                            <span
                                class="inline-block min-w-[2.5rem] text-center tabular-nums px-2 py-1 rounded text-white font-semibold shadow-sm"
                                :class="isTopForDay(g, m.sub, d.ymd) ? ['bg-gradient-to-tr', dayBadgeBg[idx]] : ['bg-white/10', 'ring-1', 'ring-white/10']"
                                :title="`Open game board for ${d.iso}`"
                            >
                              {{ scoreFor(m.sub, d.ymd) }}
                            </span>
                        </template>
                        <span v-else
                              class="inline-block min-w-[2.5rem] text-center tabular-nums px-2 py-1 rounded bg-white/5 text-white italic font-semibold">—</span>
                      </template>
                    </template>
                  </td>
                  <td class="px-2 py-2 text-center">
                      <span
                          class="inline-block min-w-[2.5rem] text-center tabular-nums px-2 py-1 rounded font-semibold shadow-sm ring-1 ring-white/10 bg-[linear-gradient(45deg,rgb(35,141,132)_10%,rgb(250,204,21)_90%)] text-white">
                        {{ formatNumber(m.total) }}
                      </span>
                  </td>
                </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>
