import { ref, computed, onMounted } from 'vue'
import { deleteUser, fetchUserAttributes, getCurrentUser, signOut } from 'aws-amplify/auth'
import { post } from 'aws-amplify/api'
import { ENDPOINTS } from '@/config/api'
import { cache } from '@/utils/cache'
import { useLeaderboard } from './useLeaderboard'

export enum UserTier {
  GUEST = 1,
  REGISTERED = 2,
  PREMIUM = 3
}

const TERMS_VERSION = '1.0'

// Singleton state
const userLabel = ref('')
const userEmail = ref('')
const userSub = ref('')
const username = ref('')
const isAuthenticated = ref(false)
const isPremium = ref(false) // Placeholder for future Stripe integration
const initialized = ref(false)
const termsAcceptedVersion = ref(localStorage.getItem('margana.guest_terms_accepted') || '')

function getOrCreateGuestId(): string {
  try {
    const key = 'margana.guest_id'
    let id = localStorage.getItem(key)
    if (!id) {
      id = 'g_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
      localStorage.setItem(key, id)
    }
    return id
  } catch (_) {
    return 'g_fallback'
  }
}

export function useMarganaAuth() {
  const userTier = computed(() => {
    if (!isAuthenticated.value) return UserTier.GUEST
    if (isPremium.value) return UserTier.PREMIUM
    return UserTier.REGISTERED
  })

  const guestId = computed(() => isAuthenticated.value ? null : getOrCreateGuestId())

  const needsTermsAcceptance = computed(() => {
    if (userTier.value !== UserTier.GUEST) return false
    return termsAcceptedVersion.value < TERMS_VERSION
  })

  const acceptTerms = async () => {
    const id = guestId.value
    if (!id) return

    try {
      await post({
        apiName: 'MarganaApi',
        path: `${ENDPOINTS.MARGANA_TERMS_AUDIT_GUEST}/${id}`,
        options: {
          body: {
            email: id, // Plan says pass guestId in email field
            terms_version: TERMS_VERSION,
            accepted_at: new Date().toISOString(),
            userAgent: navigator.userAgent
          }
        }
      }).response

      termsAcceptedVersion.value = TERMS_VERSION
      localStorage.setItem('margana.guest_terms_accepted', TERMS_VERSION)
    } catch (err) {
      console.error('Failed to log guest terms acceptance:', err)
      // We still update local state to avoid blocking the user if API fails
      // but ideally we want the audit to succeed.
      termsAcceptedVersion.value = TERMS_VERSION
      localStorage.setItem('margana.guest_terms_accepted', TERMS_VERSION)
    }
  }

  /**
   * Helper to gate features based on UserTier.
   * @param minTier The minimum tier required to access the feature.
   */
  const canAccess = (minTier: UserTier) => {
    return userTier.value >= minTier
  }

  const fetchUser = async () => {
    try {
      const user = await getCurrentUser()
      isAuthenticated.value = !!user
      userSub.value = user?.userId || ''
      
      // NEW: Unlock the UI as soon as session/identity is confirmed.
      // We don't need to wait for user attributes (name/email) to render the dashboard.
      initialized.value = true

      const attrs = await fetchUserAttributes().catch(() => ({}))
      const given = attrs?.given_name || attrs?.givenName
      const family = attrs?.family_name || attrs?.familyName
      const name = attrs?.name
      const email = attrs?.email
      userEmail.value = typeof email === 'string' ? email : ''

      let label = ''
      if (name && typeof name === 'string') label = name
      else if ((given || family) && (typeof given === 'string' || typeof family === 'string')) label = [given, family].filter(Boolean).join(' ')
      else if (email && typeof email === 'string') label = email

      if (!label) {
        label = user?.signInDetails?.loginId || user?.username || ''
      }

      userLabel.value = label
    } catch (_) {
      isAuthenticated.value = false
      userLabel.value = ''
      userEmail.value = ''
      // Ensure we unlock the UI even on failure
      initialized.value = true
    }
  }

  const deleteAccount = async () => {
    try {
      await deleteUser()
    } catch (err) {
      console.error('Error deleting account:', err)
      throw err
    } finally {
      isAuthenticated.value = false
      userLabel.value = ''
      userEmail.value = ''
      username.value = ''
      userSub.value = ''
      isPremium.value = false

      // Clear all app-related local and session storage (including preferences)
      cache.clearAll(undefined, true)
      
      // Reset other stateful composables
      try {
        const { resetAll } = useLeaderboard()
        resetAll()
      } catch (e) {
        console.warn('Failed to reset leaderboard state:', e)
      }
    }
  }

  const logout = async () => {
    try {
      await signOut()
    } catch (_) {
      // ignore
    } finally {
      isAuthenticated.value = false
      userLabel.value = ''
      userEmail.value = ''
      username.value = ''
      userSub.value = ''
      isPremium.value = false
      
      // Clear all app-related local and session storage
      cache.clearAll()

      // Reset other stateful composables
      try {
        const { resetAll } = useLeaderboard()
        resetAll()
      } catch (e) {
        console.warn('Failed to reset leaderboard state:', e)
      }
      
      // Keep initialized = true so we don't re-fetch immediately
    }
  }

  // No longer use onMounted here to avoid warnings when called in async contexts
  // or outside of setup(). Consumers should call fetchUser() or rely on 
  // App.vue calling it.

  return {
    userLabel,
    userEmail,
    username,
    userSub,
    userTier,
    isAuthenticated,
    isPremium,
    initialized,
    canAccess,
    guestId,
    needsTermsAcceptance,
    acceptTerms,
    fetchUser,
    deleteAccount,
    logout
  }
}
