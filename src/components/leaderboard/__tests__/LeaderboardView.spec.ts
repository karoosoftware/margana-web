import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import LeaderboardView from '../LeaderboardView.vue'
import { ref } from 'vue'

// Mock useLeaderboard
const mockCurrentLeaderboard = ref(null)
const mockLoadingDetail = ref(false)
const mockDetailError = ref(null)
const mockDetailErrorCode = ref(null)
const mockFetchLeaderboardDetail = vi.fn()
const mockJoinRequests = ref([])
const mockLoadingRequests = ref(false)
const mockLeaderboardScores = ref({})
const mockLoadingScores = ref(false)

vi.mock('@/composables/useLeaderboard', () => ({
  useLeaderboard: () => ({
    currentLeaderboard: mockCurrentLeaderboard,
    loadingDetail: mockLoadingDetail,
    detailError: mockDetailError,
    detailErrorCode: mockDetailErrorCode,
    fetchLeaderboardDetail: mockFetchLeaderboardDetail,
    joinRequests: mockJoinRequests,
    loadingRequests: mockLoadingRequests,
    requestsError: ref(null),
    fetchJoinRequests: vi.fn(),
    resolveJoinRequest: vi.fn(),
    resolveInvitation: vi.fn(),
    leaveLeaderboard: vi.fn(),
    deleteLeaderboard: vi.fn(),
    updateLeaderboardSettings: vi.fn(),
    checkLeaderboardName: vi.fn(),
    kickMember: vi.fn(),
    promoteMember: vi.fn(),
    inviteMember: vi.fn(),
    fetchLeaderboardScores: vi.fn(),
    loadingScores: mockLoadingScores,
    leaderboardScores: mockLeaderboardScores,
    resetLeaderboardDetail: vi.fn()
  })
}))

// Mock useMarganaAuth
vi.mock('@/composables/useMarganaAuth', () => ({
  useMarganaAuth: () => ({
    userSub: ref('user-123')
  })
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

// Mock LeaderboardScoreTable
vi.mock('@/components/leaderboard/LeaderboardScoreTable.vue', () => ({
  default: { template: '<div class="score-table-mock" />' }
}))

describe('LeaderboardView.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCurrentLeaderboard.value = null
    mockLoadingDetail.value = false
    mockDetailError.value = null
    mockDetailErrorCode.value = null
  })

  it('calls fetchLeaderboardDetail on mount', () => {
    mount(LeaderboardView, { 
      props: { id: '123' },
      global: {
        stubs: {
          'router-link': true,
          'LeaderboardScoreTable': true
        }
      }
    })
    expect(mockFetchLeaderboardDetail).toHaveBeenCalledWith('123', false)
  })

  it('renders loading state', () => {
    mockLoadingDetail.value = true
    const wrapper = mount(LeaderboardView, { props: { id: '123' } })
    expect(wrapper.find('.dots-loader').exists()).toBe(true)
  })

  it('renders error state', () => {
    mockDetailError.value = 'Failed to load'
    const wrapper = mount(LeaderboardView, { 
      props: { id: '123' },
      global: {
        stubs: {
          'router-link': true
        }
      }
    })
    expect(wrapper.text()).toContain('Failed to load')
    expect(wrapper.find('button').text()).toBe('Try Again')
  })

  it('renders tailored message for 403 error', () => {
    mockDetailError.value = 'Forbidden'
    mockDetailErrorCode.value = 403
    const wrapper = mount(LeaderboardView, { 
      props: { id: '123' },
      global: {
        stubs: {
          'router-link': true
        }
      }
    })
    expect(wrapper.text()).toContain('You do not have permission or your permission has been removed')
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.find('router-link-stub').exists()).toBe(true)
  })

  it('renders tailored message for 404 error', () => {
    mockDetailError.value = 'Not Found'
    mockDetailErrorCode.value = 404
    const wrapper = mount(LeaderboardView, { 
      props: { id: '123' },
      global: {
        stubs: {
          'router-link': true
        }
      }
    })
    expect(wrapper.text()).toContain('This leaderboard no longer exists')
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.find('router-link-stub').exists()).toBe(true)
  })

  it('renders leaderboard details', async () => {
    mockCurrentLeaderboard.value = {
      id: '123',
      name: 'Alpha Team',
      role: 'admin',
      is_public: true,
      member_count: 10,
      admin_count: 2,
      member_subs: ['sub1', 'sub2'],
      admin_subs: ['sub1', 'sub2'],
      user_labels: { 'sub1': 'Alice', 'sub2': 'Bob' }
    }
    
    const wrapper = mount(LeaderboardView, { props: { id: '123' } })
    
    expect(wrapper.text()).toContain('Alpha Team')
    expect(wrapper.text()).toContain('Public')
    expect(wrapper.text()).toContain('Owner') // Role
  })

  it('renders rename icon for admin', async () => {
    mockCurrentLeaderboard.value = {
      id: '123',
      name: 'Alpha Team',
      role: 'admin',
      is_public: true,
      member_subs: ['sub1'],
      admin_subs: ['sub1'],
      user_labels: { 'sub1': 'Alice' }
    }
    const wrapper = mount(LeaderboardView, { props: { id: '123' } })
    expect(wrapper.find('button[title="Rename leaderboard"]').exists()).toBe(true)
  })

  it('renders leave icon for member', async () => {
    mockCurrentLeaderboard.value = {
      id: '123',
      name: 'Alpha Team',
      role: 'member',
      is_public: true,
      member_subs: ['sub1', 'sub-123'],
      admin_subs: ['sub1'],
      user_labels: { 'sub1': 'Alice', 'sub-123': 'Me' },
      admin_count: 1
    }
    const wrapper = mount(LeaderboardView, { props: { id: '123' } })
    expect(wrapper.find('button[title="Leave leaderboard"]').exists()).toBe(true)
    expect(wrapper.find('button[title="Rename leaderboard"]').exists()).toBe(false)
  })

  it('renders delete icon for last admin', async () => {
    mockCurrentLeaderboard.value = {
      id: '123',
      name: 'Alpha Team',
      role: 'admin',
      is_public: true,
      member_subs: ['user-123'],
      admin_subs: ['user-123'],
      user_labels: { 'user-123': 'Me' },
      admin_count: 1
    }
    const wrapper = mount(LeaderboardView, { props: { id: '123' } })
    expect(wrapper.find('button[title="Delete leaderboard"]').exists()).toBe(true)
    expect(wrapper.find('button[title="Leave leaderboard"]').exists()).toBe(false)
  })

  it('shows leave confirmation modal when leave icon is clicked', async () => {
    mockCurrentLeaderboard.value = {
      id: '123',
      name: 'Alpha Team',
      role: 'member',
      is_public: true,
      member_subs: ['sub1', 'sub-123'],
      admin_subs: ['sub1'],
      user_labels: { 'sub1': 'Alice', 'sub-123': 'Me' },
      admin_count: 1
    }
    const wrapper = mount(LeaderboardView, { 
      props: { id: '123' },
      global: {
        stubs: {
          ConfirmationModal: true
        }
      }
    })
    
    await wrapper.find('button[title="Leave leaderboard"]').trigger('click')
    
    // Check if showLeaveConfirm is true. 
    // Since it's a private ref, we check if the ConfirmationModal with correct props is shown
    const modals = wrapper.findAllComponents({ name: 'ConfirmationModal' })
    // We have several modals: Delete, Leave, Kick, Promote.
    // We need to find the one with title "Leave Leaderboard?"
    const leaveModal = modals.find(m => m.props('title') === 'Leaving leaderboard')
    expect(leaveModal?.props('show')).toBe(true)
  })

  it('renders invite icon for admin', async () => {
    mockCurrentLeaderboard.value = {
      id: '123',
      name: 'Alpha Team',
      role: 'admin',
      is_public: true,
      member_subs: ['sub1'],
      admin_subs: ['sub1'],
      user_labels: { 'sub1': 'Alice' }
    }
    const wrapper = mount(LeaderboardView, { props: { id: '123' } })
    expect(wrapper.find('button[title="Invite member"]').exists()).toBe(true)
  })

  it('shows invite input when invite icon is clicked', async () => {
    mockCurrentLeaderboard.value = {
      id: '123',
      name: 'Alpha Team',
      role: 'admin',
      is_public: true,
      member_subs: ['sub1'],
      admin_subs: ['sub1'],
      user_labels: { 'sub1': 'Alice' }
    }
    const wrapper = mount(LeaderboardView, { props: { id: '123' } })
    await wrapper.find('button[title="Invite member"]').trigger('click')
    expect(wrapper.find('input[placeholder="Enter email to invite"]').exists()).toBe(true)
  })
})
