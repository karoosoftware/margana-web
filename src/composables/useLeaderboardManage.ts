import { ref } from 'vue'
import { fetchAuthSession } from 'aws-amplify/auth'
import { API } from '@/config/api'
import wordBlacklist from '@/assets/word-filters/word-blacklist.json'
import { cache, CacheType } from '@/utils/cache'

export interface LeaderboardCreatePayload {
  name: string
  is_public: boolean
  auto_approve: boolean
  owners: string[]
  members: string[]
}

export function useLeaderboardManage() {
  const currentStep = ref(1)
  const leaderboardName = ref('')
  const isPublic = ref(false)
  const autoApprove = ref(true)
  const members = ref<string[]>([])
  const admins = ref<string[]>([])
  
  const nameError = ref<string | null>(null)
  const nameVerified = ref(false)
  const verifyingName = ref(false)
  
  const memberError = ref<string | null>(null)
  
  const submitting = ref(false)
  const success = ref<string | null>(null)
  const lastCreatePayload = ref<LeaderboardCreatePayload | null>(null)
  
  const verifyName = async () => {
    nameError.value = null
    const name = leaderboardName.value.trim()
    
    if (!name) {
      nameError.value = 'Please enter a name'
      return false
    }
    
    if (name.length > 30) {
      nameError.value = 'Name is too long. Maximum 30 characters.'
      return false
    }

    const lowerName = name.toLowerCase()
    
    // Check exact matches
    if (wordBlacklist && wordBlacklist.exact_match && wordBlacklist.exact_match.some((word: string) => lowerName === word.toLowerCase())) {
      nameError.value = 'This name is reserved or restricted'
      return false
    }

    // Check substring matches (brand protection)
    if (wordBlacklist && wordBlacklist.substring_match && wordBlacklist.substring_match.some((word: string) => lowerName.includes(word.toLowerCase()))) {
      nameError.value = 'This name is reserved or restricted'
      return false
    }

    // Check offensive words (whole word match to avoid Scunthorpe problem)
    const words = lowerName.split(/[^a-z0-9]+/).filter(Boolean)
    if (wordBlacklist && wordBlacklist.offensive && wordBlacklist.offensive.some((badWord: string) => words.includes(badWord.toLowerCase()))) {
      nameError.value = 'This name is reserved or restricted'
      return false
    }

    verifyingName.value = true
    try {
      const session = await fetchAuthSession()
      const token = session.tokens?.idToken?.toString()
      const url = new URL(API.LEADERBOARD_CHECK_NAME)
      url.searchParams.append('name', name)

      const resp = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}))
        nameError.value = data.error || data.message || 'Name is already taken or invalid'
        return false
      }

      const data = await resp.json()
      if (data.available === false) {
        nameError.value = data.error || 'Name is already taken or invalid'
        return false
      }

      nameVerified.value = true
      currentStep.value = 2
      return true
    } catch (err: any) {
      nameError.value = err.message || 'Connection error'
      return false
    } finally {
      verifyingName.value = false
    }
  }

  const addMember = (email: string, currentUser?: string) => {
    memberError.value = null
    const val = email.trim().toLowerCase()
    
    if (!val) {
      return false
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(val)) {
      memberError.value = 'Please enter a valid email address'
      return false
    }

    if (members.value.includes(val) || admins.value.includes(val) || val === currentUser?.toLowerCase()) {
      memberError.value = 'This user is already added'
      return false
    }

    members.value.push(val)
    return true
  }

  const removeMember = (index: number) => {
    members.value.splice(index, 1)
  }

  const addAdmin = (email: string, currentUser?: string) => {
    memberError.value = null
    const val = email.trim().toLowerCase()

    if (!val) {
      return false
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(val)) {
      memberError.value = 'Please enter a valid email address'
      return false
    }

    if (members.value.includes(val) || admins.value.includes(val) || val === currentUser?.toLowerCase()) {
      memberError.value = 'This user is already added'
      return false
    }

    admins.value.push(val)
    return true
  }

  const removeAdmin = (index: number) => {
    admins.value.splice(index, 1)
  }

  const buildCreatePayload = (ownerEmail?: string): LeaderboardCreatePayload => {
    const primaryOwner = (ownerEmail || '').trim().toLowerCase()
    const owners = [primaryOwner, ...admins.value]
      .filter(Boolean)
      .filter((val, idx, arr) => arr.indexOf(val) === idx)

    return {
      name: leaderboardName.value.trim(),
      is_public: isPublic.value,
      auto_approve: isPublic.value ? true : false,
      owners,
      members: [...members.value]
    }
  }

  const createLeaderboard = async (payload?: LeaderboardCreatePayload) => {
    const requestBody = payload ?? buildCreatePayload()
    lastCreatePayload.value = requestBody
    submitting.value = true

    try {
      const session = await fetchAuthSession()
      const token = session.tokens?.idToken?.toString()

      const resp = await fetch(API.LEADERBOARDS, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      const data = await resp.json().catch(() => ({}))

      if (!resp.ok) {
        throw new Error(data.error || data.message || `Failed to create: ${resp.statusText}`)
      }

      success.value = 'Leaderboard created successfully!'
      cache.remove('my_leaderboards', CacheType.Persisted)
      cache.remove('public_leaderboards_highest', CacheType.Persisted)
      cache.remove('public_leaderboards_entry', CacheType.Persisted)
      return data
    } catch (err: any) {
      console.error('Create leaderboard failed', err)
      // For now we don't have a separate error ref for creation, so we just rethrow
      // or we could use nameError but that might be confusing.
      throw err
    } finally {
      submitting.value = false
    }
  }

  const resetForm = () => {
    currentStep.value = 1
    leaderboardName.value = ''
    isPublic.value = false
    autoApprove.value = true
    members.value = []
    admins.value = []
    nameVerified.value = false
    success.value = null
    lastCreatePayload.value = null
    nameError.value = null
    memberError.value = null
  }

  return {
    currentStep,
    leaderboardName,
    isPublic,
    autoApprove,
    members,
    admins,
    nameError,
    memberError,
    nameVerified,
    verifyingName,
    submitting,
    success,
    lastCreatePayload,
    verifyName,
    addMember,
    removeMember,
    addAdmin,
    removeAdmin,
    buildCreatePayload,
    createLeaderboard,
    resetForm
  }
}
