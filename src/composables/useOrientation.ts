import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'

export function useOrientation(endOfGame = ref(false)) {
  const isLandscape = ref(false)
  const isSmallDevice = ref(false)
  const isTouchDevice = ref(false)
  const immersiveOverrideOff = ref(false)

  const landscapeMobileMode = computed(() => 
    isLandscape.value && 
    isSmallDevice.value && 
    isTouchDevice.value &&
    !endOfGame.value && 
    !immersiveOverrideOff.value
  )

  function updateOrientationFlags() {
    try {
      // Orientation
      const mm = window.matchMedia && window.matchMedia('(orientation: landscape)')
      isLandscape.value = !!(mm ? mm.matches : (window.innerWidth > window.innerHeight))
      
      // Small device heuristic: target phones, avoid tablets/desktop
      const shortest = Math.min(window.innerWidth || 0, window.innerHeight || 0)
      isSmallDevice.value = shortest > 0 ? shortest <= 700 : false

      // Touch device detection to distinguish from desktop browsers with small height
      isTouchDevice.value = !!(
        ('ontouchstart' in window) ||
        (navigator.maxTouchPoints > 0) ||
        (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
      )
    } catch (_) {
      isLandscape.value = false
      isSmallDevice.value = false
      isTouchDevice.value = false
    }
  }

  function applyImmersiveBodyClass(on: boolean) {
    try {
      const cls = 'landscape-immersive'
      if (on) {
        document.body.classList.add(cls)
      } else {
        document.body.classList.remove(cls)
      }
    } catch (_) {
      /* ignore */
    }
  }

  function toggleImmersiveOverride() {
    immersiveOverrideOff.value = !immersiveOverrideOff.value
  }

  const onResize = () => updateOrientationFlags()
  const onOrient = () => updateOrientationFlags()

  onMounted(() => {
    updateOrientationFlags()
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onOrient)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', onResize)
    window.removeEventListener('orientationchange', onOrient)
    applyImmersiveBodyClass(false)
  })

  // Watchers
  watch(landscapeMobileMode, (val) => {
    applyImmersiveBodyClass(!!val)
  }, { immediate: true })

  // If we rotate back to portrait, clear the manual override so next landscape can enter immersive
  watch(() => isLandscape.value, (land) => {
    if (!land) {
      immersiveOverrideOff.value = false
    }
  })

  return {
    isLandscape,
    isSmallDevice,
    isTouchDevice,
    immersiveOverrideOff,
    landscapeMobileMode,
    toggleImmersiveOverride,
    updateOrientationFlags // Exposed for manual trigger if needed
  }
}
