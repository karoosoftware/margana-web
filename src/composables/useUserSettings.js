// src/composables/useUserSettings.js
import { ref, computed } from 'vue'
import { getUserSettings, updateUserSettings } from '@/services/userSettingsApi'
import { useMarganaAuth, UserTier } from './useMarganaAuth'

const DEFAULTS = Object.freeze({
  enable_wildcard_bypass: true,
  enable_live_scoring: true,
  show_pulse_labels: true,
  show_anagram_popup: true,
  show_tutorial_button: true,
})

// No staleness window for now — we always refresh from the backend when loadSettings() is called.

// Singleton module state
const settings = ref({ ...DEFAULTS })
const version = ref(0)
const loaded = ref(false)
const loading = ref(false)
const lastSyncAt = ref(0)
const updateBusy = ref(false)
// Track which single key is being updated (when patch contains exactly one key)
const updateBusyKey = ref('')
const currentSub = ref('')

function hasLocalStorage() {
  try {
    return typeof localStorage !== 'undefined' && localStorage !== null
  } catch {
    return false
  }
}

async function resolveSub() {
  const { fetchUser, isAuthenticated, initialized, userSub } = useMarganaAuth()
  
  if (!initialized.value) await fetchUser()
  
  if (isAuthenticated.value && userSub.value) {
    currentSub.value = String(userSub.value)
    return currentSub.value
  }
  
  currentSub.value = 'anonymous'
  return currentSub.value
}

function storageKey(sub) {
  return `margana.userSettings.${sub || 'anonymous'}`
}

function applyServer(data) {
  try {
    const s = data?.user_settings || data || {}
    const next = {
      enable_wildcard_bypass: !!(s.enable_wildcard_bypass ?? DEFAULTS.enable_wildcard_bypass),
      enable_live_scoring: !!(s.enable_live_scoring ?? DEFAULTS.enable_live_scoring),
      show_pulse_labels: !!(s.show_pulse_labels ?? DEFAULTS.show_pulse_labels),
      show_anagram_popup: !!(s.show_anagram_popup ?? DEFAULTS.show_anagram_popup),
      show_tutorial_button: !!(s.show_tutorial_button ?? DEFAULTS.show_tutorial_button),
    }
    settings.value = next
    version.value = Number(s.version ?? 0) || 0
    lastSyncAt.value = Date.now()
    // Persist to localStorage
    if (hasLocalStorage()) {
      const sub = currentSub.value || 'anonymous'
      const cache = { settings: next, version: version.value, ts: lastSyncAt.value }
      try { localStorage.setItem(storageKey(sub), JSON.stringify(cache)) } catch {}
    }
    loaded.value = true
  } catch (_) {
    // Keep previous state on error
  }
}

async function loadSettings(opts = {}) {
  const force = !!opts.force
  await resolveSub()
  const sub = currentSub.value
  const isAnonymous = !sub || sub === 'anonymous'

  // Try localStorage first
  if (!force && hasLocalStorage()) {
    try {
      const raw = localStorage.getItem(storageKey(sub))
      if (raw) {
        const cached = JSON.parse(raw)
        if (cached && cached.settings) {
          settings.value = { ...DEFAULTS, ...cached.settings }
          version.value = Number(cached.version || 0) || 0
          lastSyncAt.value = Number(cached.ts || 0) || 0
          loaded.value = true
        }
      }
    } catch {}
  }

  if (loading.value) return
  // Always refresh from server on every call (router hook and Margana.vue call ensure one GET; the
  // loading flag prevents duplicate concurrent requests).
  
  if (isAnonymous) {
    // For anonymous users, we don't fetch from the backend.
    // We already have DEFAULTS or cached localStorage.
    loaded.value = true
    return
  }

  loading.value = true
  try {
    const res = await getUserSettings()
    applyServer(res)
  } catch (_) {
    // On failure, keep cached/defaults; do not throw
  } finally {
    loading.value = false
  }
}

function resetSettings() {
  settings.value = { ...DEFAULTS }
  version.value = 0
  loaded.value = false
  loading.value = false
  lastSyncAt.value = 0
  updateBusy.value = false
  updateBusyKey.value = ''
  currentSub.value = ''
}

let updateQueue = Promise.resolve()

async function updateSettingsPatch(patch) {
  if (!patch || typeof patch !== 'object') return
  await resolveSub()
  const sub = currentSub.value
  const isAnonymous = !sub || sub === 'anonymous'

  if (isAnonymous) {
    // For anonymous users, we only update locally and in localStorage
    settings.value = { ...settings.value, ...patch }
    if (hasLocalStorage()) {
      const cache = { settings: settings.value, version: version.value, ts: Date.now() }
      try { localStorage.setItem(storageKey(sub), JSON.stringify(cache)) } catch {}
    }
    return
  }

  // Chain to the sequential queue to prevent version conflicts from overlapping requests
  const task = updateQueue.then(async () => {
    updateBusy.value = true
    try {
      const keys = Object.keys(patch || {})
      updateBusyKey.value = keys.length === 1 ? String(keys[0]) : ''
      
      // We read version.value INSIDE the task to ensure we have the latest version 
      // from any preceding updates in the queue.
      const res = await updateUserSettings(patch, version.value)
      applyServer(res)
    } catch (e) {
      // Re-throw so the caller (computed setter) can handle it
      throw e
    } finally {
      updateBusy.value = false
      updateBusyKey.value = ''
    }
  })

  // Ensure the queue continues even if one update fails
  updateQueue = task.catch(() => {})
  
  return task
}

export function useUserSettings() {
  const { userTier } = useMarganaAuth()

  const enableWildcardBypass = computed({
    get: () => {
      if (userTier.value === UserTier.GUEST) return true
      return !!settings.value.enable_wildcard_bypass
    },
    set: async (v) => {
      if (userTier.value === UserTier.GUEST) return
      const next = !!v
      settings.value = { ...settings.value, enable_wildcard_bypass: next }
      try { await updateSettingsPatch({ enable_wildcard_bypass: next }) } catch {
        settings.value = { ...settings.value, enable_wildcard_bypass: !next }
      }
    },
  })

  const enableLiveScoring = computed({
    get: () => {
      if (userTier.value === UserTier.GUEST) return true
      return !!settings.value.enable_live_scoring
    },
    set: async (v) => {
      if (userTier.value === UserTier.GUEST) return
      const next = !!v
      settings.value = { ...settings.value, enable_live_scoring: next }
      try { await updateSettingsPatch({ enable_live_scoring: next }) } catch {
        settings.value = { ...settings.value, enable_live_scoring: !next }
      }
    },
  })

  const showPulseLabels = computed({
    get: () => {
      if (userTier.value === UserTier.GUEST) return true
      return !!settings.value.show_pulse_labels
    },
    set: async (v) => {
      if (userTier.value === UserTier.GUEST) return
      const next = !!v
      settings.value = { ...settings.value, show_pulse_labels: next }
      try { await updateSettingsPatch({ show_pulse_labels: next }) } catch {
        settings.value = { ...settings.value, show_pulse_labels: !next }
      }
    },
  })

  const showAnagramPopup = computed({
    get: () => {
      if (userTier.value === UserTier.GUEST) return true
      return !!settings.value.show_anagram_popup
    },
    set: async (v) => {
      if (userTier.value === UserTier.GUEST) return
      const next = !!v
      settings.value = { ...settings.value, show_anagram_popup: next }
      try { await updateSettingsPatch({ show_anagram_popup: next }) } catch {
        settings.value = { ...settings.value, show_anagram_popup: !next }
      }
    },
  })

  const showTutorialButton = computed({
    get: () => {
      if (userTier.value === UserTier.GUEST) return true
      return !!settings.value.show_tutorial_button
    },
    set: async (v) => {
      if (userTier.value === UserTier.GUEST) return
      const next = !!v
      settings.value = { ...settings.value, show_tutorial_button: next }
      try { await updateSettingsPatch({ show_tutorial_button: next }) } catch {
        settings.value = { ...settings.value, show_tutorial_button: !next }
      }
    },
  })

  return {
    // state
    settings,
    version,
    loaded,
    loading,
    lastSyncAt,
    updateBusy,
    updateBusyKey,
    currentSub,
    // derived
    enableWildcardBypass,
    enableLiveScoring,
    showPulseLabels,
    showAnagramPopup,
    showTutorialButton,
    // methods
    loadSettings,
    applyServer,
    resetSettings,
    updateSettings: updateSettingsPatch,
  }
}
