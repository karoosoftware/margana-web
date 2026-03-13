import { ref } from 'vue'
import { fetchAuthSession, getCurrentUser } from 'aws-amplify/auth'
import { API } from '@/config/api'
import { isoWeekId, mondayOfWeek, todayIsoLocal } from './useGuestMetrics'

const loading = ref(false)
const error = ref('')
const data = ref(null)

export function useRegisteredMetrics() {

  async function loadRegisteredData(referenceDate = new Date(), forceRefresh = false) {
    loading.value = true
    error.value = ''

    try {
      const session = await fetchAuthSession()
      const idToken = session?.tokens?.idToken?.toString()
      if (!idToken) throw new Error('You are not authenticated. Please sign in again.')

      const current = await getCurrentUser()
      const sub = current?.userId || current?.username
      if (!sub) throw new Error('Unable to determine user identity.')

      const weekId = isoWeekId(referenceDate)
      const dayId = todayIsoLocal()
      const cacheKey = `margana.metrics.reg.${sub}.${dayId}`

      if (!forceRefresh) {
        try {
          const cached = localStorage.getItem(cacheKey)
          if (cached) {
            const parsed = JSON.parse(cached)
            if (parsed && parsed.week_id === weekId) {
              data.value = parsed
              loading.value = false
              return data.value
            }
          }
        } catch (e) {
          console.warn('Failed to load cached metrics:', e)
        }
      }

      const reqPayload = {
        weekId: weekId,
        user: `USER#${sub}`,
      }

      const res = await fetch(API.MARGANA_METRIC, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(reqPayload)
      })

      const text = await res.text()
      let body = null
      try { body = JSON.parse(text) } catch { body = { error: text } }
      
      if (!res.ok) {
        const msg = body?.error || body?.message || `Request failed (${res.status}).`
        if (res.status === 404 || /no weekly records/i.test(String(msg))) {
          // Synthesize a minimal payload
          const ws = mondayOfWeek(referenceDate)
          const yyyy = ws.getUTCFullYear()
          const mm = String(ws.getUTCMonth() + 1).padStart(2, '0')
          const dd = String(ws.getUTCDate()).padStart(2, '0')
          data.value = {
            week_id: weekId,
            week_start: `${yyyy}-${mm}-${dd}`,
            days: [],
            margana_daily_scores: {},
            user_daily_scores: {},
            margana_cumulative: {},
            user_cumulative: {},
            percentage_daily: {},
            percentage_cumulative: {},
            position_daily: {},
            users_in_week: 0,
            current_streak: 0,
            streak_points: 0,
            pb: null
          }
          return data.value
        }
        throw new Error(msg)
      }

      data.value = body?.data || body
      
      // Cache successful response
      try {
        localStorage.setItem(cacheKey, JSON.stringify(data.value))
        performHousekeeping(sub)
      } catch (e) {
        console.warn('Failed to cache metrics:', e)
      }

      return data.value
    } catch (e) {
      error.value = e?.message || String(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  function performHousekeeping(sub) {
    try {
      const prefix = `margana.metrics.reg.${sub}.`
      const keys = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith(prefix)) {
          keys.push(key)
        }
      }

      if (keys.length <= 7) return

      // Sort keys by dayId (the part after the prefix)
      // dayId format is YYYY-MM-DD, which sorts alphabetically correctly for chronological order
      keys.sort((a, b) => {
        const dayA = a.substring(prefix.length)
        const dayB = b.substring(prefix.length)
        return dayB.localeCompare(dayA) // Descending (newest first)
      })

      // Keep the first 7, remove the rest
      const toRemove = keys.slice(7)
      toRemove.forEach(key => localStorage.removeItem(key))
    } catch (e) {
      console.warn('Housekeeping failed:', e)
    }
  }

  async function invalidateCache(referenceDate = new Date()) {
    try {
      const current = await getCurrentUser()
      const sub = current?.userId || current?.username
      if (!sub) return
      
      const dayId = todayIsoLocal()
      const cacheKey = `margana.metrics.reg.${sub}.${dayId}`
      localStorage.removeItem(cacheKey)
    } catch (_) {
      // Ignore errors in invalidation
    }
  }

  async function saveToCache(metricsData) {
    try {
      const current = await getCurrentUser()
      const sub = current?.userId || current?.username
      if (!sub) return

      const weekId = metricsData?.week_id
      if (!weekId) return

      const dayId = todayIsoLocal()
      const cacheKey = `margana.metrics.reg.${sub}.${dayId}`
      localStorage.setItem(cacheKey, JSON.stringify(metricsData))
      performHousekeeping(sub)

      // Update active ref if it matches
      data.value = metricsData
    } catch (e) {
      console.warn('Failed to save metrics to cache:', e)
    }
  }

  async function acknowledgeAchievement(achievement) {
    try {
      const session = await fetchAuthSession()
      const idToken = session?.tokens?.idToken?.toString()
      if (!idToken) return

      const current = await getCurrentUser()
      const sub = current?.userId || current?.username
      if (!sub) return

      const payload = {
        action: 'acknowledge',
        user: `USER#${sub}`,
        achievement_type: achievement.type,
        milestone_name: achievement.name || achievement.last_milestone_name
      }

      await fetch(API.MARGANA_METRIC, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(payload)
      })
      
      // Update local cache if we have it
      if (data.value && data.value.badges) {
        const b = data.value.badges.find(x => x.type === achievement.type)
        if (b) {
          b.last_celebrated_name = achievement.name
          saveToCache(data.value)
        }
      }
    } catch (e) {
      console.warn('Failed to acknowledge achievement:', e)
    }
  }

  return {
    loading,
    error,
    data,
    loadRegisteredData,
    invalidateCache,
    saveToCache,
    acknowledgeAchievement
  }
}
