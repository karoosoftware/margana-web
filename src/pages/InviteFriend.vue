<script setup>
import { ref } from 'vue'
import { fetchAuthSession } from 'aws-amplify/auth'
import { API } from '@/config/api'
import AppCard from '@/components/AppCard.vue'

const email = ref('')
const submitting = ref(false)
const error = ref('')
const success = ref('')

function isValidEmail(v) {
  if (!v) return false
  const s = String(v).trim()
  // Simple pragmatic email regex
  return /.+@.+\..+/.test(s)
}

async function onSubmit() {
  error.value = ''
  success.value = ''
  const e = email.value.trim()
  if (!isValidEmail(e)) {
    error.value = 'Please enter a valid email address.'
    return
  }
  submitting.value = true
  try {
    const session = await fetchAuthSession()
    const idToken = session?.tokens?.idToken?.toString()
    if (!idToken) throw new Error('You are not authenticated. Please sign in again.')

    const res = await fetch(API.MARGANA_SEND_FRIEND_INVITE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ email: e })
    })

    const text = await res.text()
    let data = null
    try { data = JSON.parse(text) } catch { data = { message: text } }

    if (!res.ok) {
      const msg = data?.error || data?.message || `Request failed (${res.status}).`
      throw new Error(msg)
    }

    success.value = data?.message || 'Invitation sent!'
    email.value = ''
  } catch (err) {
    error.value = err?.message || String(err)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="flex flex-col items-center justify-center min-h-full p-4">
    <div class="w-full max-w-2xl mx-auto px-3 sm:px-4">
      <AppCard title="Invite a player">
        <div class="space-y-4">
          <p class="text-indigo-100 text-sm">
            Invite a player to play Margana. We'll send them an email with your invite
          </p>

          <div class="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-end">
            <div>
              <label for="invite-email" class="block text-indigo-100 text-sm mb-1">Player's email</label>
              <input id="invite-email" type="email" v-model="email" placeholder="name@example.com"
                     class="w-full px-3 py-2 rounded-lg bg-white/10 text-white placeholder-indigo-200/60 border border-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                     :disabled="submitting" />
            </div>
            <div>
              <button type="button" @click="onSubmit" :disabled="submitting || !isValidEmail(email)"
                      class="w-full sm:w-auto px-4 py-2 rounded-lg font-semibold text-white bg-gradient-to-tr from-indigo-500 via-purple-600 to-violet-700 hover:from-indigo-400 hover:via-purple-500 hover:to-violet-600 disabled:opacity-50 disabled:cursor-not-allowed shadow">
                {{ submitting ? 'Sending…' : 'Send invite' }}
              </button>
            </div>
          </div>

          <div v-if="error" class="text-red-300 text-sm">{{ error }}</div>
          <div v-if="success" class="text-green-300 text-sm">{{ success }}</div>

        </div>
      </AppCard>
    </div>
  </div>
</template>

<style scoped>
</style>
