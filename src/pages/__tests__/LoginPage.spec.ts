import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import LoginPage from '../LoginPage.vue'
import { nextTick, ref } from 'vue'
import { signIn } from 'aws-amplify/auth'

// Mock Amplify
vi.mock('aws-amplify/auth', () => ({
  signIn: vi.fn(),
  confirmSignIn: vi.fn(),
  resetPassword: vi.fn(),
  confirmResetPassword: vi.fn(),
  signUp: vi.fn(),
  confirmSignUp: vi.fn(),
  resendSignUpCode: vi.fn(),
  fetchAuthSession: vi.fn()
}))

vi.mock('aws-amplify/api', () => ({
  post: vi.fn()
}))

// Mock other dependencies
vi.mock('@/config/api', () => ({
  API: { GATEWAY: 'https://api.test' },
  ENDPOINTS: { 
    MARGANA_TERMS_AUDIT: '/audit',
    MARGANA_TERMS_AUDIT_GUEST: '/audit_guest'
  }
}))

vi.mock('@/usage/ActivityTracker', () => ({
  ActivityTracker: {
    setUser: vi.fn(),
    record: vi.fn(),
    flush: vi.fn(),
    stop: vi.fn()
  }
}))

vi.mock('@/composables/useMarganaAuth', () => ({
  useMarganaAuth: () => ({
    fetchUser: vi.fn()
  })
}))

// Mock router
const mockRoute = {
  query: {} as any,
  hash: '',
  fullPath: '/login'
}

vi.mock('vue-router', () => ({
  useRouter: () => ({
    replace: vi.fn(),
    back: vi.fn()
  }),
  useRoute: () => mockRoute
}))

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRoute.query = {}
    mockRoute.hash = ''
    mockRoute.fullPath = '/login'
  })

  it('sets isEmailLocked to false when transition to SIGNUP from AuthEmailEntry', async () => {
    // Mock UserNotFoundException
    vi.mocked(signIn).mockRejectedValue({ name: 'UserNotFoundException' })

    const wrapper = mount(LoginPage)
    
    // Find AuthEmailEntry and emit continue
    const emailEntry = wrapper.findComponent({ name: 'AuthEmailEntry' })
    await emailEntry.vm.$emit('continue', 'newuser@example.com')
    
    await nextTick() // Wait for handleEmailContinue
    await nextTick() // Wait for ref updates
    
    // Check if flow changed to SIGNUP
    expect(wrapper.vm.flow).toBe('SIGNUP')
    // Check if isEmailLocked is false (so user can fix typos)
    expect(wrapper.vm.isEmailLocked).toBe(false)
    
    // Verify SignUpForm gets the prop
    const signUpForm = wrapper.findComponent({ name: 'SignUpForm' })
    expect(signUpForm.props('emailLocked')).toBe(false)
  })

  it('sets isEmailLocked to false when arriving directly via URL', async () => {
    mockRoute.query = { signup: 'true' }
    mockRoute.fullPath = '/login?signup=true'
    
    const wrapper = mount(LoginPage)
    
    await nextTick()
    
    expect(wrapper.vm.flow).toBe('SIGNUP')
    expect(wrapper.vm.isEmailLocked).toBe(false)
    
    const signUpForm = wrapper.findComponent({ name: 'SignUpForm' })
    expect(signUpForm.props('emailLocked')).toBe(false)
  })
})
