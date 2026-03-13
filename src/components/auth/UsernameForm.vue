<script setup>
import { ref, computed, watch } from 'vue'
import { fetchAuthSession } from 'aws-amplify/auth'
import { API } from '@/config/api'
import { cache, CacheType } from '@/utils/cache'
import { useMarganaAuth } from '@/composables/useMarganaAuth'

const props = defineProps({
  initialUsername: {
    type: String,
    default: ''
  },
  isEdit: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['success', 'cancel'])

const { username: globalUsername } = useMarganaAuth()

const username = ref(props.initialUsername)
const usernameChecking = ref(false)
const profileSaving = ref(false)
const usernameError = ref('')

const USERNAME_REGEX = /^[A-Za-z][a-z0-9_]{0,14}$/
const isUsernameValid = computed(() => USERNAME_REGEX.test(username.value))
const hasUsernameChanged = computed(() => username.value !== props.initialUsername)
const canSaveProfile = computed(() => isUsernameValid.value && hasUsernameChanged.value && !profileSaving.value)

watch(username, (val) => {
  usernameError.value = ''
  if (val) {
    let norm = val.replace(/[^A-Za-z0-9_]/g, '')
    if (norm.length > 0) {
      norm = norm.charAt(0) + norm.slice(1).toLowerCase()
    }
    if (norm !== val) {
      username.value = norm
    }
  }
})

async function handleSaveUsername() {
  if (!canSaveProfile.value) return
  
  usernameChecking.value = true
  usernameError.value = ''
  
  try {
    const session = await fetchAuthSession()
    const idToken = session?.tokens?.idToken?.toString()
    if (!idToken) throw new Error('Not authenticated')
    
    // 1. Availability check
    const resCheck = await fetch(`${API.CHECK_USERNAME}?username=${username.value}`, {
      headers: { Authorization: `Bearer ${idToken}` }
    })
    const dataCheck = await resCheck.json()
    
    if (!dataCheck.available) {
      usernameError.value = 'Username already taken'
      usernameChecking.value = false
      return
    }
    
    // 2. Save profile
    profileSaving.value = true
    const resSave = await fetch(API.PROFILE, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}` 
      },
      body: JSON.stringify({ username: username.value })
    })
    const dataSave = await resSave.json()
    
    if (resSave.ok) {
      globalUsername.value = username.value
      cache.remove('user_profile', CacheType.Persisted)
      emit('success', username.value)
    } else {
      usernameError.value = dataSave.error || 'Failed to save profile'
    }
  } catch (err) {
    usernameError.value = 'Error processing request'
  } finally {
    usernameChecking.value = false
    profileSaving.value = false
  }
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-col sm:flex-row gap-2">
      <div class="relative flex-1 min-w-0">
        <input
          id="username"
          v-model="username"
          type="text"
          maxlength="15"
          class="form-input w-full pr-10"
          :class="{ 'border-red-400': username && !isUsernameValid }"
          placeholder="username"
          @keyup.enter="handleSaveUsername"
        />
      </div>
      <div class="flex gap-2 shrink-0 justify-center sm:justify-start">
        <button
          v-if="!(usernameChecking || profileSaving)"
          type="button"
          @click="handleSaveUsername"
          :disabled="!canSaveProfile"
          class="btn-common-button px-4 py-2 w-23 shrink-0 disabled:opacity-100"
        >
          <span>{{ isEdit ? 'Save' : 'Create' }}</span>
        </button>
        <div v-else class="flex items-center px-4">
          <span class="dots-loader" role="img" aria-label="Saving">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </span>
        </div>
      </div>
    </div>
    <div class="min-h-[1.25rem]">
      <p v-if="username && !isUsernameValid" class="text-xs text-red-300">
        Must be 1-15 chars, start with a letter (rest can be a-z, 0-9, _)
      </p>
      <p v-else-if="usernameError" class="text-xs text-red-300">{{ usernameError }}</p>
      <p v-else class="text-xs text-indigo-200/60">Choose a unique name for playing in leaderboards</p>
    </div>
  </div>
</template>
