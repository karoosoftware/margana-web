import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useLeaderboardManage } from '../useLeaderboardManage'

// Mock dependencies
vi.mock('aws-amplify/auth', () => ({
  fetchAuthSession: vi.fn(() => Promise.resolve({
    tokens: {
      idToken: { toString: () => 'mock-token' }
    }
  }))
}))

vi.mock('@/assets/word-filters/word-blacklist.json', () => ({
  default: {
    exact_match: ["margana"],
    substring_match: ["admin", "mod", "support", "staff"],
    offensive: ["rude_word1", "offensive_word2"]
  },
  exact_match: ["margana"],
  substring_match: ["admin", "mod", "support", "staff"],
  offensive: ["rude_word1", "offensive_word2"]
}))

vi.mock('@/config/api', () => ({
  API: {
    LEADERBOARDS: 'http://mock-api/leaderboards',
    LEADERBOARD_CHECK_NAME: 'http://mock-api/leaderboards/check-name'
  }
}))

describe('useLeaderboardManage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    global.fetch = vi.fn()
  })

  it('manages steps correctly', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true })
    })

    const { currentStep, leaderboardName, verifyName } = useLeaderboardManage()
    expect(currentStep.value).toBe(1)
    
    leaderboardName.value = 'valid_name'
    const result = await verifyName()
    
    expect(result).toBe(true)
    expect(currentStep.value).toBe(2)
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('name=valid_name'), expect.any(Object))
  })

  it('handles name verification failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: 'Name taken' })
    })

    const { leaderboardName, verifyName, nameError, nameVerified } = useLeaderboardManage()
    leaderboardName.value = 'taken'
    const result = await verifyName()

    expect(result).toBe(false)
    expect(nameVerified.value).toBe(false)
    expect(nameError.value).toBe('Name taken')
  })

  it('handles name unavailable (200 OK with available: false)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ available: false, normalized: 'thedog' })
    })

    const { leaderboardName, verifyName, nameError, nameVerified, currentStep } = useLeaderboardManage()
    leaderboardName.value = 'thedog'
    const result = await verifyName()

    expect(result).toBe(false)
    expect(nameVerified.value).toBe(false)
    expect(nameError.value).toBe('Name is already taken or invalid')
    expect(currentStep.value).toBe(1)
  })

  it('validates name format locally before API call', async () => {
    const { leaderboardName, verifyName, nameError } = useLeaderboardManage()
    
    leaderboardName.value = 'a'.repeat(31)
    await verifyName()
    expect(nameError.value).toContain('Name is too long')
    expect(global.fetch).not.toHaveBeenCalled()
    
    leaderboardName.value = ''
    await verifyName()
    expect(nameError.value).toContain('Please enter a name')
  })

  it('validates blacklist words locally', async () => {
    const { leaderboardName, verifyName, nameError } = useLeaderboardManage()
    
    // Exact match
    leaderboardName.value = 'margana'
    let result = await verifyName()
    expect(result).toBe(false)
    expect(nameError.value).toBe('This name is reserved or restricted')
    
    // Substring match
    leaderboardName.value = 'My Admin Board'
    result = await verifyName()
    expect(result).toBe(false)
    expect(nameError.value).toBe('This name is reserved or restricted')
    
    // Case-insensitivity for exact match
    leaderboardName.value = 'Margana' 
    result = await verifyName()
    expect(result).toBe(false)
    expect(nameError.value).toBe('This name is reserved or restricted')
    
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('manages members and admins with email validation', () => {
    const { members, admins, addMember, addAdmin, removeMember, memberError } = useLeaderboardManage()
    
    // Valid email
    addMember('user1@test.com', 'me@test.com')
    expect(members.value).toContain('user1@test.com')
    expect(memberError.value).toBeNull()
    
    // Invalid email
    addMember('not-an-email', 'me@test.com')
    expect(members.value).not.toContain('not-an-email')
    expect(memberError.value).toBe('Please enter a valid email address')
    
    // Reset error on successful add
    addAdmin('admin1@test.com', 'me@test.com')
    expect(admins.value).toContain('admin1@test.com')
    expect(memberError.value).toBeNull()

    // Prevent adding self
    addMember('me@test.com', 'me@test.com')
    expect(members.value).not.toContain('me@test.com')
    expect(memberError.value).toBe('This user is already added')
    
    // Prevent duplicates
    addMember('admin1@test.com', 'me@test.com')
    expect(members.value).not.toContain('admin1@test.com')
    expect(memberError.value).toBe('This user is already added')
    
    removeMember(0)
    expect(members.value.length).toBe(0)
  })

  it('resets form', () => {
    const { leaderboardName, currentStep, resetForm, nameVerified } = useLeaderboardManage()
    leaderboardName.value = 'test'
    currentStep.value = 3
    
    resetForm()
    
    expect(leaderboardName.value).toBe('')
    expect(currentStep.value).toBe(1)
    expect(nameVerified.value).toBe(false)
  })

  it('builds correct create payload', () => {
    const { leaderboardName, isPublic, admins, members, buildCreatePayload } = useLeaderboardManage()
    
    leaderboardName.value = 'My Awesome Board'
    isPublic.value = true
    admins.value = ['admin@test.com']
    members.value = ['member@test.com']
    
    const payload = buildCreatePayload('me@test.com')
    
    expect(payload).toEqual({
      name: 'My Awesome Board',
      is_public: true,
      auto_approve: true,
      owners: ['me@test.com', 'admin@test.com'],
      members: ['member@test.com']
    })
    
    // Check for private board auto_approve: false
    isPublic.value = false
    const privatePayload = buildCreatePayload('me@test.com')
    expect(privatePayload.auto_approve).toBe(false)
    
    // Check that visibility is NOT in the payload
    expect(payload).not.toHaveProperty('visibility')
  })

  it('calls create leaderboard API', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'new-id' })
    })

    const { createLeaderboard, success } = useLeaderboardManage()
    const result = await createLeaderboard({
      name: 'test',
      is_public: true,
      auto_approve: true,
      owners: ['me@test.com'],
      members: []
    })

    expect(result.id).toBe('new-id')
    expect(success.value).toBe('Leaderboard created successfully!')
    expect(global.fetch).toHaveBeenCalledWith('http://mock-api/leaderboards', expect.objectContaining({
      method: 'POST'
    }))
  })
})
