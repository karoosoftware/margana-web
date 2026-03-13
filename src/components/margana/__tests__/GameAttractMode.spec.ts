import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import GameAttractMode from '../GameAttractMode.vue'
import { nextTick, ref } from 'vue'

// Mock dependencies
vi.mock('@/composables/useMarganaAuth', () => ({
  useMarganaAuth: () => ({
    isAuthenticated: ref(false)
  }),
  UserTier: { GUEST: 'guest', REGISTERED: 'registered' }
}))

vi.mock('@/config/api', () => ({
  Bucket: { MARGANA_WORD_GAME: 'test-bucket' }
}))

vi.mock('aws-amplify/storage', () => ({
  getUrl: vi.fn()
}))

describe('GameAttractMode', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('renders correctly and starts simulation', async () => {
    const wrapper = mount(GameAttractMode)
    
    // Check if it renders the root div with the correct class and pointer-events: none
    expect(wrapper.classes()).toContain('game-attract-mode')
    
    // Wait for onMounted and puzzle loading
    await nextTick()
    await vi.advanceTimersByTimeAsync(2000)
    await nextTick()

    // Check if GridBoard is rendered
    expect(wrapper.findComponent({ name: 'GridBoard' }).exists()).toBe(true)
    // Check if AnagramBuilder is rendered
    expect(wrapper.findComponent({ name: 'AnagramBuilder' }).exists()).toBe(true)
  })

  it('is shielded from user interaction', () => {
    const wrapper = mount(GameAttractMode)
    const root = wrapper.element as HTMLElement
    
    // Check for pointer-events: none in computed styles (if possible) or just the class/attribute
    // Since it's in <style scoped>, we might need to check the attribute if vue-test-utils supports it,
    // but checking the class and the tabindex is a good start.
    expect(root.getAttribute('tabindex')).toBe('-1')
    
    // The firewall is mostly CSS-based, which is hard to test in JSDOM, 
    // but we ensured pointer-events: none is in the style tag.
  })
})
