import "./polyfills";
import { createApp } from "vue";
import './style.css'
import App from "./App.vue";
import router from './router'
import { Amplify } from "aws-amplify";
import { signOut } from 'aws-amplify/auth'
import { MyAmplify, Bucket } from './config/api.js'
import { ActivityTracker } from '@/usage/ActivityTracker'
// 👇 Debug logs — safe during dev, remove in prod
// console.log('Vite mode:', import.meta.env.MODE)

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: MyAmplify.USER_POOL_ID,
      userPoolClientId: MyAmplify.USER_POOL_CLIENT_ID,
      identityPoolId: MyAmplify.IDENTITY_POOL_ID,
      allowGuestAccess: true,
    },
  },
  Storage: {
    S3: {
      bucket: Bucket.MARGANA_WORD_GAME, // default bucket
      region: "eu-west-2",
    }
  },
  API: {
    REST: {
      MarganaApi: {
        endpoint: MyAmplify.GATEWAY || "",
        region: "eu-west-2"
      }
    }
  }
}, {
  API: {
    REST: {
      headers: async () => {
        return { 'Content-Type': 'application/json' };
      }
    }
  }
});

// createApp(App).use(router).mount("#app");

// Global fetch wrapper to handle expired/invalid login tokens centrally
(function installAuthFetchGuard() {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return
  const originalFetch = window.fetch.bind(window)
  let redirecting = false

  // Helpers
  const toUrl = (input) => {
    try {
      if (typeof input === 'string') return new URL(input, window.location.href)
      if (input && typeof input.url === 'string') return new URL(input.url, window.location.href)
      if (input instanceof URL) return input
    } catch (_) {}
    return null
  }
  const isS3Host = (host) => {
    if (!host) return false
    const h = host.toLowerCase()
    return h.includes('.s3.') || h.includes('.s3-')
  }
  const isAuthProtectedRequest = (urlObj) => {
    if (!urlObj) return true // assume protected if unknown
    const host = urlObj.host
    // S3 signed URLs often return 403 when the object doesn't exist; this is not an auth failure
    if (isS3Host(host)) return false
    // Same-origin API or other backends are considered auth-protected
    return true
  }

  window.fetch = async (input, init) => {
    const reqUrl = toUrl(input)
    const res = await originalFetch(input, init)
    try {
      // Fast path on HTTP status — only for auth-protected requests (exclude S3)
      // Only treat 401 as an auth failure. A 403 may be a legitimate authorization denial (e.g., no group membership),
      // so do not auto-redirect on 403 unless the response body contains a token error message.
      if (res.status === 401 && isAuthProtectedRequest(reqUrl)) {
        throw new Error('auth')
      }

      // Inspect body for specific backend message without consuming original stream
      const contentType = res.headers.get('content-type') || ''
      const lc = (s) => (typeof s === 'string' ? s.toLowerCase() : '')
      if (contentType.includes('application/json')) {
        const copy = res.clone()
        const data = await copy.json().catch(() => null)
        const msg = lc(data?.message || data?.error || '')
        if (msg.includes("couldn't verify signed token") || msg.includes('invalid login token')) throw new Error('auth')
      } else {
        const copy = res.clone()
        const text = lc(await copy.text().catch(() => ''))
        if (text.includes("couldn't verify signed token") || text.includes('invalid login token')) throw new Error('auth')
      }
    } catch (_) {
      if (!redirecting) {
        redirecting = true
        // Best-effort: clear Amplify session so user re-auths cleanly
        Promise.resolve()
          .then(() => {
            try {
              ActivityTracker.record('logout', { reason: 'auth_guard' })
              const timeoutMs = 1500
              return Promise.race([
                ActivityTracker.flush('logout').catch(() => {}),
                new Promise((resolve) => setTimeout(resolve, timeoutMs))
              ])
            } catch (_) { return undefined }
          })
          .then(() => {
            try {
              ActivityTracker.setUser(undefined)
              ActivityTracker.stop()
            } catch (_) {}
            return signOut({ global: true })
          }).catch(() => {})
          .finally(() => {
            const current = router.currentRoute?.value
            const isPublic = current?.meta?.public === true
            const redirect = current?.fullPath && current.name !== 'login' ? { redirect: current.fullPath } : {}
            if (!isPublic) {
              router.replace({ name: 'landing', query: redirect }).finally(() => { redirecting = false })
            } else {
              redirecting = false
            }
          })
      }
    }
    return res
  }
})()

const app = createApp(App)
app.use(router)

// ⬅️ Wait for the router before mounting
router.isReady().then(() => {
  app.mount('#app')
})
