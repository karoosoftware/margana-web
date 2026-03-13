import { ref, computed } from 'vue'
import { fetchAuthSession } from 'aws-amplify/auth'
import { API } from '@/config/api'
import { cache, CacheType } from '@/utils/cache'

export enum LeaderboardTab {
  My = 'my',
  Public = 'public',
  Manage = 'manage'
}

export interface MyLeaderboard {
  id: string
  name: string
  role: string
  status: string
  created_at: string
  member_count?: number
  admin_count?: number
  is_public?: boolean
}

export interface PublicLeaderboard {
  id: string
  name: string
  average_weekly_score: number
  member_count: number
  is_public: boolean
  auto_approve: boolean
  created_at: string
  user_role?: string
}

export interface LeaderboardDetail {
  id: string
  name: string
  role: string
  status: string // Added to detect invitation status
  is_public: boolean
  auto_approve: boolean
  average_weekly_score: number
  created_at: string
  member_count: number
  admin_count: number
  member_subs: string[]
  admin_subs: string[]
  user_labels: Record<string, string>
  has_history?: boolean
}

export interface JoinRequest {
  user_sub: string
  status: string
  created_at: string
  user_label?: string
}

export interface HistoricalStanding {
  sub: string
  rank: number
  score: number
  username: string
  games_played: number
  total_members: number
  snapshot_at: string
}

// Helper to get ISO week consistently with Python's isocalendar
function getISOWeek(date: Date): [number, number] {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return [d.getUTCFullYear(), weekNo]
}

function _get_last_completed_week_id(): string {
  const now = new Date()
  const lastWeekDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const [year, week] = getISOWeek(lastWeekDate)
  return `${year}-W${week.toString().padStart(2, '0')}`
}

const cleanupOldHistoryCache = () => {
  if (typeof window === 'undefined') return
  const lastWeekId = _get_last_completed_week_id()
  const prefix = 'margana_cache_history_'
  
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith(prefix)) {
      try {
        const val = localStorage.getItem(key)
        if (!val) return
        const entry = JSON.parse(val)
        if (entry && entry.data && entry.data.week_id !== lastWeekId) {
          localStorage.removeItem(key)
        }
      } catch (e) {
        localStorage.removeItem(key)
      }
    }
  })
}

// Singleton state to share across components
const activeTab = ref<LeaderboardTab>(LeaderboardTab.My)

const myLeaderboards = ref<MyLeaderboard[]>([])
const loadingMy = ref(false)
const myError = ref<string | null>(null)

const publicLeaderboards = ref<PublicLeaderboard[]>([])
const loadingPublic = ref(false)
const publicError = ref<string | null>(null)
const publicNextCursor = ref<string | null>(null)
const sortBy = ref<'highest' | 'entry'>('highest')
const selectedMyFilters = ref<string[]>([])

const currentLeaderboard = ref<LeaderboardDetail | null>(null)
const loadingDetail = ref(false)
const detailError = ref<string | null>(null)
const detailErrorCode = ref<number | null>(null)

const PLAY_MARGANA_METADATA: LeaderboardDetail = {
  id: 'play-margana',
  name: 'Play Margana',
  role: 'member',
  status: 'active',
  is_public: false,
  auto_approve: false,
  average_weekly_score: 0,
  created_at: '2024-01-01T00:00:00Z',
  member_count: 2,
  admin_count: 1,
  member_subs: [],
  admin_subs: ['margana'],
  user_labels: { 'margana': 'Margana' },
  has_history: true
}

const joinRequests = ref<JoinRequest[]>([])
const loadingRequests = ref(false)
const requestsError = ref<string | null>(null)

const leaderboardScores = ref<Record<string, any>>({})
const loadingScores = ref(false)
const scoresError = ref<string | null>(null)

const historicalStandings = ref<HistoricalStanding[]>([])
const loadingHistory = ref(false)
const historyError = ref<string | null>(null)
const historyWeekId = ref<string | null>(null)

const clearLeaderboardCaches = (id?: string) => {
  cache.remove('my_leaderboards', CacheType.Persisted)
  cache.remove('public_leaderboards_highest', CacheType.Persisted)
  cache.remove('public_leaderboards_entry', CacheType.Persisted)
  if (id) {
    cache.remove(`leaderboard_${id}`, CacheType.Persisted)
    cache.remove(`scores_${id}`, CacheType.Memory)
    cache.remove(`history_${id}`, CacheType.Persisted)
    cache.remove(`join_requests_${id}`, CacheType.Session)
  }
}

const hasMorePublic = computed(() => !!publicNextCursor.value)

const filteredMyLeaderboards = computed(() => {
  if (selectedMyFilters.value.length === 0) return myLeaderboards.value
  
  return myLeaderboards.value.filter(board => {
    return selectedMyFilters.value.every(filterId => {
      if (filterId === 'admin') return board.role === 'admin'
      if (filterId === 'member') return board.role === 'member'
      if (filterId === 'public') return board.is_public === true
      if (filterId === 'private') return board.is_public === false
      return false
    })
  })
})

// Listen for storage events to sync across tabs
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === 'margana_cache_my_leaderboards') {
      if (event.newValue) {
        try {
          const entry = JSON.parse(event.newValue)
          if (entry && entry.data) {
            myLeaderboards.value = entry.data
          }
        } catch (e) {
          // ignore
        }
      } else {
        myLeaderboards.value = []
      }
    } else if (
      event.key === 'margana_cache_public_leaderboards_highest' ||
      event.key === 'margana_cache_public_leaderboards_entry'
    ) {
      const targetSort = event.key.endsWith('_highest') ? 'highest' : 'entry'
      // Only update the visible list if the changed cache corresponds to the current sort mode
      if (event.newValue) {
        try {
          const entry = JSON.parse(event.newValue)
          if (entry && entry.data && sortBy.value === targetSort) {
            const payload = entry.data
            publicLeaderboards.value = payload.leaderboards || []
            publicNextCursor.value = payload.next_cursor || null
          }
        } catch (e) {
          // ignore
        }
      } else if (sortBy.value === targetSort) {
        publicLeaderboards.value = []
        publicNextCursor.value = null
      }
    }
  })
}

export function useLeaderboard() {
  const setActiveTab = (tab: LeaderboardTab) => {
    activeTab.value = tab
  }

  const setMyFilters = (filters: string[]) => {
    selectedMyFilters.value = filters
  }

  const fetchMyLeaderboards = async (opts: { reset?: boolean; force?: boolean } = {}) => {
    if (loadingMy.value) return
    
    if (!opts.force) {
      const cached = cache.get<any[]>('my_leaderboards', CacheType.Persisted)
      if (cached) {
        myLeaderboards.value = cached
        loadingMy.value = false
        return
      }
    }

    loadingMy.value = true
    myError.value = null
    if (opts.reset !== false) {
      myLeaderboards.value = []
    }

    try {
      const session = await fetchAuthSession()
      const token = session.tokens?.idToken?.toString()
      
      const resp = await fetch(API.LEADERBOARDS, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!resp.ok) {
        throw new Error(`Failed to fetch your leaderboards: ${resp.statusText}`)
      }

      const data = await resp.json()
      myLeaderboards.value = data.leaderboards || []
      cache.set('my_leaderboards', myLeaderboards.value, 300, CacheType.Persisted) // 5 mins
    } catch (err: any) {
      myError.value = err.message || 'An error occurred'
    } finally {
      loadingMy.value = false
    }
  }

  const fetchPublicLeaderboards = async (opts: { reset?: boolean; force?: boolean } | boolean = {}) => {
    if (loadingPublic.value) return
    
    const actualOpts = typeof opts === 'boolean' ? { reset: opts } : opts
    const reset = actualOpts.reset ?? false
    if (reset) {
      publicLeaderboards.value = []
      publicNextCursor.value = null
    }

    if (!actualOpts.force && reset) {
      const cacheKey = `public_leaderboards_${sortBy.value}`
      const cached = cache.get<any>(cacheKey, CacheType.Persisted)
      if (cached) {
        publicLeaderboards.value = cached.leaderboards
        publicNextCursor.value = cached.next_cursor
        loadingPublic.value = false
        return
      }
    }

    loadingPublic.value = true
    publicError.value = null

    try {
      const session = await fetchAuthSession()
      const token = session.tokens?.idToken?.toString()
      
      const url = new URL(API.LEADERBOARDS_PUBLIC)
      url.searchParams.append('sort', sortBy.value)
      url.searchParams.append('limit', '20')
      if (publicNextCursor.value) {
        url.searchParams.append('next_cursor', publicNextCursor.value)
      }

      const resp = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!resp.ok) {
        throw new Error(`Failed to fetch public leaderboards: ${resp.statusText}`)
      }

      const data = await resp.json()
      if (reset) {
        publicLeaderboards.value = data.leaderboards || []
        // Only cache the first page
        const cacheKey = `public_leaderboards_${sortBy.value}`
        cache.set(cacheKey, {
          leaderboards: publicLeaderboards.value,
          next_cursor: data.next_cursor
        }, 900, CacheType.Persisted) // 15 mins
      } else {
        publicLeaderboards.value = [...publicLeaderboards.value, ...(data.leaderboards || [])]
      }
      publicNextCursor.value = data.next_cursor || null
    } catch (err: any) {
      publicError.value = err.message || 'An error occurred'
    } finally {
      loadingPublic.value = false
    }
  }

  const joinLeaderboard = async (id: string) => {
    try {
      const session = await fetchAuthSession()
      const token = session.tokens?.idToken?.toString()

      const resp = await fetch(API.LEADERBOARD_JOIN(id), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}))
        throw new Error(data.error || data.message || `Failed to join: ${resp.statusText}`)
      }

      clearLeaderboardCaches(id)
      return await resp.json()
    } catch (err: any) {
      throw err
    }
  }

  const resolveInvitation = async (id: string, action: 'accept' | 'deny') => {
    try {
      const session = await fetchAuthSession()
      const token = session.tokens?.idToken?.toString()

      const resp = await fetch(API.LEADERBOARD_INVITATIONS(id), {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action })
      })

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}))
        throw new Error(data.error || data.message || `Failed to ${action} invitation: ${resp.statusText}`)
      }

      clearLeaderboardCaches(id)
      return await resp.json()
    } catch (err: any) {
      throw err
    }
  }

  const fetchLeaderboardDetail = async (id: string, force = false) => {
    if (id === 'play-margana') {
      currentLeaderboard.value = PLAY_MARGANA_METADATA
      loadingDetail.value = false
      return
    }

    if (!force) {
      const cached = cache.get<LeaderboardDetail>(`leaderboard_${id}`, CacheType.Persisted)
      if (cached) {
        currentLeaderboard.value = cached
        loadingDetail.value = false
        return
      }
    }

    loadingDetail.value = true
    detailError.value = null
    detailErrorCode.value = null
    try {
      const session = await fetchAuthSession()
      const token = session.tokens?.idToken?.toString()

      const resp = await fetch(`${API.LEADERBOARDS}/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!resp.ok) {
        detailErrorCode.value = resp.status
        if (resp.status === 403 || resp.status === 404) {
          clearLeaderboardCaches(id)
        }
        const data = await resp.json().catch(() => ({}))
        throw new Error(data.error || data.message || `Failed to fetch leaderboard: ${resp.statusText}`)
      }

      currentLeaderboard.value = await resp.json()
      if (currentLeaderboard.value) {
        cache.set(`leaderboard_${id}`, currentLeaderboard.value, 600, CacheType.Persisted) // 10 mins
      }
    } catch (err: any) {
      detailError.value = err.message || 'An error occurred'
    } finally {
      loadingDetail.value = false
    }
  }

  const fetchJoinRequests = async (id: string, force = false) => {
    if (!force) {
      const cached = cache.get<JoinRequest[]>(`join_requests_${id}`, CacheType.Session)
      if (cached) {
        joinRequests.value = cached
        loadingRequests.value = false
        return
      }
    }

    loadingRequests.value = true
    requestsError.value = null
    try {
      const session = await fetchAuthSession()
      const token = session.tokens?.idToken?.toString()

      const resp = await fetch(API.LEADERBOARD_REQUESTS(id), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!resp.ok) {
        if (resp.status === 403 || resp.status === 404) {
          clearLeaderboardCaches(id)
        }
        const data = await resp.json().catch(() => ({}))
        throw new Error(data.error || data.message || 'Failed to fetch join requests')
      }

      const data = await resp.json()
      joinRequests.value = data.requests || []
      cache.set(`join_requests_${id}`, joinRequests.value, 60, CacheType.Session) // 1 min
    } catch (err: any) {
      requestsError.value = err.message || 'An error occurred'
    } finally {
      loadingRequests.value = false
    }
  }

  const fetchLeaderboardScores = async (id: string, force = false) => {
    if (!force) {
      const cached = cache.get<any>(`scores_${id}`, CacheType.Memory)
      if (cached) {
        leaderboardScores.value = cached.scores || {}
        if (currentLeaderboard.value && cached.user_labels) {
          currentLeaderboard.value.user_labels = {
            ...currentLeaderboard.value.user_labels,
            ...cached.user_labels
          }
        }
        loadingScores.value = false
        return
      }
    }

    loadingScores.value = true
    scoresError.value = null
    try {
      const session = await fetchAuthSession()
      const token = session.tokens?.idToken?.toString()

      const resp = await fetch(API.LEADERBOARD_SCORES(id), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!resp.ok) {
        if (resp.status === 403 || resp.status === 404) {
          clearLeaderboardCaches(id)
        }
        const data = await resp.json().catch(() => ({}))
        throw new Error(data.error || data.message || `Failed to fetch scores: ${resp.statusText}`)
      }

      const data = await resp.json()
      // The API returns { scores: { sub: { date: score } }, user_labels: { sub: label } }
      leaderboardScores.value = data.scores || {}
      
      // Also update labels if currentLeaderboard is present
      if (currentLeaderboard.value && data.user_labels) {
        currentLeaderboard.value.user_labels = {
          ...currentLeaderboard.value.user_labels,
          ...data.user_labels
        }
      }
      cache.set(`scores_${id}`, data, 120, CacheType.Memory) // 2 mins
    } catch (err: any) {
      scoresError.value = err.message || 'An error occurred'
    } finally {
      loadingScores.value = false
    }
  }

  const fetchLeaderboardHistory = async (id: string, weekId?: string, force = false) => {
    // Run housekeeping before checking cache
    cleanupOldHistoryCache()

    if (!force) {
      const cached = cache.get<any>(`history_${id}`, CacheType.Persisted)
      // Ensure we only use cache if it's the requested week OR the latest completed week if no weekId specified
      const targetWeek = weekId || _get_last_completed_week_id()
      if (cached && cached.week_id === targetWeek) {
        historicalStandings.value = cached.standings || []
        historyWeekId.value = cached.week_id
        loadingHistory.value = false
        return
      }
    }

    loadingHistory.value = true
    historyError.value = null
    try {
      const session = await fetchAuthSession()
      const token = session.tokens?.idToken?.toString()

      const url = new URL(API.LEADERBOARD_HISTORY(id))
      if (weekId) {
        url.searchParams.append('week_id', weekId)
      }

      const resp = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!resp.ok) {
        if (resp.status === 403 || resp.status === 404) {
          clearLeaderboardCaches(id)
        }
        const data = await resp.json().catch(() => ({}))
        throw new Error(data.error || data.message || `Failed to fetch history: ${resp.statusText}`)
      }

      const data = await resp.json()
      historicalStandings.value = data.standings || []
      historyWeekId.value = data.week_id
      cache.set(`history_${id}`, data, 3600 * 24, CacheType.Persisted) // 24 hours
    } catch (err: any) {
      historyError.value = err.message || 'An error occurred'
    } finally {
      loadingHistory.value = false
    }
  }

  const resolveJoinRequest = async (id: string, userSub: string, action: 'approve' | 'deny') => {
    try {
      const session = await fetchAuthSession()
      const token = session.tokens?.idToken?.toString()

      const resp = await fetch(API.LEADERBOARD_RESOLVE_REQUEST(id, userSub), {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action })
      })

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}))
        throw new Error(data.error || data.message || `Failed to ${action} request`)
      }

      // Remove from local list
      joinRequests.value = joinRequests.value.filter(r => r.user_sub !== userSub)
      if (action === 'approve') {
        clearLeaderboardCaches(id)
      } else {
        cache.remove(`join_requests_${id}`, CacheType.Session)
      }
      return await resp.json()
    } catch (err: any) {
      throw err
    }
  }

  const deleteLeaderboard = async (id: string) => {
    try {
      const session = await fetchAuthSession()
      const token = session.tokens?.idToken?.toString()

      const resp = await fetch(`${API.LEADERBOARDS}/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}))
        throw new Error(data.error || data.message || 'Failed to delete leaderboard')
      }

      clearLeaderboardCaches(id)
      return await resp.json()
    } catch (err: any) {
      throw err
    }
  }

  const leaveLeaderboard = async (id: string) => {
    try {
      const session = await fetchAuthSession()
      const token = session.tokens?.idToken?.toString()

      const resp = await fetch(API.LEADERBOARD_MEMBERS(id), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}))
        throw new Error(data.error || data.message || 'Failed to leave leaderboard')
      }

      clearLeaderboardCaches(id)
      return await resp.json()
    } catch (err: any) {
      throw err
    }
  }

  const kickMember = async (id: string, userSub: string) => {
    try {
      const session = await fetchAuthSession()
      const token = session.tokens?.idToken?.toString()

      const url = new URL(API.LEADERBOARD_MEMBERS(id))
      url.searchParams.append('user_sub', userSub)

      const resp = await fetch(url.toString(), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}))
        throw new Error(data.error || data.message || 'Failed to kick member')
      }

      clearLeaderboardCaches(id)
      // Optimistically remove kicked member from in-memory scores so the UI updates immediately
      if (leaderboardScores.value && leaderboardScores.value[userSub]) {
        const next = { ...leaderboardScores.value }
        delete next[userSub]
        leaderboardScores.value = next
      }
      if (currentLeaderboard.value?.id === id) {
        await fetchLeaderboardDetail(id, true)
        await fetchLeaderboardScores(id, true)
      }
      return await resp.json()
    } catch (err: any) {
      throw err
    }
  }

  const promoteMember = async (id: string, userSub: string) => {
    try {
      const session = await fetchAuthSession()
      const token = session.tokens?.idToken?.toString()

      const resp = await fetch(API.LEADERBOARD_UPDATE_MEMBER(id, userSub), {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: 'admin' })
      })

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}))
        throw new Error(data.error || data.message || 'Failed to promote member')
      }

      clearLeaderboardCaches(id)
      if (currentLeaderboard.value?.id === id) {
        await fetchLeaderboardDetail(id, true)
      }
      return await resp.json()
    } catch (err: any) {
      throw err
    }
  }

  const inviteMember = async (id: string, email: string) => {
    try {
      const session = await fetchAuthSession()
      const token = session.tokens?.idToken?.toString()

      const resp = await fetch(API.LEADERBOARD_INVITE, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ leaderboard_id: id, email })
      })

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}))
        throw new Error(data.error || data.message || 'Failed to send invite')
      }

      return await resp.json()
    } catch (err: any) {
      throw err
    }
  }

  const updateLeaderboardSettings = async (id: string, settings: { name?: string; is_public?: boolean; auto_approve?: boolean }) => {
    try {
      const session = await fetchAuthSession()
      const token = session.tokens?.idToken?.toString()

      const resp = await fetch(`${API.LEADERBOARDS}/${id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      })

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}))
        throw new Error(data.error || data.message || 'Failed to update settings')
      }

      const result = await resp.json()
      
      // Invalidate relevant caches
      clearLeaderboardCaches(id)

      // Update local state and cache if it matches
      if (currentLeaderboard.value?.id === id) {
        if (settings.name !== undefined) currentLeaderboard.value.name = settings.name
        if (settings.is_public !== undefined) currentLeaderboard.value.is_public = settings.is_public
        if (settings.auto_approve !== undefined) currentLeaderboard.value.auto_approve = settings.auto_approve
        
        cache.set(`leaderboard_${id}`, currentLeaderboard.value, 600, CacheType.Persisted) // 10 mins
      }
      return result
    } catch (err: any) {
      throw err
    }
  }

  const checkLeaderboardName = async (name: string): Promise<{ available: boolean; error?: string }> => {
    try {
      const session = await fetchAuthSession()
      const token = session.tokens?.idToken?.toString()
      const url = new URL(API.LEADERBOARD_CHECK_NAME)
      url.searchParams.append('name', name)

      const resp = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}))
        return { available: false, error: data.error || data.message || 'Error checking name' }
      }

      const data = await resp.json()
      return { available: data.available, error: data.error }
    } catch (err: any) {
      return { available: false, error: err.message || 'Connection error' }
    }
  }

  const resetLeaderboardDetail = () => {
    currentLeaderboard.value = null
    leaderboardScores.value = {}
    historicalStandings.value = []
    historyWeekId.value = null
    detailError.value = null
    detailErrorCode.value = null
    scoresError.value = null
    historyError.value = null
  }

  const resetAll = () => {
    myLeaderboards.value = []
    publicLeaderboards.value = []
    publicNextCursor.value = null
    resetLeaderboardDetail()
    clearLeaderboardCaches()
  }

  return {
    activeTab,
    setActiveTab,
    LeaderboardTab,
    myLeaderboards,
    loadingMy,
    myError,
    fetchMyLeaderboards,
    selectedMyFilters,
    filteredMyLeaderboards,
    setMyFilters,
    publicLeaderboards,
    loadingPublic,
    publicError,
    publicNextCursor,
    sortBy,
    hasMorePublic,
    fetchPublicLeaderboards,
    joinLeaderboard,
    resolveInvitation,
    currentLeaderboard,
    loadingDetail,
    detailError,
    detailErrorCode,
    fetchLeaderboardDetail,
    joinRequests,
    loadingRequests,
    requestsError,
    fetchJoinRequests,
    leaderboardScores,
    loadingScores,
    scoresError,
    fetchLeaderboardScores,
    historicalStandings,
    loadingHistory,
    historyError,
    historyWeekId,
    fetchLeaderboardHistory,
    resolveJoinRequest,
    updateLeaderboardSettings,
    checkLeaderboardName,
    deleteLeaderboard,
    leaveLeaderboard,
    kickMember,
    promoteMember,
    inviteMember,
    resetLeaderboardDetail,
    resetAll
  }
}
