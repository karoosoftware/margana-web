import { createRouter, createWebHistory } from 'vue-router'
import { getCurrentUser } from 'aws-amplify/auth'

const LoginPage = () => import('./pages/LoginPage.vue')
const LandingPage = () => import('./pages/LandingPage.vue')
const MarganaPage = () => import('./pages/Margana.vue')
const TutorialPage = () => import('./pages/TutorialPage.vue')
const YesterdayPage = () => import('./pages/YesterdayPage.vue')
const LeaderboardDetailPage = () => import('./pages/LeaderboardDetail.vue')
const LeaderboardPage = () => import('./pages/LeaderboardPage.vue')
const InviteFriendPage = () => import('./pages/InviteFriend.vue')
const MetricDashboardPage = () => import('./pages/MetricDashboard.vue')
const SettingsPage = () => import('./pages/Settings.vue')

// Track whether we've already performed a first-login settings fetch in this SPA session
let didFetchAfterLogin = false
// Central allow-list of route names that should always trigger a settings fetch when entered
// Extendable: add more route names as needed, e.g., settings-related pages
const SETTINGS_FETCH_ROUTES = new Set(['settings'])

async function isAuthenticated() {
  try {
    await getCurrentUser()
    return true
  } catch (_) {
    return false
  }
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'landing', component: LandingPage, meta: { public: true, hideNav: true } },
    { path: '/login', name: 'login', component: LoginPage, meta: { public: true, hideNav: true  } },
    { path: '/margana', name: 'margana', component: MarganaPage, meta: { public: true } },
    { path: '/tutorial', name: 'tutorial', component: TutorialPage, meta: { public: true } },
    { path: '/yesterday', name: 'yesterday', component: YesterdayPage, meta: { requiresAuth: true, internalOnly: true } },
    { path: '/leaderboards', name: 'leaderboards', component: LeaderboardPage, meta: { requiresAuth: true } },
    { path: '/leaderboards/:id', name: 'leaderboard-detail', component: LeaderboardDetailPage, meta: { requiresAuth: true } },
    { path: '/invite-friend', name: 'invite-friend', component: InviteFriendPage, meta: { requiresAuth: true } },
    { path: '/metric', name: 'metric', component: MetricDashboardPage, meta: { public: true } },
    { path: '/settings', name: 'settings', component: SettingsPage, meta: { public: true } },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach(async (to, from) => {

  // 1. Handle internal-only routes (existing logic)
  if (to.meta?.internalOnly && !from.name) {
    // Redirect to the main game
    return { name: 'margana' }
  }

  // Optimize: Fetch auth status once for the whole guard
  const ok = await isAuthenticated()

  // 2. Guest "Front Door" Logic
  // If guest entering from outside via URL/Refresh, and not going to landing
  if (!ok && !from.name && to.name !== 'landing') {
    try {
      const today = new Date().toISOString().split('T')[0]

      const hasPlayedToday = !!localStorage.getItem(`margana.result.${today}`)
      const hasStartedToPlay = !!localStorage.getItem(`margana:puzzle:${today}:v3`)

      // If no activity found for today, force them to the Landing Page
      if (!hasPlayedToday && !hasStartedToPlay) {
        return { name: 'landing' }
      }
    } catch (e) {
      // Fallback for restricted storage (e.g. some private modes)
      // In this case, we default to the landing page for safety
      return { name: 'landing' }
    }
  }

  // 3. Authenticated Route Protection
  if (to.meta?.requiresAuth) {
    if (!ok) {
      return { name: 'landing', query: { redirect: to.fullPath } }
    }
    // Trigger a settings fetch on first post-login authed navigation, and on specific routes
    const shouldFetch = (!didFetchAfterLogin) || SETTINGS_FETCH_ROUTES.has(String(to.name || ''))
    if (shouldFetch) {
      try {
        const mod = await import('./composables/useUserSettings.js')
        const { useUserSettings } = mod
        const store = useUserSettings()
        // fire-and-forget; composable prevents duplicate concurrent requests
        store.loadSettings()
      } catch (_) { /* ignore */ }
      didFetchAfterLogin = true
    }
  }

  // 4. Authenticated User Redirection (Landing/Login)
  if (to.name === 'login' || to.name === 'landing') {
    if (ok) {
      return { name: 'margana' }
    }
  }

  return true
})

export default router
