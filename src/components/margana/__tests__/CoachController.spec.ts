import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import CoachController from '../CoachController.vue'
import coachMessages from '@/resources/coach-messages.json'
import { ref } from 'vue'

describe('CoachController', () => {
  const createMockSession = (overrides = {}) => {
    return {
      baseGrid: ref([['A','W','A','S','H'],['','','','',''],['','','','',''],['','','','',''],['','','','','']]),
      gm: {
        hasAnyEditableInRow: vi.fn((r) => r >= 1),
        rowHasWildcard: vi.fn(() => false),
        rowValid: ref([true, false, false, false, false]),
      },
      am: {
        builderWord: ref(''),
        anagramVerifiedPoints: ref(0),
      },
      result: ref({
        meta: {
          longestAnagramCount: 5
        }
      }),
      canSubmit: ref(false),
      ...overrides
    }
  }

  it('shows ROW_INCOMPLETE when a row is not valid', async () => {
    const session = createMockSession()
    const wrapper = mount(CoachController, {
      props: { session }
    })

    await wrapper.vm.analyze()
    expect(wrapper.vm.currentStage).toBe('ROW_INCOMPLETE')
    expect(wrapper.vm.currentMessage).toBe(coachMessages.stages.ROW_INCOMPLETE[0])
    expect(wrapper.vm.totalMessages).toBe(coachMessages.stages.ROW_INCOMPLETE.length)
    expect(wrapper.vm.currentRowIndex).toBe(1)
  })

  it('cycles through messages when nextMessage is called', async () => {
    const session = createMockSession()
    const wrapper = mount(CoachController, {
      props: { session }
    })

    await wrapper.vm.analyze()
    expect(wrapper.vm.currentMessageIndex).toBe(0)
    expect(wrapper.vm.currentMessage).toBe(coachMessages.stages.ROW_INCOMPLETE[0])

    wrapper.vm.nextMessage()
    expect(wrapper.vm.currentMessageIndex).toBe(1)
    expect(wrapper.vm.currentMessage).toBe(coachMessages.stages.ROW_INCOMPLETE[1])

    // Cycle through remaining
    const count = coachMessages.stages.ROW_INCOMPLETE.length
    for (let i = 0; i < count - 2; i++) {
      wrapper.vm.nextMessage()
    }
    expect(wrapper.vm.currentMessageIndex).toBe(count - 1)

    // Loop back
    wrapper.vm.nextMessage()
    expect(wrapper.vm.currentMessageIndex).toBe(0)
    expect(wrapper.vm.currentMessage).toBe(coachMessages.stages.ROW_INCOMPLETE[0])
  })

  it('shows ANAGRAM_PROGRESS when grid is complete but anagram is missing', async () => {
    const session = createMockSession({
      gm: {
        hasAnyEditableInRow: vi.fn((r) => r >= 1),
        rowHasWildcard: vi.fn(() => false),
        rowValid: ref([true, true, true, true, true]),
      }
    })
    const wrapper = mount(CoachController, {
      props: { session }
    })

    await wrapper.vm.analyze()
    expect(wrapper.vm.currentStage).toBe('ANAGRAM_PROGRESS')
    expect(wrapper.vm.currentMessage).toBe(coachMessages.stages.ANAGRAM_PROGRESS[0])
    expect(wrapper.vm.currentRowIndex).toBe(null)
  })

  it('shows ADVANCED_TACTICS when anagram is maximized', async () => {
    const session = createMockSession({
      gm: {
        hasAnyEditableInRow: vi.fn((r) => r >= 1),
        rowHasWildcard: vi.fn(() => false),
        rowValid: ref([true, true, true, true, true]),
      },
      am: {
        builderWord: ref('AWASH'),
        anagramVerifiedPoints: ref(20),
      }
    })
    const wrapper = mount(CoachController, {
      props: { session }
    })

    await wrapper.vm.analyze()
    expect(wrapper.vm.currentStage).toBe('ADVANCED_TACTICS')
    expect(wrapper.vm.currentMessage).toBe(coachMessages.stages.ADVANCED_TACTICS[0])
  })

  it('clears state when clear is called', async () => {
    const session = createMockSession()
    const wrapper = mount(CoachController, {
      props: { session }
    })

    await wrapper.vm.analyze()
    wrapper.vm.clear()
    expect(wrapper.vm.currentMessage).toBe('')
    expect(wrapper.vm.currentRowIndex).toBe(null)
    expect(wrapper.vm.currentStage).toBe(null)
  })

  it('goes back to ANAGRAM_PROGRESS if a maximized anagram is invalidated', async () => {
    const builderWord = ref('AWASH')
    const anagramVerifiedPoints = ref(20)
    const session = createMockSession({
      gm: {
        hasAnyEditableInRow: vi.fn((r) => r >= 1),
        rowHasWildcard: vi.fn(() => false),
        rowValid: ref([true, true, true, true, true]),
      },
      am: {
        builderWord,
        anagramVerifiedPoints
      }
    })
    const wrapper = mount(CoachController, {
      props: { session }
    })

    // 1. Analyze when maximized
    await wrapper.vm.analyze()
    expect(wrapper.vm.currentStage).toBe('ADVANCED_TACTICS')

    // 2. Clear (simulate message disappearance on verification)
    wrapper.vm.clear()

    // 3. Invalidate anagram (move letter out)
    builderWord.value = 'AWAS'
    anagramVerifiedPoints.value = 0

    // 4. Analyze again -> should be ANAGRAM_PROGRESS
    await wrapper.vm.analyze()
    expect(wrapper.vm.currentStage).toBe('ANAGRAM_PROGRESS')
  })

  it('shows ANAGRAM_PROGRESS if anagram has right length but is not verified', async () => {
    const session = createMockSession({
      gm: {
        hasAnyEditableInRow: vi.fn((r) => r >= 1),
        rowHasWildcard: vi.fn(() => false),
        rowValid: ref([true, true, true, true, true]),
      },
      am: {
        builderWord: ref('ABCDE'), // Length 5
        anagramVerifiedPoints: ref(0)
      }
    })
    const wrapper = mount(CoachController, {
      props: { session }
    })

    await wrapper.vm.analyze()
    expect(wrapper.vm.currentStage).toBe('ANAGRAM_PROGRESS')
  })
})
