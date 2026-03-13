import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useLeaderboard, LeaderboardTab } from '../useLeaderboard'
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
    LEADERBOARDS: 'http://mock-api/my',
    LEADERBOARDS_PUBLIC: 'http://mock-api/public',
    LEADERBOARD_JOIN: (id: string) => `http://mock-api/join/${id}`,
    LEADERBOARD_INVITATIONS: (id: string) => `http://mock-api/invitations/${id}`
  }
}))

describe('useLeaderboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cache.clearAll()
    // Reset singleton state if possible or just ensure fresh start
    const { setActiveTab } = useLeaderboard()
    setActiveTab(LeaderboardTab.My)
  })

  it('manages active tab', () => {
    const { activeTab, setActiveTab } = useLeaderboard()
    expect(activeTab.value).toBe(LeaderboardTab.My)
    
    setActiveTab(LeaderboardTab.Public)
    expect(activeTab.value).toBe(LeaderboardTab.Public)
  })

  it('fetches my leaderboards', async () => {
    const mockData = {
      leaderboards: [
        { id: '1', name: 'My Board 1', role: 'admin', status: 'active', created_at: '2023-01-01' }
      ]
    }

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData)
    })

    const { fetchMyLeaderboards, myLeaderboards } = useLeaderboard()
    
    await fetchMyLeaderboards()
    
    expect(myLeaderboards.value).toEqual(mockData.leaderboards)
    expect(global.fetch).toHaveBeenCalledWith('http://mock-api/my', expect.any(Object))
  })

  it('filters my leaderboards by labels', async () => {
    const mockData = {
      leaderboards: [
        { id: '1', name: 'Admin Public', role: 'admin', is_public: true },
        { id: '2', name: 'Member Private', role: 'member', is_public: false },
        { id: '3', name: 'Member Public', role: 'member', is_public: true },
        { id: '4', name: 'Admin Private', role: 'admin', is_public: false }
      ]
    }

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData)
    })

    const { fetchMyLeaderboards, filteredMyLeaderboards, setMyFilters } = useLeaderboard()
    
    await fetchMyLeaderboards()
    
    // Default: no filter, shows all
    expect(filteredMyLeaderboards.value.length).toBe(4)

    // Filter by Admin only
    setMyFilters(['admin'])
    expect(filteredMyLeaderboards.value.length).toBe(2)
    expect(filteredMyLeaderboards.value.map(b => b.id)).toEqual(['1', '4'])

    // Filter by Private only
    setMyFilters(['private'])
    expect(filteredMyLeaderboards.value.length).toBe(2)
    expect(filteredMyLeaderboards.value.map(b => b.id)).toEqual(['2', '4'])

    // Filter by Admin and Private (AND logic)
    setMyFilters(['admin', 'private'])
    // Should show only 4 (Admin & Private)
    expect(filteredMyLeaderboards.value.length).toBe(1)
    expect(filteredMyLeaderboards.value.map(b => b.id)).toEqual(['4'])

    // Filter by Public only
    setMyFilters(['public'])
    expect(filteredMyLeaderboards.value.length).toBe(2)
    expect(filteredMyLeaderboards.value.map(b => b.id)).toEqual(['1', '3'])
    
    // Reset filters
    setMyFilters([])
    expect(filteredMyLeaderboards.value.length).toBe(4)
  })

  it('fetches public leaderboards', async () => {
    const mockData = {
      leaderboards: [
        { id: '1', name: 'Board 1', average_weekly_score: 100, member_count: 5, is_public: true, auto_approve: true }
      ],
      next_cursor: 'cursor-123'
    }

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData)
    })

    const { fetchPublicLeaderboards, publicLeaderboards, publicNextCursor } = useLeaderboard()
    
    await fetchPublicLeaderboards({ reset: true })
    
    expect(publicLeaderboards.value).toEqual(mockData.leaderboards)
    expect(publicNextCursor.value).toBe('cursor-123')
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('sort=highest'), expect.any(Object))
  })

  it('joins a leaderboard', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: 'Joined' })
    })

    const { joinLeaderboard } = useLeaderboard()
    const result = await joinLeaderboard('board-123')
    
    expect(result.message).toBe('Joined')
    expect(global.fetch).toHaveBeenCalledWith('http://mock-api/join/board-123', expect.objectContaining({
      method: 'POST'
    }))
  })

  it('resolves an invitation', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: 'Accepted' })
    })

    const { resolveInvitation } = useLeaderboard()
    const result = await resolveInvitation('board-123', 'accept')
    
    expect(result.message).toBe('Accepted')
    expect(global.fetch).toHaveBeenCalledWith('http://mock-api/invitations/board-123', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ action: 'accept' })
    }))
  })

  it('fetches leaderboard detail', async () => {
    const mockDetail = {
      id: 'board-123',
      name: 'Test Board',
      role: 'admin',
      is_public: true,
      auto_approve: true,
      created_at: '2023-01-01',
      member_count: 5,
      admin_count: 1,
      member_subs: ['sub1', 'sub2'],
      admin_subs: ['sub1'],
      user_labels: { 'sub1': 'User 1', 'sub2': 'User 2' }
    }

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockDetail)
    })

    const { fetchLeaderboardDetail, currentLeaderboard } = useLeaderboard()
    await fetchLeaderboardDetail('board-123')

    expect(currentLeaderboard.value).toEqual(mockDetail)
    expect(global.fetch).toHaveBeenCalledWith('http://mock-api/my/board-123', expect.any(Object))
  })

  it('provides prebuilt metadata for play-margana without API call', async () => {
    global.fetch = vi.fn()

    const { fetchLeaderboardDetail, currentLeaderboard } = useLeaderboard()
    await fetchLeaderboardDetail('play-margana')

    expect(currentLeaderboard.value).not.toBeNull()
    expect(currentLeaderboard.value?.id).toBe('play-margana')
    expect(currentLeaderboard.value?.name).toBe('Play Margana')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('clears cache when fetchLeaderboardDetail hits 403', async () => {
    const { fetchLeaderboardDetail } = useLeaderboard()
    
    // Setup some cached data
    cache.set('my_leaderboards', [{ id: 'board-123' }], 3600, 'persisted' as any)
    expect(cache.get('my_leaderboards', 'persisted' as any)).not.toBeNull()
    
    // Mock a 403 response
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: () => Promise.resolve({ error: 'Not a member' })
    })

    // Trigger the call (and ignore the error since we are testing side effect)
    try { await fetchLeaderboardDetail('board-123') } catch (e) {}
    
    // Verify cache is cleared
    expect(cache.get('my_leaderboards', 'persisted' as any)).toBeNull()
  })
})
