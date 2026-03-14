import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import LeaderboardMy from '../LeaderboardMy.vue'
import { ref } from 'vue'

// Mock dependencies
vi.mock('@/assets/margana_m_logo.svg', () => ({ default: 'mock-logo' }))

// Mock useRouter
const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush
  })
}))

const mockMyLeaderboards = ref([])
const mockFilteredMyLeaderboards = ref([])
const mockSelectedMyFilters = ref([])
const mockSetMyFilters = vi.fn((filters) => {
  mockSelectedMyFilters.value = filters
})
const mockFetchMyLeaderboards = vi.fn()
const mockResolveInvitation = vi.fn()

vi.mock('@/composables/useLeaderboard', () => ({
  LeaderboardTab: {
    My: 'my',
    Public: 'public',
    Manage: 'manage'
  },
  useLeaderboard: () => ({
    loadingMy: ref(false),
    myError: ref(null),
    fetchMyLeaderboards: mockFetchMyLeaderboards,
    myLeaderboards: mockMyLeaderboards,
    selectedMyFilters: mockSelectedMyFilters,
    filteredMyLeaderboards: mockFilteredMyLeaderboards,
    setMyFilters: mockSetMyFilters,
    resolveInvitation: mockResolveInvitation
  })
}))

describe('LeaderboardMy.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMyLeaderboards.value = []
    mockFilteredMyLeaderboards.value = []
    mockSelectedMyFilters.value = []
  })

  it('renders filter button', () => {
    mockFilteredMyLeaderboards.value = [{ id: '1', name: 'Board 1', role: 'member', is_public: true }]
    mockMyLeaderboards.value = mockFilteredMyLeaderboards.value
    const wrapper = mount(LeaderboardMy)
    expect(wrapper.find('button[aria-label="Filter"]').exists()).toBe(true)
  })

  it('opens filter menu when clicked', async () => {
    mockFilteredMyLeaderboards.value = [{ id: '1', name: 'Board 1', role: 'member', is_public: true }]
    mockMyLeaderboards.value = mockFilteredMyLeaderboards.value
    const wrapper = mount(LeaderboardMy)
    const filterBtn = wrapper.find('button[aria-label="Filter"]')
    await filterBtn?.trigger('click')
    
    expect(wrapper.text()).toContain('Owner')
    expect(wrapper.text()).toContain('Public')
    expect(wrapper.text()).toContain('Private')
  })

  it('calls setMyFilters when a filter is added', async () => {
    mockFilteredMyLeaderboards.value = [{ id: '1', name: 'Board 1', role: 'member', is_public: true }]
    mockMyLeaderboards.value = mockFilteredMyLeaderboards.value
    const wrapper = mount(LeaderboardMy)
    const filterBtn = wrapper.find('button[aria-label="Filter"]')
    await filterBtn?.trigger('click')
    
    // Find the Owner filter option in dropdown
    const options = wrapper.findAll('.group')
    await options[0].trigger('click')
    
    expect(mockSetMyFilters).toHaveBeenCalledWith(['admin'])
  })

  it('removes filter when X is clicked', async () => {
    mockFilteredMyLeaderboards.value = [{ id: '1', name: 'Board 1', role: 'admin', is_public: false }]
    mockMyLeaderboards.value = mockFilteredMyLeaderboards.value
    mockSelectedMyFilters.value = ['admin']
    const wrapper = mount(LeaderboardMy)
    
    // Find the tag for Owner
    expect(wrapper.text()).toContain('Owner')
    
    // Find the X button in the tag
    const xBtn = wrapper.find('button.hover\\:text-white\\/80')
    await xBtn.trigger('click')
    
    expect(mockSetMyFilters).toHaveBeenCalledWith([])
  })

  it('shows empty state with clear button when filters result in no matches', async () => {
    mockFilteredMyLeaderboards.value = []
    mockMyLeaderboards.value = [{ id: '1', name: 'Board 1', role: 'member', is_public: true }]
    mockSelectedMyFilters.value = ['admin']
    const wrapper = mount(LeaderboardMy)
    
    expect(wrapper.text()).toContain('No matching leaderboards')
    const buttons = wrapper.findAll('button')
    const clearBtn = buttons.find(b => b.text().includes('Clear all'))
    expect(clearBtn?.exists()).toBe(true)
    
    await clearBtn?.trigger('click')
    expect(mockSetMyFilters).toHaveBeenCalledWith([])
  })

  it('hides selected filters from dropdown', async () => {
    mockFilteredMyLeaderboards.value = [{ id: '1', name: 'Board 1', role: 'member', is_public: true }]
    mockMyLeaderboards.value = mockFilteredMyLeaderboards.value
    mockSelectedMyFilters.value = ['admin']
    const wrapper = mount(LeaderboardMy)
    
    const filterBtn = wrapper.find('button[aria-label="Filter"]')
    await filterBtn?.trigger('click')
    
    const dropdown = wrapper.find('.animate-fade-in')
    expect(dropdown.text()).not.toContain('Owner')
    expect(dropdown.text()).toContain('Public')
    expect(dropdown.text()).toContain('Private')
  })

  it('renders invitation actions and label', async () => {
    mockFilteredMyLeaderboards.value = [{ id: 'invite-1', name: 'Private Board', role: 'member', status: 'invited', is_public: false }]
    mockMyLeaderboards.value = mockFilteredMyLeaderboards.value
    const wrapper = mount(LeaderboardMy)
    
    expect(wrapper.text()).toContain('New invite')
    expect(wrapper.find('button[title="Accept invitation"]').exists()).toBe(true)
    expect(wrapper.find('button[title="Deny invitation"]').exists()).toBe(true)
  })

  it('navigates to detail on accept and refreshes on deny', async () => {
    mockFilteredMyLeaderboards.value = [{ id: 'invite-1', name: 'Private Board', role: 'member', status: 'invited', is_public: false }]
    mockMyLeaderboards.value = mockFilteredMyLeaderboards.value
    const wrapper = mount(LeaderboardMy)
    
    // Accept
    await wrapper.find('button[title="Accept invitation"]').trigger('click')
    expect(mockResolveInvitation).toHaveBeenCalledWith('invite-1', 'accept')
    // Wait for the mock to resolve
    await Promise.resolve()
    expect(mockPush).toHaveBeenCalledWith({
      name: 'leaderboard-detail',
      params: { id: 'invite-1' },
      query: { from: 'my' }
    })

    // Deny
    await wrapper.find('button[title="Deny invitation"]').trigger('click')
    expect(mockResolveInvitation).toHaveBeenCalledWith('invite-1', 'deny')
    await Promise.resolve()
    expect(mockFetchMyLeaderboards).toHaveBeenCalledWith({ force: true })
  })

  it('navigates to leaderboard detail when clicking a board', async () => {
    mockFilteredMyLeaderboards.value = [{ id: '123', name: 'Board 1', role: 'member', is_public: true }]
    mockMyLeaderboards.value = mockFilteredMyLeaderboards.value
    const wrapper = mount(LeaderboardMy)
    
    await wrapper.find('.cursor-pointer').trigger('click')
    
    expect(mockPush).toHaveBeenCalledWith({
      name: 'leaderboard-detail',
      params: { id: '123' },
      query: { from: 'my' }
    })
  })

  it('prioritizes invited boards and Play Margana in the list', () => {
    mockFilteredMyLeaderboards.value = [
      { id: 'regular', name: 'Regular Board', role: 'member', status: 'active' },
      { id: 'invited-2', name: 'Invited Board 2', role: 'member', status: 'invited' },
      { id: 'invited-1', name: 'Invited Board 1', role: 'member', status: 'invited' },
      { id: 'play-margana', name: 'Play Margana', role: 'member', status: 'active' },
      { id: 'another', name: 'Another Board', role: 'member', status: 'active' }
    ]
    mockMyLeaderboards.value = mockFilteredMyLeaderboards.value
    const wrapper = mount(LeaderboardMy)
    
    const boardNames = wrapper.findAll('.text-white.font-semibold').map(el => el.text())
    expect(boardNames[0]).toBe('Invited Board 2')
    expect(boardNames[1]).toBe('Invited Board 1')
    expect(boardNames[2]).toBe('Play Margana')
    expect(boardNames[3]).toBe('Regular Board')
    expect(boardNames[4]).toBe('Another Board')
  })
})
