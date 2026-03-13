import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import LeaderboardPage from '../LeaderboardPage.vue'
import { ref } from 'vue'
import { cache } from '@/utils/cache'

// Mock dependencies
vi.mock('aws-amplify/auth', () => ({
  fetchAuthSession: vi.fn(() => Promise.resolve({
    tokens: {
      idToken: { toString: () => 'mock-token' }
    }
  }))
}))

vi.mock('@/config/api', () => ({
  API: {
    PROFILE: 'http://mock-api/profile'
  }
}))

// Mock components that might use logo or other assets
vi.mock('@/assets/margana_m_logo.svg', () => ({ default: 'mock-logo' }))

// Mock AppBrand to simplify
vi.mock('@/components/AppBrand.vue', () => ({
  default: { template: '<div class="app-brand-mock" />' }
}))

// Mock vue-router
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn()
  }),
  useRoute: () => ({
    query: {}
  })
}))

// Mock useMarganaAuth
const mockUsername = ref('')
vi.mock('@/composables/useMarganaAuth', () => ({
  useMarganaAuth: () => ({
    username: mockUsername
  })
}))

// Define state outside so it can be controlled
const mockActiveTab = ref('my')
const mockMyLeaderboards = ref([])
const mockPublicLeaderboards = ref([])
const mockLoadingPublic = ref(false)

// Mock useLeaderboard
vi.mock('@/composables/useLeaderboard', () => ({
  LeaderboardTab: {
    My: 'my',
    Public: 'public',
    Manage: 'manage'
  },
  useLeaderboard: () => ({
    activeTab: mockActiveTab,
    setActiveTab: (tab: string) => { mockActiveTab.value = tab },
    myLeaderboards: mockMyLeaderboards,
    fetchMyLeaderboards: vi.fn(),
    publicLeaderboards: mockPublicLeaderboards,
    loadingPublic: mockLoadingPublic,
    publicError: ref(null),
    sortBy: ref('highest'),
    hasMorePublic: ref(false),
    fetchPublicLeaderboards: vi.fn(),
    joinLeaderboard: vi.fn()
  })
}))

describe('LeaderboardPage.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cache.clearAll()
    mockActiveTab.value = 'my'
    mockMyLeaderboards.value = []
    mockPublicLeaderboards.value = []
    mockLoadingPublic.value = false
    mockUsername.value = ''
    
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ profile: { username: 'testuser' } })
    })
  })

  const mountOptions = {
    global: {
      stubs: {
        'router-link': true,
        'LeaderboardMy': true,
        'LeaderboardPublic': true,
        'LeaderboardManage': true
      }
    }
  }

  it('verifies profile on mount and renders tabs if username exists', async () => {
    const wrapper = mount(LeaderboardPage, mountOptions)
    
    expect(wrapper.find('.dots-loader').exists()).toBe(true)
    
    await flushPromises()
    
    const tabs = wrapper.findAll('button')
    expect(tabs.length).toBe(3)
    expect(tabs[0].text()).toBe('My')
    expect(tabs[1].text()).toBe('Join')
    expect(tabs[2].text()).toBe('Create')
    
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/profile'), expect.any(Object))
    expect(mockUsername.value).toBe('testuser')
  })

  it('shows username required card if no username exists', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ profile: { username: '' } })
    })
    
    const wrapper = mount(LeaderboardPage, mountOptions)
    await flushPromises()
    
    expect(wrapper.text()).toContain('Username required')
    expect(wrapper.text()).toContain('To participate in the leaderboards, please set a unique username in your profile settings')
    expect(wrapper.find('.grid-cols-3').exists()).toBe(false) // No tabs container
  })

  it('switches tabs when clicked', async () => {
    const wrapper = mount(LeaderboardPage, mountOptions)
    await flushPromises()
    
    // Initially should show My boards (index 0)
    const tabs = wrapper.findAll('button')
    expect(tabs[0].classes()).toContain('bg-white/10')
    
    // Click Join boards tab (index 1)
    await tabs[1].trigger('click')
    
    // Now Join boards tab should have the active class (bg-white/10)
    expect(tabs[1].classes()).toContain('bg-white/10')
    // My boards tab should no longer be active
    expect(tabs[0].classes()).not.toContain('bg-white/10')
  })
})
