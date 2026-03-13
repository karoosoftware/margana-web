import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useOrientation } from '../useOrientation'
import { ref, nextTick, defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'

// Helper to mount the composable
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

describe('useOrientation', () => {
  beforeEach(() => {
    // Mock window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(), // deprecated
        removeListener: vi.fn(), // deprecated
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    // Mock window.innerWidth/innerHeight
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 960 })
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 600 })

    // Clean up body classes
    document.body.className = ''
    
    // Default to NOT a touch device for desktop tests
    if ('ontouchstart' in window) {
      delete (window as any).ontouchstart
    }
    Object.defineProperty(navigator, 'maxTouchPoints', {
      configurable: true,
      value: 0
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should initialize with default values (desktop: no immersive)', () => {
    // Mock matchMedia to return true for landscape
    vi.mocked(window.matchMedia).mockImplementation(query => ({
        matches: query === '(orientation: landscape)',
        media: query,
    } as any))

    const { isLandscape, isSmallDevice, isTouchDevice, landscapeMobileMode } = mountComposable(() => useOrientation())
    
    expect(isLandscape.value).toBe(true)
    expect(isSmallDevice.value).toBe(true)
    expect(isTouchDevice.value).toBe(false)
    expect(landscapeMobileMode.value).toBe(false)
  })

  it('should enable landscapeMobileMode on touch devices', async () => {
    // Mock touch device
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 })
    
    vi.mocked(window.matchMedia).mockImplementation(query => ({
        matches: query === '(orientation: landscape)' || query === '(pointer: coarse)',
        media: query,
    } as any))

    const { isLandscape, isSmallDevice, isTouchDevice, landscapeMobileMode, updateOrientationFlags } = mountComposable(() => useOrientation())
    
    updateOrientationFlags()
    await nextTick()

    expect(isLandscape.value).toBe(true)
    expect(isSmallDevice.value).toBe(true)
    expect(isTouchDevice.value).toBe(true)
    expect(landscapeMobileMode.value).toBe(true)
  })

  it('should detect portrait mode', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 768 })
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 1024 })
    
    // Mock matchMedia to return false for landscape
    vi.mocked(window.matchMedia).mockReturnValue({
        matches: false,
    } as any)

    const { isLandscape, landscapeMobileMode } = mountComposable(() => useOrientation())
    
    expect(isLandscape.value).toBe(false)
    expect(landscapeMobileMode.value).toBe(false)
  })

  it('should handle immersive override', async () => {
    // Mock touch device to allow immersive mode to be active
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 })
    vi.mocked(window.matchMedia).mockImplementation(query => ({
        matches: query === '(orientation: landscape)' || query === '(pointer: coarse)',
        media: query,
    } as any))

    const { landscapeMobileMode, toggleImmersiveOverride, updateOrientationFlags } = mountComposable(() => useOrientation())
    
    updateOrientationFlags()
    await nextTick()
    
    expect(landscapeMobileMode.value).toBe(true)
    expect(document.body.classList.contains('landscape-immersive')).toBe(true)
    
    toggleImmersiveOverride()
    await nextTick()
    
    expect(landscapeMobileMode.value).toBe(false)
    expect(document.body.classList.contains('landscape-immersive')).toBe(false)
  })

  it('should disable immersive mode when game ends', async () => {
    // Mock touch device
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 })
    vi.mocked(window.matchMedia).mockImplementation(query => ({
        matches: query === '(orientation: landscape)' || query === '(pointer: coarse)',
        media: query,
    } as any))

    const endOfGame = ref(false)
    const { landscapeMobileMode, updateOrientationFlags } = mountComposable(() => useOrientation(endOfGame))
    
    updateOrientationFlags()
    await nextTick()
    
    expect(landscapeMobileMode.value).toBe(true)
    
    endOfGame.value = true
    await nextTick()
    
    expect(landscapeMobileMode.value).toBe(false)
  })

  it('should reset immersiveOverrideOff when rotating back to portrait', async () => {
    // Mock touch device
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 })
    vi.mocked(window.matchMedia).mockImplementation(query => ({
        matches: query === '(orientation: landscape)' || query === '(pointer: coarse)',
        media: query,
    } as any))

    const { isLandscape, immersiveOverrideOff, toggleImmersiveOverride, updateOrientationFlags } = mountComposable(() => useOrientation())
    
    updateOrientationFlags()
    await nextTick()
    
    toggleImmersiveOverride()
    expect(immersiveOverrideOff.value).toBe(true)
    
    // Change to portrait
    vi.mocked(window.matchMedia).mockImplementation(query => ({
        matches: query === '(pointer: coarse)',
        media: query,
    } as any))
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 768 })
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 1024 })
    
    updateOrientationFlags()
    await nextTick()
    await nextTick() // Second tick for watcher
    
    expect(isLandscape.value).toBe(false)
    expect(immersiveOverrideOff.value).toBe(false)
  })

  it('should add/remove event listeners on mount/unmount', () => {
    const addEventSpy = vi.spyOn(window, 'addEventListener')
    const removeEventSpy = vi.spyOn(window, 'removeEventListener')
    
    const TestComponent = defineComponent({
      setup() {
        useOrientation()
        return () => h('div')
      }
    })
    
    const wrapper = mount(TestComponent)
    expect(addEventSpy).toHaveBeenCalledWith('resize', expect.any(Function))
    expect(addEventSpy).toHaveBeenCalledWith('orientationchange', expect.any(Function))
    
    wrapper.unmount()
    expect(removeEventSpy).toHaveBeenCalledWith('resize', expect.any(Function))
    expect(removeEventSpy).toHaveBeenCalledWith('orientationchange', expect.any(Function))
  })
})
