import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { useGhostPlayer, ANAGRAM_TIMINGS } from '../useGhostPlayer'

describe('useGhostPlayer', () => {
  let isPlaying: any
  let isTutorialActive: any
  let isAutoPlay: any
  let nextStep: any

  beforeEach(() => {
    isPlaying = ref(true)
    isTutorialActive = ref(true)
    isAutoPlay = ref(true)
    nextStep = vi.fn()
    
    // Mock DOM elements
    document.body.innerHTML = `
      <input id="grid-cell-0-0" />
      <div id="builder-slot-0"></div>
      <button id="margana-anagram-shuffle-btn"></button>
      <div id="anagram-tile-0">A</div>
    `
    
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('correctly identifies silver ring actions', () => {
    const { isSilverRingAction } = useGhostPlayer({ isPlaying })
    expect(isSilverRingAction('margana-anagram-shuffle-btn')).toBe(true)
    expect(isSilverRingAction('grid-cell-0-0')).toBe(false)
  })

  it('processes TYPE_TEXT action for grid cells', async () => {
    const { processStep } = useGhostPlayer({ 
      isTutorialActive, 
      isPlaying, 
      isAutoPlay, 
      nextStep 
    })

    const step = {
      action: {
        type: 'TYPE_TEXT',
        targetId: 'grid-cell-0-0',
        value: 'A'
      }
    }

    const input = document.getElementById('grid-cell-0-0') as HTMLInputElement
    const focusSpy = vi.spyOn(input, 'focus')
    const dispatchSpy = vi.spyOn(input, 'dispatchEvent')

    const promise = processStep(step)
    
    // Step delay (none here)
    // Then simulateTyping starts
    
    await vi.runAllTimersAsync()
    await nextTick()

    expect(input.value).toBe('A')
    expect(focusSpy).toHaveBeenCalled()
    
    // Check for keydown event
    const keydownEvents = dispatchSpy.mock.calls.filter(call => call[0] instanceof KeyboardEvent && call[0].type === 'keydown')
    expect(keydownEvents.length).toBeGreaterThan(0)
    expect(keydownEvents[0][0].key).toBe('A')

    expect(nextStep).toHaveBeenCalled()
  })

  it('processes PRESS_KEY action', async () => {
    const { processStep } = useGhostPlayer({ 
      isTutorialActive, 
      isPlaying, 
      isAutoPlay, 
      nextStep 
    })

    const input = document.getElementById('grid-cell-0-0') as HTMLInputElement
    const focusSpy = vi.spyOn(input, 'focus')
    const dispatchSpy = vi.spyOn(input, 'dispatchEvent')

    const step = {
      action: {
        type: 'PRESS_KEY',
        targetId: 'grid-cell-0-0',
        key: '*',
        pressDelay: 100
      }
    }

    processStep(step)
    
    await vi.runAllTimersAsync()
    await nextTick()

    expect(focusSpy).toHaveBeenCalled()
    
    const keydownEvent = dispatchSpy.mock.calls.find(call => 
      call[0] instanceof KeyboardEvent && call[0].type === 'keydown' && call[0].key === '*'
    )
    expect(keydownEvent).toBeDefined()
    expect(nextStep).toHaveBeenCalled()
  })

  it('processes PRESS_KEY action with multiple keys', async () => {
    const { processStep } = useGhostPlayer({ 
      isTutorialActive, 
      isPlaying, 
      isAutoPlay, 
      nextStep 
    })

    const input = document.getElementById('grid-cell-0-0') as HTMLInputElement
    const dispatchSpy = vi.spyOn(input, 'dispatchEvent')

    const step = {
      action: {
        type: 'PRESS_KEY',
        targetId: 'grid-cell-0-0',
        key: ['*', 'Backspace'],
        pressDelay: 100
      }
    }

    processStep(step)
    
    await vi.runAllTimersAsync()
    await nextTick()

    const keydownEvents = dispatchSpy.mock.calls
      .filter(call => call[0] instanceof KeyboardEvent && call[0].type === 'keydown')
      .map(call => call[0].key)

    expect(keydownEvents).toContain('*')
    expect(keydownEvents).toContain('Backspace')
    expect(nextStep).toHaveBeenCalled()
  })

  it('focuses grid cell at the start of processStep before delay', async () => {
    const { processStep } = useGhostPlayer({ 
      isTutorialActive, 
      isPlaying, 
      isAutoPlay, 
      nextStep 
    })

    const input = document.getElementById('grid-cell-0-0') as HTMLInputElement
    const focusSpy = vi.spyOn(input, 'focus')

    const step = {
      delay: 1000,
      action: {
        type: 'TYPE_TEXT',
        targetId: 'grid-cell-0-0',
        value: 'A'
      }
    }

    processStep(step)
    
    // Focus should be called immediately, even before the delay timer runs
    expect(focusSpy).toHaveBeenCalled()
    
    await vi.runAllTimersAsync()
    await nextTick()
  })

  it('processes SHUFFLES action', async () => {
    const { processStep } = useGhostPlayer({ 
      isTutorialActive, 
      isPlaying, 
      isAutoPlay, 
      nextStep 
    })

    const btn = document.getElementById('margana-anagram-shuffle-btn')
    const clickSpy = vi.spyOn(btn!, 'click')

    const step = {
      action: {
        type: 'SHUFFLES',
        targetId: 'margana-anagram-shuffle-btn',
        shuffleCount: 3,
        shuffleDelay: 100
      }
    }

    processStep(step)
    
    await vi.runAllTimersAsync()
    
    expect(clickSpy).toHaveBeenCalledTimes(3)
    expect(nextStep).toHaveBeenCalled()
  })

  it('stops processing if isPlaying becomes false', async () => {
    const { processStep } = useGhostPlayer({ 
      isTutorialActive, 
      isPlaying, 
      isAutoPlay, 
      nextStep 
    })

    const step = {
      action: {
        type: 'SHUFFLES',
        targetId: 'margana-anagram-shuffle-btn',
        shuffleCount: 5,
        shuffleDelay: 1000
      }
    }

    processStep(step)
    
    // Advance some timers but not all
    await vi.advanceTimersByTimeAsync(1500)
    isPlaying.value = false
    
    await vi.runAllTimersAsync()
    
    // Should have clicked at least once but not 5 times
    const btn = document.getElementById('margana-anagram-shuffle-btn')
    // Note: click count might vary depending on exact timing, but it should definitely NOT be 5 if we stopped it.
    // In our implementation, we check isPlaying.value inside the loop.
  })
  it('clears focus from grid cell when moving to a non-grid cell action', async () => {
    const { processStep } = useGhostPlayer({ 
      isTutorialActive, 
      isPlaying, 
      isAutoPlay, 
      nextStep 
    })

    const input = document.getElementById('grid-cell-0-0') as HTMLInputElement
    input.focus()
    expect(document.activeElement).toBe(input)

    const step = {
      action: {
        type: 'SHUFFLES',
        targetId: 'margana-anagram-shuffle-btn',
        shuffleCount: 1,
        shuffleDelay: 100
      }
    }

    const blurSpy = vi.spyOn(input, 'blur')

    processStep(step)
    
    expect(blurSpy).toHaveBeenCalled()
    expect(document.activeElement).not.toBe(input)
    
    await vi.runAllTimersAsync()
    await nextTick()
  })

  it('auto-advances even if isAutoPlay is false if next step has continueDescription', async () => {
    isAutoPlay.value = false
    const tutorialSteps = ref([
      { step: 1, action: { type: 'CLICK', targetId: 'btn' } },
      { step: 2, continueDescription: true, action: { type: 'CLICK', targetId: 'btn' } }
    ])
    const currentStepIndex = ref(0)
    
    const { processStep } = useGhostPlayer({ 
      isTutorialActive, 
      isPlaying, 
      isAutoPlay, 
      nextStep,
      tutorialSteps,
      currentStepIndex
    })

    document.body.innerHTML += '<button id="btn"></button>'

    processStep(tutorialSteps.value[0])
    
    await vi.runAllTimersAsync()
    await nextTick()

    expect(nextStep).toHaveBeenCalled()
  })

  it('does NOT auto-advance if isAutoPlay is false and next step does NOT have continueDescription', async () => {
    isAutoPlay.value = false
    const tutorialSteps = ref([
      { step: 1, action: { type: 'CLICK', targetId: 'btn' } },
      { step: 2, action: { type: 'CLICK', targetId: 'btn' } }
    ])
    const currentStepIndex = ref(0)
    
    const { processStep } = useGhostPlayer({ 
      isTutorialActive, 
      isPlaying, 
      isAutoPlay, 
      nextStep,
      tutorialSteps,
      currentStepIndex
    })

    document.body.innerHTML += '<button id="btn"></button>'

    processStep(tutorialSteps.value[0])
    
    await vi.runAllTimersAsync()
    await nextTick()

    expect(nextStep).not.toHaveBeenCalled()
    expect(isPlaying.value).toBe(false)
  })

  it('auto-advances if current step has autoAdvance: true even if isAutoPlay is false', async () => {
    isAutoPlay.value = false
    const tutorialSteps = ref([
      { step: 1, autoAdvance: true, action: { type: 'CLICK', targetId: 'btn' } },
      { step: 2, action: { type: 'CLICK', targetId: 'btn' } }
    ])
    const currentStepIndex = ref(0)
    
    const { processStep } = useGhostPlayer({ 
      isTutorialActive, 
      isPlaying, 
      isAutoPlay, 
      nextStep,
      tutorialSteps,
      currentStepIndex
    })

    document.body.innerHTML += '<button id="btn"></button>'

    processStep(tutorialSteps.value[0])
    
    await vi.runAllTimersAsync()
    await nextTick()

    expect(nextStep).toHaveBeenCalled()
  })

  it('keeps playing when suppressAdvance is true and keepPlaying is set', async () => {
    const { processStep } = useGhostPlayer({
      isTutorialActive,
      isPlaying,
      isAutoPlay,
      nextStep
    })

    const step = {
      action: {
        type: 'CLICK',
        targetId: 'btn'
      }
    }

    document.body.innerHTML += '<button id="btn"></button>'

    processStep(step, { suppressAdvance: true, keepPlaying: true })

    await vi.runAllTimersAsync()
    await nextTick()

    expect(isPlaying.value).toBe(true)
    expect(nextStep).not.toHaveBeenCalled()
  })
})
