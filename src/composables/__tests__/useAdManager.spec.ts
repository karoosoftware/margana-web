import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { useAdManager } from '../useAdManager'

function mountComposable(setupFn: () => any) {
  let result: any
  const TestComponent = defineComponent({
    setup() {
      result = setupFn()
      return () => h('div')
    }
  })
  mount(TestComponent)
  return result
}

describe('useAdManager', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('should initialize with 0 shuffle count', () => {
    const { shuffleCount } = mountComposable(() => useAdManager())
    expect(shuffleCount.value).toBe(0)
  })

  it('should increment shuffle count', () => {
    const { shuffleCount, incrementShuffleCount } = mountComposable(() => useAdManager())
    incrementShuffleCount()
    expect(shuffleCount.value).toBe(1)
  })

  it('should track idle state', async () => {
    const { isIdle, _checkIdle } = mountComposable(() => useAdManager())
    expect(isIdle.value).toBe(false)
    
    vi.advanceTimersByTime(6000)
    _checkIdle()
    
    expect(isIdle.value).toBe(true)
  })
})
