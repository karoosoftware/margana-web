import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import LeaderboardPublic from '../LeaderboardPublic.vue'
import { ref } from 'vue'

// Mock useMarganaAuth
vi.mock('@/composables/useMarganaAuth', () => ({
  useMarganaAuth: () => ({
    username: ref('testuser')
  })
}))

// Mock useRouter
const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush
  })
}))

// Mock assets
vi.mock('@/assets/margana_m_logo.svg', () => ({ default: 'mock-logo' }))

const mockPublicLeaderboards = ref([])
const mockFetchPublicLeaderboards = vi.fn()
const mockJoinLeaderboard = vi.fn()

vi.mock('@/composables/useLeaderboard', () => ({
  useLeaderboard: () => ({
    publicLeaderboards: mockPublicLeaderboards,
    loadingPublic: ref(false),
    publicError: ref(null),
    sortBy: ref('highest'),
    hasMorePublic: ref(false),
    fetchPublicLeaderboards: mockFetchPublicLeaderboards,
    joinLeaderboard: mockJoinLeaderboard
  })
}))

describe('LeaderboardPublic.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPublicLeaderboards.value = []
  })

  it('renders join buttons for boards without user_role', async () => {
    mockPublicLeaderboards.value = [
      { id: '1', name: 'Public Board', member_count: 5, average_weekly_score: 100, auto_approve: true }
    ]
    const wrapper = mount(LeaderboardPublic)
    
    const joinBtn = wrapper.find('button.btn-common-button')
    expect(joinBtn.exists()).toBe(true)
    expect(joinBtn.text()).toBe('Join')
    expect(joinBtn.element.hasAttribute('disabled')).toBe(false)
  })

  it('renders "Owner" badge and chevron for admin role', async () => {
    mockPublicLeaderboards.value = [
      { id: '1', name: 'My Own Board', member_count: 5, average_weekly_score: 100, user_role: 'admin' }
    ]
    const wrapper = mount(LeaderboardPublic)
    
    expect(wrapper.text()).toContain('Owner')
    // Look for the chevron SVG - it has a specific path for ChevronRight
    expect(wrapper.find('svg').exists()).toBe(true)
    
    // Check if the row is clickable
    const row = wrapper.find('.cursor-pointer')
    expect(row.exists()).toBe(true)
  })

  it('renders "Member" badge and chevron for member role', async () => {
    mockPublicLeaderboards.value = [
      { id: '1', name: 'Joined Board', member_count: 5, average_weekly_score: 100, user_role: 'member' }
    ]
    const wrapper = mount(LeaderboardPublic)
    
    expect(wrapper.text()).toContain('Member')
    expect(wrapper.find('svg').exists()).toBe(true)
  })

  it('renders "Requested" badge for pending status without chevron', async () => {
    mockPublicLeaderboards.value = [
      { id: '1', name: 'Requested Board', member_count: 5, average_weekly_score: 100, user_role: 'pending' }
    ]
    const wrapper = mount(LeaderboardPublic)
    
    expect(wrapper.text()).toContain('Requested')
    // We expect 4 SVGs (MagnifyingGlass, ArrowPath, ArrowDown, UserIcon)
    // If ChevronRight was there, it would be 5.
    const svgs = wrapper.findAll('svg')
    expect(svgs.length).toBe(4) 
  })

  it('navigates to leaderboard detail when clicking a joined board', async () => {
    mockPublicLeaderboards.value = [
      { id: '123', name: 'Joined Board', member_count: 5, average_weekly_score: 100, user_role: 'member' }
    ]
    const wrapper = mount(LeaderboardPublic)
    
    await wrapper.find('.cursor-pointer').trigger('click')
    
    expect(mockPush).toHaveBeenCalledWith({
      name: 'leaderboard-detail',
      params: { id: '123' },
      query: { from: 'public' }
    })
  })

  it('shows green tick on role badge after successful join', async () => {
    const board = { id: '1', name: 'Joinable Board', member_count: 5, average_weekly_score: 100, auto_approve: false }
    mockPublicLeaderboards.value = [board]
    
    mockJoinLeaderboard.mockResolvedValue({ message: 'Joined!' })

    const wrapper = mount(LeaderboardPublic)
    
    const joinBtn = wrapper.find('button.btn-common-button')
    await joinBtn.trigger('click')
    await flushPromises()

    // Badge should now show Member
    expect(wrapper.text()).toContain('member')
    
    // Should have the checkmark tick
    expect(wrapper.text()).toContain('✓')
  })
})
