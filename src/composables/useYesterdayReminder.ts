import { ref } from 'vue'
import { checkUserPlayed, getYesterdayDateISO } from '@/services/puzzleResultsService'
import { UserTier } from './useMarganaAuth'

export function useYesterdayReminder() {
  const showYesterdayReminder = ref(false)
  let reminderDismissedSession = false

  function getCurrentDateString() {
    return new Date().toISOString().split('T')[0]
  }

  function dismissYesterdayReminder() {
    if (!showYesterdayReminder.value || reminderDismissedSession) return
    showYesterdayReminder.value = false
    reminderDismissedSession = true
    try {
      const todayStr = getCurrentDateString()
      localStorage.setItem('margana_yesterday_reminder_shown', todayStr)
    } catch (_) {}
  }

  async function initYesterdayReminder(
      userSub: string | null,
      isAuthenticated: boolean,
      userTier: UserTier,
      endOfGame: { value: boolean }
  ) {
    if (userTier < UserTier.REGISTERED) return

    const todayStr = getCurrentDateString()
    const lastShown = localStorage.getItem('margana_yesterday_reminder_shown')
    if (lastShown === todayStr) return
    if (!isAuthenticated || !userSub) return

    // Delay showing the nudge to let the page settle
    setTimeout(async () => {
      // Don't show if user already started playing or game ended
      if (endOfGame.value || reminderDismissedSession) return

      try {
        const played = await checkUserPlayed(userSub, getYesterdayDateISO())
        if (played && !endOfGame.value && !reminderDismissedSession) {
          showYesterdayReminder.value = true
        }
      } catch (e) {
        // Ignore errors
      }
    }, 2500)
  }

  return {
    showYesterdayReminder,
    dismissYesterdayReminder,
    initYesterdayReminder
  }
}
