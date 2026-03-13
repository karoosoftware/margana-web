import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import LeaderboardScoreTable from '../LeaderboardScoreTable.vue'
import { ref } from 'vue'

// Mock useLeaderboard
const mockCurrentLeaderboard = ref(null)
const mockLeaderboardScores = ref({})
const mockLoadingScores = ref(false)
const mockFetchLeaderboardScores = vi.fn()

vi.mock('@/composables/useLeaderboard', () => ({
  useLeaderboard: () => ({
    currentLeaderboard: mockCurrentLeaderboard,
    leaderboardScores: mockLeaderboardScores,
    loadingScores: mockLoadingScores,
    scoresError: ref(null),
    fetchLeaderboardScores: mockFetchLeaderboardScores
  })
}))

// Mock useMarganaAuth
vi.mock('@/composables/useMarganaAuth', () => ({
  useMarganaAuth: () => ({
    userSub: ref('user-123')
  })
}))

describe('LeaderboardScoreTable.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCurrentLeaderboard.value = {
      id: '123',
      name: 'Alpha Team',
      role: 'admin',
      is_public: true,
      user_labels: { 'user-123': 'Me', 'user-456': 'Other' }
    }
    mockLeaderboardScores.value = {
      'user-123': { '2026-02-16': 100 },
      'user-456': { '2026-02-16': 200 }
    }
  })

  it('renders member names and scores', () => {
    const wrapper = mount(LeaderboardScoreTable, { props: { id: '123' } })
    expect(wrapper.text()).toContain('Me')
    expect(wrapper.text()).toContain('Other')
  })

  it('renders delete icon for admin on other members', () => {
    const wrapper = mount(LeaderboardScoreTable, { props: { id: '123' } })
    
    // Find all buttons with title "Remove Member"
    const deleteButtons = wrapper.findAll('button[title="Remove Member"]')
    
    // Should be 1 button (for user-456), not for user-123 (self)
    expect(deleteButtons.length).toBe(2) // One for mobile, one for desktop
    
    // Verify it's not for user-123
    // In our mock, user-123 is the current user.
  })

  it('does not render delete icon for non-admin', () => {
    mockCurrentLeaderboard.value.role = 'member'
    const wrapper = mount(LeaderboardScoreTable, { props: { id: '123' } })
    expect(wrapper.find('button[title="Remove Member"]').exists()).toBe(false)
  })

  it('emits kick event when delete icon is clicked', async () => {
    const wrapper = mount(LeaderboardScoreTable, { props: { id: '123' } })
    
    // Click the delete button in desktop view (it's the second one usually, or just find one)
    const deleteButton = wrapper.find('button[title="Remove Member"]')
    await deleteButton.trigger('click')
    
    expect(wrapper.emitted('kick')).toBeTruthy()
    expect(wrapper.emitted('kick')[0]).toEqual(['user-456'])
  })
})
