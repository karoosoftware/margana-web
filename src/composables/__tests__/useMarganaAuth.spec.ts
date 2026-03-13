import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useMarganaAuth, UserTier } from '../useMarganaAuth'
import { getCurrentUser, fetchUserAttributes } from 'aws-amplify/auth'
import { ref, onMounted } from 'vue'

// Mock AWS Amplify
vi.mock('aws-amplify/auth', () => ({
  getCurrentUser: vi.fn(),
  fetchUserAttributes: vi.fn()
}))

// Mock Vue's onMounted to execute the callback immediately
vi.mock('vue', async () => {
  const actual = await vi.importActual('vue')
  return {
    ...actual,
    onMounted: vi.fn((cb) => cb())
  }
})

describe('useMarganaAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize as GUEST when not authenticated', async () => {
    vi.mocked(getCurrentUser).mockRejectedValue(new Error('No user'))

    const { userTier, isAuthenticated, userLabel, fetchUser } = useMarganaAuth()
    await fetchUser()

    expect(isAuthenticated.value).toBe(false)
    expect(userTier.value).toBe(UserTier.GUEST)
    expect(userLabel.value).toBe('')
  })

  it('should initialize as REGISTERED when authenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ username: 'testuser', userId: '123' } as any)
    vi.mocked(fetchUserAttributes).mockResolvedValue({ email: 'test@example.com' } as any)

    const { userTier, isAuthenticated, userLabel, fetchUser } = useMarganaAuth()
    await fetchUser()

    expect(isAuthenticated.value).toBe(true)
    expect(userTier.value).toBe(UserTier.REGISTERED)
    expect(userLabel.value).toBe('test@example.com')
  })

  it('should use name attribute for userLabel if available', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ username: 'testuser' } as any)
    vi.mocked(fetchUserAttributes).mockResolvedValue({ name: 'John Doe' } as any)

    const { userLabel, fetchUser } = useMarganaAuth()
    await fetchUser()

    expect(userLabel.value).toBe('John Doe')
  })

  it('should join given_name and family_name if both are available', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ username: 'testuser' } as any)
    vi.mocked(fetchUserAttributes).mockResolvedValue({ given_name: 'Paul', family_name: 'Bradbury' } as any)

    const { userLabel, fetchUser } = useMarganaAuth()
    await fetchUser()

    expect(userLabel.value).toBe('Paul Bradbury')
  })

  it('should fall back to username if no attributes are found', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ username: 'testuser' } as any)
    vi.mocked(fetchUserAttributes).mockResolvedValue({} as any)

    const { userLabel, fetchUser } = useMarganaAuth()
    await fetchUser()

    expect(userLabel.value).toBe('testuser')
  })

  it('should be PREMIUM when isPremium is true', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ username: 'testuser' } as any)
    vi.mocked(fetchUserAttributes).mockResolvedValue({} as any)

    const { userTier, isPremium, fetchUser } = useMarganaAuth()
    await fetchUser()
    
    isPremium.value = true
    expect(userTier.value).toBe(UserTier.PREMIUM)
  })
})
