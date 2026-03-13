import { computed } from 'vue'
import { isoWeekId, mondayFromWeekId, mondayOfWeek } from './useGuestMetrics'

/**
 * Composable to extract and process specific user achievements.
 * 
 * @param {import('vue').Ref<Array>} userBadgesRef - Ref to the list of user badges/achievements
 * @param {import('vue').Ref<String>} currentWeekIdRef - Optional Ref to the current week ID being viewed
 */
export function useUserAchievements(userBadgesRef, currentWeekIdRef = null) {
  const highestScoreEver = computed(() => {
    const b = (userBadgesRef.value || []).find(x => x.type === 'HIGHEST_SCORE_EVER')
    return b ? b.count : 0
  })

  const highestWeeklyScoreEver = computed(() => {
    const b = (userBadgesRef.value || []).find(x => x.type === 'HIGHEST_WEEKLY_SCORE_EVER')
    return b ? b.count : 0
  })

  const lastWeeksRanking = computed(() => {
    const b = (userBadgesRef.value || []).find(x => x.type === 'CURRENT_RANKING')
    if (!b) return null

    // Staleness check
    let expectedWeekId = ''
    if (currentWeekIdRef && currentWeekIdRef.value) {
      // If we are viewing a specific week, "last week" is the week before that
      const mon = mondayFromWeekId(currentWeekIdRef.value)
      mon.setUTCDate(mon.getUTCDate() - 1) // Sunday of previous week
      expectedWeekId = isoWeekId(mon)
    } else {
      // Fallback: use current date to find what "last week" should be
      const mon = mondayOfWeek(new Date())
      mon.setUTCDate(mon.getUTCDate() - 1) // Sunday of previous week
      expectedWeekId = isoWeekId(mon)
    }

    // milestone_name contains e.g. "Rank 5 (2025-W05)"
    const name = b.last_milestone_name || ''
    if (name.includes(expectedWeekId)) {
      return b.count
    }
    return 'Unranked'
  })

  return {
    highestScoreEver,
    highestWeeklyScoreEver,
    lastWeeksRanking
  }
}
