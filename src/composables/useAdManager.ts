import { ref, watch, onMounted, onBeforeUnmount } from 'vue'

export function useAdManager() {
  const shuffleCount = ref(0)
  const sessionStartTime = ref(Date.now())
  const lastActivityTime = ref(Date.now())
  const isIdle = ref(false)
  const IDLE_THRESHOLD = 5000 // 5 seconds

  const updateActivity = () => {
    lastActivityTime.value = Date.now()
    isIdle.value = false
  }

  let idleTimer: any = null
  const checkIdle = () => {
    if (Date.now() - lastActivityTime.value > IDLE_THRESHOLD) {
      isIdle.value = true
    }
  }

  // Exposed for testing
  const _checkIdle = checkIdle

  onMounted(() => {
    idleTimer = setInterval(checkIdle, 1000)
    if (typeof window !== 'undefined') {
      window.addEventListener('mousemove', updateActivity)
      window.addEventListener('keydown', updateActivity)
      window.addEventListener('touchstart', updateActivity)
    }
  })

  onBeforeUnmount(() => {
    if (idleTimer) clearInterval(idleTimer)
    if (typeof window !== 'undefined') {
      window.removeEventListener('mousemove', updateActivity)
      window.removeEventListener('keydown', updateActivity)
      window.removeEventListener('touchstart', updateActivity)
    }
  })

  const incrementShuffleCount = () => {
    shuffleCount.value++
  }

  const triggerInterstitial = () => {
    // Requirements: 5 minutes played OR 10 shuffles
    const minutesPlayed = (Date.now() - sessionStartTime.value) / 60000
    if (minutesPlayed >= 5 || shuffleCount.value >= 10) {
      if (isIdle.value) {
        // console.log('[AdManager] Triggering Interstitial Ad')
        // Here we would call the Google H5 SDK
        // For now, let's just reset tracking
        shuffleCount.value = 0
        sessionStartTime.value = Date.now()
      } else {
        // console.log('[AdManager] Ad trigger deferred: User is active')
      }
    }
  }

  // Watch for triggers
  watch([shuffleCount, isIdle], () => {
    if (isIdle.value) {
      triggerInterstitial()
    }
  })

  return {
    shuffleCount,
    isIdle,
    incrementShuffleCount,
    triggerInterstitial,
    _checkIdle
  }
}
