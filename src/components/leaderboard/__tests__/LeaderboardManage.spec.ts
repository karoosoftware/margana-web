import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'
import LeaderboardManage from '../LeaderboardManage.vue'
import { ref } from 'vue'

// Mock useRouter
const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush
  })
}))

// Mock useMarganaAuth
vi.mock('@/composables/useMarganaAuth', () => ({
  useMarganaAuth: () => ({
    username: ref('testuser'),
    userEmail: ref('test@example.com')
  })
}))

// Mock fetchAuthSession
vi.mock('aws-amplify/auth', () => ({
  fetchAuthSession: vi.fn(() => Promise.resolve({
    tokens: {
      idToken: { toString: () => 'mock-token' }
    }
  }))
}))

vi.mock('@/config/api', () => ({
  API: {
    LEADERBOARDS: 'http://mock-api/leaderboards',
    LEADERBOARDS_PUBLIC: 'http://mock-api/leaderboards/public',
    LEADERBOARD_CHECK_NAME: 'http://mock-api/leaderboards/check-name',
    LEADERBOARD_JOIN: (id: string) => `http://mock-api/leaderboards/${id}/join`
  }
}))

describe('LeaderboardManage.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true })
    })
  })

  it('renders step 1 initially', () => {
    const wrapper = mount(LeaderboardManage, {
      global: {
        stubs: {
          'router-link': true
        }
      }
    })
    expect(wrapper.text()).toContain('Leaderboard name')
    expect(wrapper.find('input[type="text"]').exists()).toBe(true)
  })

  it('shows error for name too long', async () => {
    const wrapper = mount(LeaderboardManage, {
      global: {
        stubs: {
          'router-link': true
        }
      }
    })
    const input = wrapper.find('input[type="text"]')
    await input.setValue('a'.repeat(31))
    // The button text is "Verify" in Step 1
    await wrapper.find('button').trigger('click')
    
    expect(wrapper.text()).toContain('too long')
  })

  it('verifies name and moves to step 2', async () => {
    let resolveFetch: any;
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    global.fetch = vi.fn().mockReturnValue(fetchPromise);

    const wrapper = mount(LeaderboardManage, {
      global: {
        stubs: {
          'router-link': true
        }
      }
    })
    const input = wrapper.find('input[type="text"]')
    await input.setValue('valid_name')
    await wrapper.find('button').trigger('click')

    // It shows a loader, so we check for the loader
    expect(wrapper.find('.dots-loader').exists()).toBe(true)

    resolveFetch({
      ok: true,
      json: () => Promise.resolve({ ok: true })
    });

    await flushPromises()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Private leaderboard')
    expect(wrapper.text()).toContain('Public leaderboard')
  })

  it('moves to step 3 and allows adding members/admins', async () => {
    // For this one we can use the default mockResolvedValue from beforeEach
    const wrapper = mount(LeaderboardManage, {
      global: {
        stubs: {
          'router-link': true
        }
      }
    })

    // Step 1
    await wrapper.find('input[type="text"]').setValue('valid')
    await wrapper.find('button').trigger('click')
    await flushPromises()
    await wrapper.vm.$nextTick()

    // Step 2
    expect(wrapper.text()).toContain('Private leaderboard')
    // Click Private leaderboard button
    await wrapper.find('button.flex.items-start').trigger('click')
    await wrapper.vm.$nextTick()

    // Step 3
    expect(wrapper.text()).toContain('Owners')
    expect(wrapper.text()).toContain('test@example.com') // Admin email

    // Add another admin
    const adminInput = wrapper.findAll('input')[0]
    await adminInput.setValue('admin2@test.com')
    const plusButtons = wrapper.findAll('button.text-indigo-200\\/80')
    await plusButtons[0].trigger('click')
    expect(wrapper.text()).toContain('admin2@test.com')

    // Add a member
    const memberInput = wrapper.findAll('input')[1]
    await memberInput.setValue('member1@test.com')
    await plusButtons[1].trigger('click')
    expect(wrapper.text()).toContain('member1@test.com')
  })

  it('shows success message after creation', async () => {
    let resolveFetch: any;
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    global.fetch = vi.fn().mockReturnValue(fetchPromise);

    const wrapper = mount(LeaderboardManage, {
      global: {
        stubs: {
          'router-link': RouterLinkStub
        }
      }
    })

    // Quick path to step 4 (Submit step)
    wrapper.vm.currentStep = 4
    await wrapper.vm.$nextTick()

    // Find the Submit button
    const buttons = wrapper.findAll('button.btn-common-button')
    const submitBtn = buttons.find(b => b.text().includes('Create'))
    await submitBtn.trigger('click')

    expect(wrapper.find('.dots-loader').exists()).toBe(true)

    resolveFetch({
      ok: true,
      json: () => Promise.resolve({ ok: true, id: 'new-board-id' })
    });

    await flushPromises()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Leaderboard created')
    
    // Check View Leaderboard link
    const viewLink = wrapper.findComponent(RouterLinkStub)
    expect(viewLink.props('to')).toMatchObject({
      name: 'leaderboard-detail',
      params: { id: 'new-board-id' },
      query: { from: 'manage' }
    })
  })
})
