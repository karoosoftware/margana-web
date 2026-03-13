<script setup>
import {ref, onMounted, computed} from 'vue'
import {useRouter, useRoute} from 'vue-router'
import {fetchAuthSession} from 'aws-amplify/auth'
import {API} from '@/config/api'
import AppBrand from '../components/AppBrand.vue'
import {useMarganaAuth} from '@/composables/useMarganaAuth'
import marganaLogo from '@/assets/margana_m_logo.svg'

// Groups page: list groups the user belongs to and create new groups via API

const router = useRouter()
const route = useRoute()
const {userSub, userLabel} = useMarganaAuth()

// Simple cache: sub -> display name, persisted in localStorage
const userCache = ref({})

function loadUserCache() {
  try {
    userCache.value = JSON.parse(localStorage.getItem('margana.userCache') || '{}') || {}
  } catch {
    userCache.value = {}
  }
}

function saveUserCache() {
  try {
    localStorage.setItem('margana.userCache', JSON.stringify(userCache.value || {}))
  } catch (_) {
  }
}

// Ensure a friendly label for the synthetic Margana user sub we use in the hard-coded group
function ensureMarganaLabel() {
  try {
    const upd = {...(userCache.value || {})}
    if (!upd['margana']) upd['margana'] = 'Margana'
    userCache.value = upd
    saveUserCache()
  } catch (_) { /* ignore */
  }
}

function shortSub(sub) {
  return (sub || '').slice(0, 8) || 'unknown'
}

function displayNameForSub(sub) {
  try {
    return (userCache.value && userCache.value[sub]) || shortSub(sub)
  } catch {
    return shortSub(sub)
  }
}

function nonAdminMembers(g) {
  const members = Array.isArray(g?.member_subs) ? g.member_subs : []
  const admins = Array.isArray(g?.admin_subs) ? g.admin_subs : []
  return members.filter(s => !admins.includes(s))
}

function ensureCurrentUserInCache() {
  try {
    const sub = userSub.value
    const name = userLabel.value
    if (sub) {
      userCache.value = {...(userCache.value || {}), [sub]: name || shortSub(sub)}
      saveUserCache()
    }
  } catch (_) { /* ignore */
  }
}

// Today detection
const todayIso = (() => {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
})()
const todayYmd = todayIso.replace(/-/g, '')

// Caching helpers (shared with GroupsCardScore.vue)
const DASHBOARD_CACHE_KEY = 'margana.dashboard.cache'
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

function saveDashboardCache(data, sub) {
  try {
    const entry = {
      data,
      sub,
      ymd: todayYmd,
      ts: Date.now()
    }
    localStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(entry))
  } catch (_) {
  }
}

function loadDashboardCache(sub) {
  try {
    const raw = localStorage.getItem(DASHBOARD_CACHE_KEY)
    if (!raw) return null
    const entry = JSON.parse(raw)
    if (!entry || entry.sub !== sub || entry.ymd !== todayYmd) return null
    return entry
  } catch (_) {
    return null
  }
}

function applyDashboardData(data) {
  if (!data) return
  groups.value = Array.isArray(data.groups) ? data.groups : []

  // Merge server-provided preferred names (user_labels)
  try {
    const labels = (data && typeof data.user_labels === 'object' && data.user_labels) ? data.user_labels : null
    const upd = {...(userCache.value || {})}
    if (labels) {
      for (const [k, v] of Object.entries(labels)) {
        if (k) upd[k] = (typeof v === 'string' && v) ? v : (upd[k] || shortSub(k))
      }
    }
    userCache.value = upd
    saveUserCache()
  } catch (_) {
  }
}

const groupName = ref('')
const error = ref(null)
const success = ref(null)
const submitting = ref(false)

const loadingGroups = ref(true)
const groupsError = ref(null)
const groups = ref([])


// Week dates: compute Monday..Sunday for current week (to keep cache consistent with scores)
function getWeekDates(startDate = new Date()) {
  const d = new Date(startDate)
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
    days.push({ymd: `${yyyy}${mm}${dd}`})
  }
  return days
}

// Per-item action states for pending approvals
const actionLoading = ref({}) // { [groupId]: 'approve' | 'deny' }
const actionError = ref({}) // { [groupId]: string }

function setActionState(gid, kind) {
  try {
    actionLoading.value = {...(actionLoading.value || {}), [gid]: kind}
    actionError.value = {...(actionError.value || {}), [gid]: ''}
  } catch (_) {
  }
}

function clearActionState(gid) {
  try {
    const al = {...(actionLoading.value || {})}
    const ae = {...(actionError.value || {})}
    delete al[gid]
    // keep ae message unless cleared explicitly
    actionLoading.value = al
    actionError.value = ae
  } catch (_) {
  }
}

async function approvePending(g) {
  const gid = String(g?.id || g?.leaderboard_id || '')
  if (!gid) return
  setActionState(gid, 'approve')
  try {
    const session = await fetchAuthSession()
    const idToken = session?.tokens?.idToken?.toString()
    if (!idToken) throw new Error('Missing auth token')
    const endpoint = API.MARGANA_UPDATE_GROUP_PENDING
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Authorization: `Bearer ${idToken}`},
      body: JSON.stringify({leaderboard_id: gid, action: 'approve'})
    })
    const text = await res.text()
    let data = null
    try {
      data = JSON.parse(text)
    } catch {
      data = {message: text}
    }
    if (!res.ok) {
      const msg = (data && (data.error || data.message)) ? (data.error || data.message) : `API error ${res.status}`
      throw new Error(msg)
    }
    await fetchGroups()
  } catch (e) {
    actionError.value = {...(actionError.value || {}), [gid]: (e?.message || String(e))}
  } finally {
    clearActionState(gid)
  }
}

async function denyPending(g) {
  const gid = String(g?.id || g?.leaderboard_id || '')
  if (!gid) return
  setActionState(gid, 'deny')
  try {
    const session = await fetchAuthSession()
    const idToken = session?.tokens?.idToken?.toString()
    if (!idToken) throw new Error('Missing auth token')
    const endpoint = API.MARGANA_UPDATE_GROUP_PENDING
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Authorization: `Bearer ${idToken}`},
      body: JSON.stringify({leaderboard_id: gid, action: 'deny'})
    })
    const text = await res.text()
    let data = null
    try {
      data = JSON.parse(text)
    } catch {
      data = {message: text}
    }
    if (!res.ok) {
      const msg = (data && (data.error || data.message)) ? (data.error || data.message) : `API error ${res.status}`
      throw new Error(msg)
    }
    await fetchGroups()
  } catch (e) {
    actionError.value = {...(actionError.value || {}), [gid]: (e?.message || String(e))}
  } finally {
    clearActionState(gid)
  }
}

// Split groups into pending approvals and active/accepted
function isPending(g) {
  try {
    // Normalize potential fields
    const fields = []
    const pushStr = (v) => {
      if (v != null) fields.push(String(v).toLowerCase())
    }
    pushStr(g?.status)
    pushStr(g?.role)
    pushStr(g?.state)
    pushStr(g?.membership_status)
    pushStr(g?.approval_status)

    // Any textual indication
    const txtHit = fields.some(s => (
        s === 'pending' || s === 'pending_approval' || s === 'awaiting' || s === 'awaiting_approval' ||
        s === 'requested' || s === 'request_pending' || s === 'not_approved' || s === 'invite' || s === 'invited' || s.includes('pending') || s.includes('await') || s.includes('invited')
    ))

    // Boolean/flag style
    const boolHit = (
        g?.pending === true || g?.awaiting === true || g?.is_pending === true || g?.isPending === true ||
        g?.approved === false || g?.isApproved === false || g?.accepted === false || g?.is_member === false || g?.isMember === false ||
        g?.approval === 0 || g?.approved_flag === 0
    )

    // If role clearly says admin/member/owner, consider active even if other flags are unclear
    const role = String(g?.role || '').toLowerCase()
    const isClearlyActiveRole = role === 'admin' || role === 'member' || role === 'owner'

    if (isClearlyActiveRole) return false

    // If id exists but no role and booleans/strings indicate waiting -> pending
    if (txtHit || boolHit) return true

    // Default: not pending
    return false
  } catch (_) {
    return false
  }
}

const pendingGroups = computed(() => {
  try {
    return (groups.value || []).filter(g => isPending(g))
  } catch (_) {
    return []
  }
})
const activeGroups = computed(() => {
  try {
    // console.log(groups.value)
    return (groups.value || []).filter(g => !isPending(g))
  } catch (_) {
    return []
  }
})


// Cache the groups list to help the Group details page retrieve info on refresh
function cacheGroups(list) {
  try {
    localStorage.setItem('margana.groups.cache', JSON.stringify(list || []))
  } catch (_) {
  }
}

function resetStatus() {
  error.value = null;
  success.value = null
}


async function fetchGroups(forceLoading = false) {
  groupsError.value = null
  if (forceLoading) loadingGroups.value = true
  try {
    const session = await fetchAuthSession()
    const idToken = session?.tokens?.idToken?.toString()
    if (!idToken) throw new Error('Missing auth token')

    const mySub = userSub.value
    const dates = getWeekDates().map(d => d.ymd)
    const endpoint = API.MARGANA_DASHBOARD_SUMMARY

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Authorization: `Bearer ${idToken}`},
      body: JSON.stringify({dates}) // Fetch scores too to keep cache rich for Leaderboards page
    })

    const text = await res.text()
    let data = null
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
    if (!res.ok) throw new Error((data && (data.error || data.message)) || `API error ${res.status}`)

    applyDashboardData(data)
    saveDashboardCache(data, mySub)

    // Inject the hard-coded "Margana" competition group
    injectMarganaGroup(idToken, data)

    cacheGroups(groups.value)
  } catch (e) {
    groupsError.value = e?.message || String(e)
    // if we have no groups yet, clear them
    if (!groups.value.length) groups.value = []
  } finally {
    if (forceLoading) loadingGroups.value = false
  }
}

function injectMarganaGroup(idToken, data) {
  try {
    let mySub = userSub.value
    ensureMarganaLabel()

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
        role: 'member', // current user is a member
        member_count: 2,
        admin_count: 1,
        created_at: '',
        admin_subs: ['margana'],
        member_subs: memberSubs,
      }
      groups.value = [localGroup, ...(groups.value || [])]
    }
  } catch (_) { /* ignore */
  }
}

async function loadAll() {
  resetStatus()

  // Try to load from cache immediately
  let mySub = ''
  let idToken = ''
  try {
    const session = await fetchAuthSession()
    idToken = session?.tokens?.idToken?.toString() || ''
    mySub = userSub.value
  } catch (_) {
  }

  const cached = loadDashboardCache(mySub)
  if (cached) {
    applyDashboardData(cached.data)
    if (idToken) injectMarganaGroup(idToken, cached.data)

    // Ensure the groups list cache is up-to-date for the Group details page
    cacheGroups(groups.value)

    loadingGroups.value = false // Cache applied, stop showing initial loading state

    // If cache is fresh, skip network
    const age = Date.now() - (cached.ts || 0)
    if (age < CACHE_TTL_MS) return
  } else {
    loadingGroups.value = true
  }

  try {
    await fetchGroups()
  } finally {
    loadingGroups.value = false
  }
}

async function handleCreateGroup(ev) {
  ev?.preventDefault?.()
  resetStatus()
  const name = groupName.value.trim()
  if (!name) {
    error.value = 'Please enter a leaderboard name';
    return
  }
  if (name.length < 3) {
    error.value = 'Leaderboard name must be at least 3 characters';
    return
  }
  try {
    submitting.value = true
    // Acquire auth token
    const session = await fetchAuthSession()
    const idToken = session?.tokens?.idToken?.toString()
    if (!idToken) throw new Error('Missing auth token')

    const endpoint = API.MARGANA_CREATE_GROUP
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Authorization: `Bearer ${idToken}`},
      body: JSON.stringify({name})
    })
    const text = await res.text()
    let data = null
    try {
      data = JSON.parse(text)
    } catch {
      data = {message: text}
    }
    if (!res.ok) {
      const msg = (data && (data.error || data.message)) ? (data.error || data.message) : `API error ${res.status}`
      throw new Error(msg)
    }

    // Success
    const display = data?.message || data?.status || 'Leaderboard created successfully'
    const id = data?.id || data?.leaderboardId || data?.leaderboard_id
    success.value = id ? 'Leaderboard created successfully' : display
    groupName.value = ''
    // Refresh groups after create
    try {
      await fetchGroups()
    } catch (_) {
    }
    try {
      cacheGroups(groups.value)
    } catch (_) {
    }
  } catch (e) {
    error.value = e?.message || String(e)
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  loadUserCache();
  ensureMarganaLabel();
  ensureCurrentUserInCache();
  loadAll().catch(() => {
  });
})
</script>

<template>
  <div class="flex flex-col items-center justify-start min-h-full p-4">
    <div class="w-full max-w-2xl">

      <!-- Page header: breadcrumb under navbar, outside the group card -->
      <div class="mb-4 flex items-center justify-between gap-3">
        <nav aria-label="Breadcrumb" class="flex items-center text-xs sm:text-sm text-indigo-200/80">
          <router-link :to="{ name: 'group-scores' }" class="inline-flex items-center gap-1 hover:text-white">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M8 12l-3 3m0 0l3 3m-3-3h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                    stroke-linejoin="round"/>
            </svg>
            <span>Leaderboards</span>
          </router-link>
          <svg class="mx-2 w-4 h-4 opacity-70" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                  stroke-linejoin="round"/>
          </svg>
          <span class="text-white">Manage leaderboards</span>
        </nav>
      </div>



      <!-- Access notices from redirects -->
      <div v-if="route.query.denied === '1'"
           class="mb-3 p-3 rounded-lg border border-red-400/30 bg-red-500/10 text-red-100 text-sm">
        You don’t have access to that leaderboard
      </div>
      <div v-else-if="route.query.notfound === '1'"
           class="mb-3 p-3 rounded-lg border border-yellow-400/30 bg-yellow-500/10 text-yellow-100 text-sm">
        That leaderboard couldn’t be found
      </div>

      <div class="bg-white/10 backdrop-blur rounded-lg p-4 sm:p-6 shadow-lg border border-white/10">

        <form @submit="handleCreateGroup" class="space-y-3">
          <div>
            <label for="groupName" class="block text-sm text-indigo-100 mb-1">Leaderboard name</label>
            <input
                id="groupName"
                v-model="groupName"
                type="text"
                placeholder="e.g. Word wizards"
                class="form-input"
            />
          </div>
          <div class="flex items-center gap-2">
            <div v-if="submitting" class="flex items-center mt-2" role="img" aria-label="Creating leaderboard">
              <span class="dots-loader">
                <span class="dot"></span>
                <span class="dot"></span>
                <span class="dot"></span>
              </span>
            </div>
            <button v-else type="submit"
                    class="btn-common-button">
              Create
            </button>
            <span v-if="error" class="text-sm text-red-200">{{ error }}</span>
            <span v-if="success" class="text-sm text-white">{{ success }}</span>
          </div>
        </form>
      </div>

      <div class="mt-6 mb-6 text-indigo-100/90">
        <h1 class="text-sm sm:text-base font-bold text-white drop-shadow mb-2">
          You always compete against Margana, but can you beat her?
        </h1>
        <p class="text-sm sm:text-base">
          Every time you play, you will automatically compete in all the leaderboards you belong to
        </p>
      </div>


      <!-- Groups list -->
      <div>
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-lg font-semibold text-white">Leaderboards</h2>
          <button
              @click="fetchGroups(true)"
              :disabled="loadingGroups"
              class="p-1.5 rounded-full bg-white/10 text-white/80 hover:bg-white/20 transition-colors disabled:opacity-50"
              title="Refresh leaderboards"
          >
            <svg
                class="w-5 h-5"
                :class="{ 'animate-spin': loadingGroups }"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
          </button>
        </div>
        <div v-if="loadingGroups" class="flex flex-col items-center mt-12 space-y-6">
          <div class="dots-loader" role="img" aria-label="Loading">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </div>
        </div>
        <div v-else-if="groupsError" class="text-red-200 text-sm">{{ groupsError }}</div>
        <div v-else>
          <div v-if="(!pendingGroups || !pendingGroups.length) && (!activeGroups || !activeGroups.length)"
               class="text-indigo-100/80 text-sm">You are not a member of any leaderboards yet.
          </div>

          <!-- Pending approvals -->
          <div v-if="pendingGroups && pendingGroups.length" class="mb-4">
            <div class="text-sm text-indigo-100/90 mb-2">Pending approvals</div>
            <div role="list">
              <div
                  v-for="(g, idx) in pendingGroups"
                  :key="g.id || g.leaderboard_id"
                  role="listitem"
                  class="flex flex-col"
              >
                <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between p-3 hover:bg-white/10 transition">
                  <div class="flex items-start gap-3 min-w-0 pr-3">
                    <img
                        :src="marganaLogo"
                        alt=""
                        aria-hidden="true"
                        class="w-15 h-15 drop-shadow select-none"
                        draggable="false"
                    />
                    <div class="min-w-0">
                      <div class="text-white font-semibold truncate leading-tight">{{ g.name || 'Untitled leaderboard' }}</div>
                      <div class="text-indigo-200/80 text-xs mt-1 space-y-0.5">
                        <div class="flex">
                          <span class="w-24 shrink-0">Status:</span>
                          <span class="flex-1 min-w-0">Pending approval</span>
                        </div>
                        <div v-if="g.member_count != null" class="flex">
                          <span class="w-24 shrink-0">Members:</span>
                          <span class="flex-1 min-w-0">{{ g.member_count }}</span>
                        </div>
                        <div v-if="g.admin_count != null" class="flex">
                          <span class="w-24 shrink-0">Administrator:</span>
                          <span class="flex-1 min-w-0">{{ g.admin_count }}</span>
                        </div>
                      </div>
                      <div class="text-red-200 text-xs mt-1" v-if="actionError[g.id || g.leaderboard_id]">
                        {{ actionError[g.id || g.leaderboard_id] }}
                      </div>
                    </div>
                  </div>
                  <div class="flex flex-row flex-wrap items-center gap-2 w-full sm:w-auto justify-end sm:ml-4">
                    <div v-if="actionLoading[g.id || g.leaderboard_id] === 'approve'" class="flex items-center" role="img" aria-label="Approving">
                      <span class="dots-loader">
                        <span class="dot"></span>
                        <span class="dot"></span>
                        <span class="dot"></span>
                      </span>
                    </div>
                    <button v-else type="button"
                            class="btn-common-button"
                            @click="approvePending(g)">
                      Approve
                    </button>
                    <div v-if="actionLoading[g.id || g.leaderboard_id] === 'deny'" class="flex items-center" role="img" aria-label="Denying">
                      <span class="dots-loader">
                        <span class="dot"></span>
                        <span class="dot"></span>
                        <span class="dot"></span>
                      </span>
                    </div>
                    <button v-else type="button"
                            class="btn-common-button"
                            @click="denyPending(g)">
                      Deny
                    </button>
                  </div>
                </div>
                <div class="h-[1px] w-full bg-white/30"></div>
              </div>
            </div>
          </div>

          <!-- Active/accepted groups -->
          <div v-if="activeGroups && activeGroups.length">
            <div role="list">
              <div
                  v-for="(g, idx) in activeGroups"
                  :key="g.id || g.leaderboard_id"
                  role="listitem"
                  class="flex flex-col"
              >
                <div
                    class="flex items-center justify-between p-3 cursor-pointer hover:bg-white/10 transition"
                    @click="$router.push({ name: 'group', params: { id: g.id || g.leaderboard_id } })"
                >
                  <div class="flex items-center gap-3">
                    <img
                        :src="marganaLogo"
                        alt=""
                        aria-hidden="true"
                        class="w-15 h-15 drop-shadow select-none"
                        draggable="false"
                    />
                    <div>
                      <div class="text-white font-semibold">{{ g.name || 'Untitled leaderboard' }}</div>
                    <div class="text-indigo-100/90 text-xs mt-1 flex"
                         v-if="Array.isArray(g.admin_subs) && g.admin_subs.length">
                      <span class="w-24 shrink-0">Administrator:</span>
                      <span class="flex-1 min-w-0">
                        {{ g.admin_subs.slice(0, 5).map(s => displayNameForSub(s)).join(', ') }}<span
                          v-if="g.admin_subs.length > 5">, +{{ g.admin_subs.length - 5 }} more</span>
                      </span>
                    </div>
                    <div class="text-indigo-100/90 text-xs mt-1 flex"
                         v-if="nonAdminMembers(g).length">
                      <span class="w-24 shrink-0">Members:</span>
                      <span class="flex-1 min-w-0">
                        {{
                          nonAdminMembers(g).slice(0, 5).map(s => displayNameForSub(s)).join(', ')
                        }}<span
                          v-if="nonAdminMembers(g).length > 5">, +{{
                          nonAdminMembers(g).length - 5
                      }} more</span>
                    </span>
                  </div>
                  </div>
                  </div>
                </div>
                <div v-if="idx < activeGroups.length - 1" class="h-[1px] w-full bg-white/30"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
