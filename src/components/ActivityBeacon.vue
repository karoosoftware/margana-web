<script setup>
import { onMounted, onBeforeUnmount } from 'vue'
import router from '@/router'
import { ActivityTracker } from '@/usage/ActivityTracker'

let removeAfterEach = null
let started = false

// Helper to record page views with consistent metadata
function recordPageView(route, isEntry = false) {
  try {
    if (!started) return
    const pageId = route?.meta?.pageId || route?.name || '(unnamed)'
    const section = route?.meta?.section
    const path = route?.fullPath || ''
    const pathTpl = route?.matched?.[0]?.path || route?.path || path
    const url = (typeof window !== 'undefined') ? window.location.href : ''
    const pub = !!route?.matched?.some(r => r?.meta?.public)
    
    ActivityTracker.record('page_view', {
      page_id: pageId,
      name: route?.name || '',
      section,
      path,
      path_tpl: pathTpl,
      url,
      public: pub,
      entry: isEntry,
    })
  } catch (_) { /* no-op */ }
}

function onCustomUsage(evt) {
  try {
    if (!started) return
    const detail = evt?.detail || {}
    const name = String(detail.name || detail.event || 'custom')
    const data = (detail.data && typeof detail.data === 'object') ? detail.data : undefined
    ActivityTracker.record(name, data)
  } catch (_) { /* no-op */ }
}

function onOnline() { 
  if (!started) return
  ActivityTracker.flush('online').catch(() => {}) 
}

onMounted(async () => {
  // 1. Initialize tracker immediately for ALL routes (Guests and Registered)
  await ActivityTracker.init()
  started = true

  // 2. Record the initial entry page (e.g., landing or direct link to game)
  const initial = router.currentRoute?.value
  if (initial) {
    recordPageView(initial, true)
  }

  // 3. Log all subsequent route changes
  try {
    removeAfterEach = router.afterEach(async (to, from) => {
      // Record the navigation transition
      ActivityTracker.record('route_change', { 
        from: from?.name || '', 
        to: to?.name || '', 
        path: to?.fullPath || '' 
      })
      
      // Record the new page view
      recordPageView(to, false)
    })
  } catch (_) { 
    removeAfterEach = null 
  }

  // Listen for custom app-level usage events (like submit_puzzle)
  try { window.addEventListener('margana-usage', onCustomUsage) } catch (_) {}
  // Trigger a flush when the device comes back online
  try { window.addEventListener('online', onOnline) } catch (_) {}
})

onBeforeUnmount(() => {
  try { if (removeAfterEach) removeAfterEach() } catch (_) {}
  try { window.removeEventListener('margana-usage', onCustomUsage) } catch (_) {}
  try { window.removeEventListener('online', onOnline) } catch (_) {}
})
</script>

<template>
  <!-- invisible helper component -->
  <span style="display:none" aria-hidden="true"></span>
</template>
