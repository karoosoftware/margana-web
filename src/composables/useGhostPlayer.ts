import { ref, nextTick, type Ref } from 'vue'

export const ANAGRAM_TIMINGS = {
  SOURCE_PULSE_DURATION: 1200,
  WAIT_AFTER_SOURCE_PULSE: 800,
  WAIT_AFTER_CONSUME: 400,
  TARGET_PULSE_DURATION: 1200,
  WAIT_AFTER_TARGET_PULSE: 1000,
  TYPING_DELAY: 2000
}

export function useGhostPlayer(options: {
  speedMultiplier?: number,
  isTutorialActive?: Ref<boolean>,
  isPlaying: Ref<boolean>,
  isAutoPlay?: Ref<boolean>,
  nextStep?: () => void,
  tutorialSteps?: Ref<any[]>,
  currentStepIndex?: Ref<number>,
  onStepStart?: (step: any, index?: number) => void
}) {
  const speedMultiplier = ref(options.speedMultiplier ?? 0.5)
  const isPlaying = options.isPlaying
  // Fallback to a ref that is always true if not provided
  const isTutorialActive = options.isTutorialActive ?? ref(true)
  const isAutoPlay = options.isAutoPlay ?? ref(true)
  const nextStep = options.nextStep
  const tutorialSteps = options.tutorialSteps
  const currentStepIndex = options.currentStepIndex
  const onStepStart = options.onStepStart

  const isSilverRingAction = (targetId?: string) => {
    return targetId === 'margana-anagram-shuffle-btn' ||
      targetId === 'margana-anagram-reset-btn' ||
      targetId === 'margana-anagram-verify-btn' ||
      targetId === 'margana-submit-btn' ||
      targetId === 'margana-submit-btn-tutorial'
  }

  async function simulateTyping(targetId: string, text: string, delayOverride?: number) {
    if (!text) return

    if (targetId.startsWith('grid-cell-')) {
      const letters = text.split('')
      let currentTargetId = targetId
      for (const char of letters) {
        if (!isPlaying.value || !isTutorialActive.value) break

        let el = document.getElementById(currentTargetId) as HTMLInputElement
        if (!el) {
          await new Promise(resolve => setTimeout(resolve, 500 * speedMultiplier.value))
          el = document.getElementById(currentTargetId) as HTMLInputElement
        }

        if (el && el.tagName === 'INPUT') {
          // Focus the element to show the silver ring and flashing cursor
          el.focus()

          // If this is the first letter, wait a tiny bit so the focus is visible
          // before the input event potentially moves it or obscures it.
          if (char === letters[0]) {
            await new Promise(resolve => setTimeout(resolve, 300 * speedMultiplier.value))
          }

          // Simulate keydown event so components can handle special keys (like '*')
          el.dispatchEvent(new KeyboardEvent('keydown', {
            key: char,
            bubbles: true,
            cancelable: true
          }))

          // Simulate the input event
          el.value = char
          el.dispatchEvent(new Event('input'))

          // Wait for a realistic typing delay
          await new Promise(resolve => setTimeout(resolve, (delayOverride || ANAGRAM_TIMINGS.TYPING_DELAY) * speedMultiplier.value))

          // After typing, the game logic will likely move focus to the next cell.
          await nextTick()
          const nextEl = document.activeElement
          if (nextEl && nextEl.id && nextEl.id.startsWith('grid-cell-') && nextEl !== el) {
            currentTargetId = nextEl.id
          } else {
            // Recovery: If focus was stolen or didn't move, try to find the next logical grid cell in the DOM.
            // GridBoard only renders <input> for editable cells, and sequential IDs mean sequential cells.
            const allGridInputs = Array.from(document.querySelectorAll('[id^="grid-cell-"]')) as HTMLInputElement[]
            const currentIndex = allGridInputs.indexOf(el)
            if (currentIndex !== -1 && currentIndex < allGridInputs.length - 1) {
              currentTargetId = allGridInputs[currentIndex + 1].id
            }
          }
        } else {
          break
        }
      }
    } else if (targetId.startsWith('builder-slot-')) {
      const letters = text.split('')
      let slotIndex = parseInt(targetId.split('-').pop() || '0')
      const usedTileIndices = new Set()

      // Ensure AnagramBuilder is ready
      let tiles = document.querySelectorAll('[id^="anagram-tile-"]')
      if (tiles.length === 0) {
        await new Promise(resolve => setTimeout(resolve, 800 * speedMultiplier.value))
        tiles = document.querySelectorAll('[id^="anagram-tile-"]')
      }

      for (const char of letters) {
        if (!isPlaying.value || !isTutorialActive.value) break

        // 1. Find a matching available tile in the bank
        tiles = document.querySelectorAll('[id^="anagram-tile-"]')
        let sourceEl = null
        let origIdx = null

        for (const tile of Array.from(tiles)) {
          const id = tile.id
          const tIdx = id.split('-').pop()
          if (!tIdx || usedTileIndices.has(tIdx)) continue

          // Check if the tile matches the letter
          const tileText = tile.textContent?.trim().toUpperCase() || ''
          if (tileText.startsWith(char.toUpperCase())) {
            sourceEl = tile
            origIdx = tIdx
            break
          }
        }

        if (sourceEl && origIdx !== null) {
          // 1. Highlight source tile
          window.dispatchEvent(new CustomEvent('tutorial-pulse-anagram-element', {
            detail: {
              type: 'top',
              index: parseInt(origIdx),
              duration: ANAGRAM_TIMINGS.SOURCE_PULSE_DURATION * speedMultiplier.value
            }
          }))

          // Wait for the source pulse to be seen
          await new Promise(resolve => setTimeout(resolve, ANAGRAM_TIMINGS.WAIT_AFTER_SOURCE_PULSE * speedMultiplier.value))
          usedTileIndices.add(origIdx)

          if (!isPlaying.value || !isTutorialActive.value) break

          // 2. Consume/Dim the tile in the bank
          window.dispatchEvent(new CustomEvent('tutorial-set-anagram-consumed', {
            detail: { index: parseInt(origIdx), consumed: true }
          }))

          // Small delay after consumption
          await new Promise(resolve => setTimeout(resolve, ANAGRAM_TIMINGS.WAIT_AFTER_CONSUME * speedMultiplier.value))

          if (!isPlaying.value || !isTutorialActive.value) break

          // 3. Move letter to target slot
          const slotId = `builder-slot-${slotIndex}`
          const el = document.getElementById(slotId)
          if (el) {
            // Dispatch event to Margana.vue to place letter
            window.dispatchEvent(new CustomEvent('tutorial-place-anagram-letter', {
              detail: { slotIndex, letter: char, sourceTopIndex: parseInt(origIdx) }
            }))

            // 4. Trigger pulse on the target slot
            window.dispatchEvent(new CustomEvent('tutorial-pulse-anagram-element', {
              detail: {
                type: 'builder',
                index: slotIndex,
                duration: ANAGRAM_TIMINGS.TARGET_PULSE_DURATION * speedMultiplier.value
              }
            }))

            // Wait for the target pulse to finish/be seen
            await new Promise(resolve => setTimeout(resolve, ANAGRAM_TIMINGS.WAIT_AFTER_TARGET_PULSE * speedMultiplier.value))

            if (!isPlaying.value || !isTutorialActive.value) break

            // Final delay before next letter to ensure no overlap
            await new Promise(resolve => setTimeout(resolve, (delayOverride || ANAGRAM_TIMINGS.TYPING_DELAY) * speedMultiplier.value))
            slotIndex++
          }
        }
      }
    }
  }

  async function processStep(step: any, options: { suppressAdvance?: boolean; stepIndexOverride?: number; keepPlaying?: boolean } = {}) {
    if (!step || !isTutorialActive.value) return

    try {
      const stepIndex = Number.isInteger(options.stepIndexOverride)
        ? options.stepIndexOverride
        : currentStepIndex?.value
      if (onStepStart) onStepStart(step, stepIndex)
    } catch (_) {}

    // Reset highlights when step changes
    window.dispatchEvent(new CustomEvent('tutorial-highlight-element', {
      detail: { clear: true }
    }))

    // Focus target grid cell if present, so it's visible during the delay
    if (step.action && step.action.targetId) {
      if (step.action.targetId.startsWith('grid-cell-')) {
        const el = document.getElementById(step.action.targetId) as HTMLInputElement
        if (el) el.focus()
      } else {
        // Clear focus from grid if moving to another element (e.g. anagram builder)
        const activeEl = document.activeElement as HTMLElement
        if (activeEl && activeEl.id && activeEl.id.startsWith('grid-cell-')) {
          activeEl.blur()
        }
      }
    }

    if (step.delay && isPlaying.value) {
      await new Promise(resolve => setTimeout(resolve, step.delay * speedMultiplier.value))
    }

    if (!isTutorialActive.value || !isPlaying.value) return

    let actionPromise = Promise.resolve()

    if (step.action) {
      // Trigger internalized highlight if applicable
      if (isSilverRingAction(step.action.targetId)) {
        window.dispatchEvent(new CustomEvent('tutorial-highlight-element', {
          detail: { targetId: step.action.targetId }
        }))
      }

      if (step.action.type === 'SHUFFLES') {
        actionPromise = (async () => {
          const targetId = step.action.targetId || 'margana-anagram-shuffle-btn'
          const shuffleCount = step.action.shuffleCount || 5
          const shuffleDelay = step.action.shuffleDelay || 800
          let el = document.getElementById(targetId)
          if (!el) {
            await new Promise(resolve => setTimeout(resolve, 500 * speedMultiplier.value))
            el = document.getElementById(step.action.targetId)
          }
          if (el) {
            for (let i = 0; i < shuffleCount; i++) {
              if (!isPlaying.value || !isTutorialActive.value) break
              await new Promise(resolve => setTimeout(resolve, shuffleDelay * speedMultiplier.value))
              el.click()
            }
          }
        })()
      } else if (step.action.type === 'TYPE_TEXT') {
        actionPromise = simulateTyping(step.action.targetId, step.action.value, step.action.typingDelay)
      } else if (step.action.type === 'PRESS_KEY') {
        actionPromise = (async () => {
          let el = document.getElementById(step.action.targetId) as HTMLInputElement
          if (!el) {
            await new Promise(resolve => setTimeout(resolve, 500 * speedMultiplier.value))
            el = document.getElementById(step.action.targetId) as HTMLInputElement
          }
          if (el) {
            el.focus()
            const keys = Array.isArray(step.action.key) ? step.action.key : [step.action.key]
            for (const k of keys) {
              if (!isPlaying.value || !isTutorialActive.value) break
              await new Promise(resolve => setTimeout(resolve, 300 * speedMultiplier.value))
              el.dispatchEvent(new KeyboardEvent('keydown', {
                key: k,
                bubbles: true,
                cancelable: true
              }))
              await new Promise(resolve => setTimeout(resolve, (step.action.pressDelay || 1000) * speedMultiplier.value))
            }
          }
        })()
      } else if (step.action.type === 'CLICK') {
        actionPromise = (async () => {
          // Use a small retry mechanism if element is not immediately available
          let el = document.getElementById(step.action.targetId)
          if (!el) {
            await new Promise(resolve => setTimeout(resolve, 500 * speedMultiplier.value))
            el = document.getElementById(step.action.targetId)
          }

          if (el) {
            // Wait a bit before clicking
            await new Promise(resolve => setTimeout(resolve, 1500 * speedMultiplier.value))

            window.dispatchEvent(new CustomEvent('tutorial-click-element', {
              detail: { targetId: step.action.targetId }
            }))
          }
        })()
      }
    }

    // Auto-advance logic
    if (isPlaying.value) {
      // Wait for ANY typing or click action to finish before scheduling next step
      await actionPromise

      // Small grace period for animations/UI updates
      await new Promise(resolve => setTimeout(resolve, 500 * speedMultiplier.value))

      if (!isPlaying.value) return // Guard if stopped during await

      // --- New Auto-Advance Logic ---
      const nextStepData = (tutorialSteps?.value && currentStepIndex !== undefined)
        ? tutorialSteps.value[currentStepIndex.value + 1]
        : null

      // Advance if: autoPlay is on OR current step explicitly asks OR next step is a continuation
      const shouldAutoAdvance = isAutoPlay.value ||
        step.autoAdvance ||
        (nextStepData && nextStepData.continueDescription)

      if (!options.suppressAdvance && shouldAutoAdvance && nextStep) {
        nextStep()
      } else {
        // Stop after the step is completed if not in auto-play mode
        if (!options.keepPlaying) isPlaying.value = false
      }
    }
  }

  return {
    speedMultiplier,
    simulateTyping,
    processStep,
    isSilverRingAction,
    ANAGRAM_TIMINGS
  }
}
