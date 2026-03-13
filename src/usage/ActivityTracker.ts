// src/usage/ActivityTracker.ts
// Lightweight client-side activity tracker with localStorage buffering and batched sync
// Usage:
//   import { ActivityTracker } from '@/usage/ActivityTracker'
//   ActivityTracker.init()
//   ActivityTracker.record('validate_word', { wordLen: 4, ok: true })
//   ActivityTracker.flush('manual')

import { fetchAuthSession } from 'aws-amplify/auth'
import { uploadData } from 'aws-amplify/storage'
import { Bucket } from '@/config/api'

const USAGE_ENABLED = (() => {
  try {
    const v = (import.meta as any).env?.VITE_USAGE_ENABLED
    if (v == null) return true // default ON unless explicitly disabled
    const s = String(v).toLowerCase().trim()
    return !(s === '0' || s === 'false' || s === 'off' || s === 'no')
  } catch (_) { return true }
})()

const DEBUG_LOG = (() => {
  try {
    const v = (import.meta as any).env?.VITE_USAGE_DEBUG_LOG
    if (v == null) return false
    const s = String(v).toLowerCase().trim()
    return (s === '1' || s === 'true' || s === 'on' || s === 'yes')
  } catch (_) { return false }
})()

const ANALYTICS_REGION = (() => {
  try {
    const v = (import.meta as any).env?.VITE_MARGANA_ANALYTICS_REGION
    return (v && String(v).trim()) || 'eu-west-2'
  } catch (_) { return 'eu-west-2' }
})()

// Enable writing to BOTH legacy (key=value) and new (segment) layouts during migration
const DUAL_WRITE = (() => {
  try {
    const v = (import.meta as any).env?.VITE_USAGE_DUAL_WRITE
    if (v == null) return false
    const s = String(v).toLowerCase().trim()
    return (s === '1' || s === 'true' || s === 'on' || s === 'yes')
  } catch (_) { return false }
})()

export type ActivityEventName =
  | 'page_view'
  | 'route_change'
  | 'validate_word'
  | 'submit_puzzle'
  | 'open_groups'
  | 'open_group_day'
  | 'played_status'
  | 'compare_view'
  | 'typing_agg'
  | 'highlight_agg'
  | 'shuffle_agg'
  | 'letter_input'
  | 'login'
  | 'logout'
  | 'custom'

export type ActivityEvent = {
  n: ActivityEventName | string // name
  t: number // epoch ms
  d?: Record<string, unknown> // data (small!)
  seq?: number // per-session event sequence
  event_id?: string // uuid
}

export type DayEnvelope = {
  day: string // YYYY-MM-DD (local time)
  session_id: string
  first_seen: number
  last_seen: number
  tz: string
  ua: string // user agent hash or string
  app_ver?: string
  user_sub?: string
  cognito_identity_id?: string
  guest_id?: string
  counts: Record<string, number>
  events: ActivityEvent[]
  seq: number // monotonically increasing per flush attempt
}

function todayISO(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function uuidv4(): string {
  if (crypto?.randomUUID) return crypto.randomUUID()
  // Fallback
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0'))
  return `${hex[0]}${hex[1]}${hex[2]}${hex[3]}-${hex[4]}${hex[5]}-${hex[6]}${hex[7]}-${hex[8]}${hex[9]}-${hex[10]}${hex[11]}${hex[12]}${hex[13]}${hex[14]}${hex[15]}`
}

function storageKey(day = todayISO()): string { return `margana.usage.${day}` }

function safeParse<T = any>(raw: string | null): T | null { try { return raw ? JSON.parse(raw) as T : null } catch { return null } }
function safeSet(key: string, obj: any) { try { localStorage.setItem(key, JSON.stringify(obj)) } catch (_) {} }
function safeGet<T = any>(key: string): T | null { try { return safeParse<T>(localStorage.getItem(key)) } catch { return null } }
function safeRemove(key: string) { try { localStorage.removeItem(key) } catch {} }

// Read retention days from env with sane defaults
function readRetentionDays(): number {
  try {
    const v = (import.meta as any).env?.VITE_USAGE_RETENTION_DAYS
    if (v == null) return 30
    const n = Number(v)
    if (!Number.isFinite(n)) return 30
    // clamp to 1..365 to prevent pathological values
    return Math.max(1, Math.min(365, Math.floor(n)))
  } catch (_) { return 30 }
}

const DEFAULTS = {
  maxEventsPerDay: 500,
  batchSize: 20,
  debounceMs: 30000, // 30s after last event
  hardIntervalMs: 2 * 60 * 1000, // 2 minutes
  retentionDays: readRetentionDays(),
  backoffBaseMs: 2000, // 2s
  backoffMaxMs: 60_000, // 60s
}

let userSub: string | undefined
let cognitoIdentityId: string | undefined
let lastFlushAt = 0
let flushTimer: number | undefined
let hardTimer: number | undefined
let heartbeatTimer: number | undefined
let backoffMs = 0
let stopped = false
let sessionSeq = 0

function uaString(): string {
  try { return navigator.userAgent || '' } catch { return '' }
}

function tzString(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || '' } catch { return '' }
}

// ---- Enrichment helpers & constants ----
const SCHEMA_VERSION = '1.2.0'
const LIB_VERSION = 'web-0.10.1'
const SOURCE = 'web'

function getOrCreateDeviceId(): string {
  try {
    const key = 'margana.usage.deviceId'
    let v = localStorage.getItem(key)
    if (!v) { v = uuidv4(); localStorage.setItem(key, v) }
    return v
  } catch (_) { return uuidv4() }
}

function getGuestId(): string | undefined {
  try {
    return localStorage.getItem('margana.guest_id') || undefined
  } catch (_) { return undefined }
}

function getOrCreateSessionId(): string {
  try {
    const key = 'margana.usage.sessionId'
    let v = sessionStorage.getItem(key)
    if (!v) { v = uuidv4(); sessionStorage.setItem(key, v) }
    return v
  } catch (_) { return uuidv4() }
}

function viewportSize() {
  try { return { viewport_w: window.innerWidth, viewport_h: window.innerHeight } } catch { return {} as any }
}

function languagePref() {
  try { return (navigator.languages && (navigator.languages as any)[0]) || (navigator as any).language } catch { return undefined }
}

function darkModePref() {
  try { return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) } catch { return undefined }
}

function userAgentString() {
  try { return (navigator as any).userAgent } catch { return undefined }
}

function detectDevice() {
  const vs: any = viewportSize()
  return {
    device_type: 'desktop',
    os: undefined as string | undefined,
    os_version: undefined as string | undefined,
    browser: undefined as string | undefined,
    browser_version: undefined as string | undefined,
    viewport_w: vs.viewport_w,
    viewport_h: vs.viewport_h,
    language: languagePref(),
    dark_mode: darkModePref(),
  }
}

function readAttribution() {
  try {
    const url = new URL(window.location.href)
    const params = url.searchParams
    const gclid = params.get('gclid')
    const fbclid = params.get('fbclid')
    return {
      referrer_url: document.referrer || undefined,
      referrer_domain: (() => { try { return new URL(document.referrer).hostname } catch { return undefined } })(),
      utm_source: params.get('utm_source'),
      utm_medium: params.get('utm_medium'),
      utm_campaign: params.get('utm_campaign'),
      utm_term: params.get('utm_term'),
      utm_content: params.get('utm_content'),
      gclid, fbclid,
    }
  } catch { return {} }
}

function readConsent() {
  let dnt: boolean | undefined
  try {
    const d: any = (navigator as any).doNotTrack || (window as any).doNotTrack || (navigator as any).msDoNotTrack
    dnt = (d === '1' || d === 1) ? true : (d === '0' || d === 0) ? false : undefined
  } catch {}
  return {
    string: undefined as string | undefined,
    purposes: { storage: true, measurement: true },
    do_not_track: dnt,
  }
}
// ----------------------------------------

function loadEnvelope(day = todayISO()): DayEnvelope {
  const key = storageKey(day)
  const env = safeGet<DayEnvelope>(key)
  if (env && env.day === day && env.session_id) return env
  const now = Date.now()
  const fresh: DayEnvelope = {
    day,
    session_id: getOrCreateSessionId(),
    first_seen: now,
    last_seen: now,
    tz: tzString(),
    ua: uaString(),
    app_ver: (import.meta as any).env?.VITE_APP_VERSION || undefined,
    user_sub: userSub,
    cognito_identity_id: cognitoIdentityId,
    guest_id: getGuestId(),
    counts: {},
    events: [],
    seq: 0,
  }
  safeSet(key, fresh)
  return fresh
}

function saveEnvelope(env: DayEnvelope) {
  env.last_seen = Date.now()
  safeSet(storageKey(env.day), env)
}

async function ensureUserSub() {
  if (userSub && cognitoIdentityId) return userSub
  try {
    const session = await fetchAuthSession()
    cognitoIdentityId = session.identityId || undefined
    const idToken = session?.tokens?.idToken?.toString()
    if (idToken) {
      const parts = idToken.split('.')
      if (parts.length >= 2) {
        const b64 = parts[1]
        const pad = '='.repeat((4 - (b64.length % 4)) % 4)
        const jsonStr = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
        const claims = JSON.parse(jsonStr)
        const sub = String(claims?.sub || claims?.['cognito:username'] || '').trim()
        userSub = sub || undefined
      }
    }
  } catch {}
  return userSub
}

async function getAuthHeader(): Promise<Record<string, string>> {
  try {
    const session = await fetchAuthSession()
    const idToken = session?.tokens?.idToken?.toString()
    if (idToken) return { Authorization: `Bearer ${idToken}` }
  } catch {}
  return {}
}

function scheduleFlushSoon() {
  if (stopped) { if (DEBUG_LOG) console.log('[usage] scheduleFlushSoon: skipped (stopped)'); return }
  if (flushTimer) clearTimeout(flushTimer)
  if (DEBUG_LOG) console.log('[usage] scheduleFlushSoon:', { in: DEFAULTS.debounceMs })
  flushTimer = setTimeout(() => {
    if (stopped) { if (DEBUG_LOG) console.log('[usage] debounce timer fired: skipped (stopped)'); return }
    if (DEBUG_LOG) console.log('[usage] debounce timer fired → flush')
    flush('debounce')
  }, DEFAULTS.debounceMs) as unknown as number
}

function scheduleHardFlush() {
  if (hardTimer) clearTimeout(hardTimer)
  if (DEBUG_LOG) console.log('[usage] scheduleHardFlush:', { in: DEFAULTS.hardIntervalMs })
  hardTimer = setTimeout(() => {
    if (DEBUG_LOG) console.log('[usage] hard interval timer fired → flush')
    flush('interval')
  }, DEFAULTS.hardIntervalMs) as unknown as number
}

function startHeartbeat() {
  try {
    if (heartbeatTimer) clearInterval(heartbeatTimer as unknown as number)
  } catch (_) {}
  if (!DEBUG_LOG) return // heartbeat is for verbose visibility only
  if (DEBUG_LOG) console.log('[usage] heartbeat: starting @10s interval')
  heartbeatTimer = setInterval(() => {
    try {
      const env = loadEnvelope()
      const since = Date.now() - (lastFlushAt || 0)
      const countsSize = Object.keys(env.counts || {}).length
      // console.log('[usage] heartbeat', {
      //   day: env.day,
      //   events: env.events.length,
      //   counts: countsSize,
      //   sinceLastFlushMs: since,
      //   backoffMs,
      //   batchSize: DEFAULTS.batchSize,
      //   hardIntervalMs: DEFAULTS.hardIntervalMs,
      // })
      const shouldFlush = (env.events.length >= DEFAULTS.batchSize) || (since > DEFAULTS.hardIntervalMs)
      if (shouldFlush) {
        // console.log('[usage] heartbeat → flush')
        void flush('heartbeat')
      }
    } catch (e) {
      console.warn('[usage] heartbeat error', e)
    }
  }, 10_000) as unknown as number
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms)
    p.then((v) => { clearTimeout(t); resolve(v) }).catch((e) => { clearTimeout(t); reject(e) })
  })
}

async function postBatch(env: DayEnvelope, reason: string): Promise<{ ok: boolean, body?: any, error?: any }> {
  if (!USAGE_ENABLED) { if (DEBUG_LOG) console.info('[usage] disabled via flag'); return { ok: true } }
  const ANALYTICS_BUCKET = (Bucket as any)?.MARGANA_ANALYTICS
  if (!ANALYTICS_BUCKET) { if (DEBUG_LOG) console.warn('[usage] analytics bucket not configured (VITE_MARGANA_ANALYTICS_BUCKET)'); return { ok: true } }
  if (typeof navigator !== 'undefined' && 'onLine' in navigator && !navigator.onLine) { if (DEBUG_LOG) console.info('[usage] offline, skipping upload'); return { ok: false, error: 'offline' } }

  // Guest access check: only upload if authenticated or if Identity Pool is definitely ready
  // To avoid "Credentials should not be empty" noise in guest mode, we skip background uploads for now if no creds.
  try {
    const session = await fetchAuthSession().catch(() => ({ credentials: null }))
    if (!session || !session.credentials) {
      if (DEBUG_LOG) console.info('[usage] skipping upload: no credentials for guest yet')
      return { ok: false, error: 'no_creds' }
    }
  } catch (_) {
    return { ok: false, error: 'session_fail' }
  }

  // Derive partitions from local time (aligns with day envelope) and include hour for finer partitioning
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')

  const cid = (cognitoIdentityId || env.cognito_identity_id || undefined)
  const gid = (env.guest_id || getGuestId())
  const user = (userSub || env.user_sub || gid || cid || 'anon')
  const seqStr = String(env.seq).padStart(5, '0')

  const bodyObj = {
    schema_version: SCHEMA_VERSION,
    lib_version: LIB_VERSION,
    source: SOURCE,

    user_sub: user,
    cognito_identity_id: cid,
    guest_id: env.guest_id || getGuestId(),
    device_id: getOrCreateDeviceId(),
    logged_in: !!(env.user_sub),
    session_id: env.session_id,
    seq: sessionSeq,
    client_ts: Date.now(),

    tz: env.tz,
    ua: env.ua,
    device: detectDevice(),
    attribution: readAttribution(),
    consent: readConsent(),

    events: env.events,

    event_date: env.day,
    hour: hh,
  }
  const json = JSON.stringify(bodyObj)

  // Compression disabled per request: always upload plain JSON for reliability and zero UX impact.
  async function gzipOrUint8(str: string): Promise<{ data: Uint8Array, encoding?: string }> {
    if (DEBUG_LOG) console.log('[usage] compress:disabled (always plain JSON)')
    return { data: new TextEncoder().encode(str), encoding: undefined }
  }

  if (DEBUG_LOG) console.log('[usage] build: payload bytes', { bytes: json.length })
  const { data, encoding } = await gzipOrUint8(json)

  const pathKv = `public/usage/year=${yyyy}/month=${mm}/day=${dd}/hour=${hh}/user_sub=${user}/session_id=${env.session_id}/seq=${seqStr}.json${encoding === 'gzip' ? '.gz' : ''}`
  const pathSeg = `public/usage/year=${yyyy}/month=${mm}/day=${dd}/hour=${hh}/user_sub/${user}/session_id/${env.session_id}/${seqStr}.json${encoding === 'gzip' ? '.gz' : ''}`

  const LAYOUT = (() => { try { const v = (import.meta as any).env?.VITE_USAGE_LAYOUT; const s = (v || '').toString().toLowerCase(); return s === 'segment' ? 'segment' : 'keyvalue' } catch { return 'keyvalue' } })()
  const primaryPath = LAYOUT === 'segment' ? pathSeg : pathKv
  const secondaryPath = DUAL_WRITE ? (LAYOUT === 'segment' ? pathKv : pathSeg) : null

  if (DEBUG_LOG) console.log('[usage] build: key', { primaryPath, secondaryPath, layout: LAYOUT, dual: DUAL_WRITE })

  try {
    const uploads = [primaryPath, secondaryPath].filter(Boolean) as string[]
    for (const p of uploads) {
      if (DEBUG_LOG) console.info('[usage] uploading batch', { bucket: ANALYTICS_BUCKET, path: p, reason, bytes: data?.byteLength || json.length, events: env.events.length, counts: Object.keys(env.counts).length })
      const startedAt = Date.now()
      const res = await withTimeout(uploadData({
        path: p,
        data,
        options: {
          bucket: { bucketName: ANALYTICS_BUCKET, region: ANALYTICS_REGION },
          contentType: 'application/json',
          contentEncoding: encoding,
          metadata: {
            reason,
            app_ver: (env.app_ver || '') as any,
          },
        },
      }).result, 8000)
      if (DEBUG_LOG) console.info('[usage] upload OK', { path: p, ms: Date.now() - startedAt, res })
    }
    // Snapshot last uploaded batch locally for QA/debug visibility (use primary path)
    try {
      const snapshot = { ...bodyObj, s3_path: primaryPath }
      safeSet('margana.usage.lastUpload', snapshot)
      if (env.day) safeSet(`margana.usage.lastUpload.${env.day}`, snapshot)
    } catch (_) { /* ignore snapshot errors */ }
    return { ok: true, body: bodyObj }
  } catch (e) {
    if (DEBUG_LOG) console.warn('[usage] upload FAILED', e)
    // Failed to upload
    return { ok: false, error: e }
  }
}

async function doFlush(reason: string) {
  if (stopped) { if (DEBUG_LOG) console.log('[usage] doFlush: skipped (stopped)', { reason }); return { ok: true, skipped: true } }
  const day = todayISO()
  const env = loadEnvelope(day)
  if (!env.events.length && Object.keys(env.counts).length === 0) {
    if (DEBUG_LOG) console.info('[usage] doFlush: nothing to upload (empty envelope)')
    return { ok: true, empty: true }
  }
  if (DEBUG_LOG) console.log('[usage] doFlush: preparing upload', { reason, events: env.events.length, counts: Object.keys(env.counts).length, seq: (env.seq || 0) + 1 })
  env.seq = (env.seq || 0) + 1
  const result = await postBatch(env, reason)
  if (DEBUG_LOG) console.log('[usage] doFlush: postBatch result', { ok: result.ok, hasBody: !!result.body, error: result.error ? String(result.error) : null })
  if (result.ok) {
    // Optionally delay clearing after logout to help QA visibility
    let delayMs = 0
    try {
      const v = (import.meta as any).env?.VITE_USAGE_DEBUG_DELAY_CLEAR_MS
      if (v != null) {
        const n = Number(v)
        if (Number.isFinite(n) && n > 0) delayMs = n
      }
    } catch (_) {}
    const clearNow = () => {
      const cleared: DayEnvelope = { ...env, counts: {}, events: [] }
      saveEnvelope(cleared)
      backoffMs = 0
      lastFlushAt = Date.now()
      if (DEBUG_LOG) console.log('[usage] doFlush: cleared envelope and updated lastFlushAt', { lastFlushAt })
    }
    if (reason === 'logout' && delayMs > 0) {
      setTimeout(clearNow, delayMs)
    } else {
      clearNow()
    }
  } else {
    // Backoff for next attempt
    backoffMs = Math.min(backoffMs ? backoffMs * 2 : DEFAULTS.backoffBaseMs, DEFAULTS.backoffMaxMs)
    if (DEBUG_LOG) console.warn('[usage] doFlush: scheduling retry', { backoffMs })
    if (flushTimer) clearTimeout(flushTimer)
    flushTimer = setTimeout(() => flush('retry'), backoffMs) as unknown as number
  }
  return result
}

function pruneOld() {
  try {
    const now = new Date()
    const maxLookbackDays = 400 // hard cap to avoid long loops
    const cutoff = DEFAULTS.retentionDays
    for (let i = cutoff + 1; i < maxLookbackDays; i++) {
      const d = new Date(now)
      d.setDate(now.getDate() - i)
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      const dayStr = `${yyyy}-${mm}-${dd}`
      // Remove old day envelope
      safeRemove(storageKey(dayStr))
      // Remove old per-day last upload snapshot
      safeRemove(`margana.usage.lastUpload.${dayStr}`)
    }
    // Keep the global lastUpload snapshot; it only stores the most recent upload
  } catch {}
}

export const ActivityTracker = {
  async init() {
    if (!USAGE_ENABLED) { if (DEBUG_LOG) console.log('[usage] init: disabled via flag'); return }

    // Expose a tiny debug helper for DevTools IMMEDIATELY
    try {
      ;(window as any).marganaUsage = {
        getEnvelope: (day?: string) => {
          const key = storageKey(day)
          const env = safeGet<DayEnvelope>(key)
          return env ? JSON.parse(JSON.stringify(env)) : null
        },
        getLastUpload: (day?: string) => {
          const key = day ? `margana.usage.lastUpload.${day}` : 'margana.usage.lastUpload'
          const snap = safeGet<any>(key)
          return snap ? JSON.parse(JSON.stringify(snap)) : null
        },
        forceFlush: (reason?: string) => ActivityTracker.flush(reason || 'manual'),
        record: (name: string, data?: Record<string, unknown>) => ActivityTracker.record(name, data),
        // Quick end-to-end probe: records a tiny test event and forces a flush.
        // Returns the latest snapshot so you can see s3_path in DevTools.
        testUpload: async () => {
          try { ActivityTracker.record('custom_test', { probe: 1 }) } catch (_) {}
          try { await doFlush('manual') } catch (_) {}
          const snap = safeGet<any>('margana.usage.lastUpload')
          return snap ? JSON.parse(JSON.stringify(snap)) : null
        },
        // Config probe to reveal effective settings at runtime
        probe: () => {
          const env = loadEnvelope()
          const cid = cognitoIdentityId || env.cognito_identity_id
          const sub = userSub || env.user_sub
          return {
            USAGE_ENABLED,
            DEBUG_LOG,
            online: (typeof navigator !== 'undefined' && 'onLine' in navigator) ? navigator.onLine : undefined,
            userSub: sub || undefined,
            cognitoIdentityId: cid || undefined,
            guestId: getGuestId(),
            deviceId: getOrCreateDeviceId(),
            sessionId: env.session_id,
            effectiveUserSub: sub || getGuestId() || cid || 'anon',
            ANALYTICS_BUCKET: (Bucket as any)?.MARGANA_ANALYTICS || null,
            ANALYTICS_REGION,
          }
        },
      }
    } catch {}

    stopped = false
    sessionSeq = 0
    if (DEBUG_LOG) console.log('[usage] init: starting', { bucket: (Bucket as any)?.MARGANA_ANALYTICS || null, region: ANALYTICS_REGION })
    pruneOld()
    const sub0 = await ensureUserSub()
    if (DEBUG_LOG) console.log('[usage] init: userSub', sub0 || null)
    // Touch envelope for today
    const env = loadEnvelope()
    env.user_sub = userSub
    saveEnvelope(env)
    if (DEBUG_LOG) console.log('[usage] init: envelope ready', { day: env.day, events: env.events.length, counts: Object.keys(env.counts).length })
    scheduleHardFlush()
    startHeartbeat()
    // Attach unload/visibility listeners once
    try {
      window.addEventListener('beforeunload', () => { if (DEBUG_LOG) console.log('[usage] beforeunload: flushing'); void doFlush('beforeunload') })
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') { if (DEBUG_LOG) console.log('[usage] visibilitychange:hidden: flushing'); void doFlush('hidden') }
      })
    } catch {}
  },

  setUser(sub?: string) {
    userSub = sub || undefined
    // Update the current envelope immediately to prevent stale identity persistence
    try {
      const env = loadEnvelope()
      env.user_sub = userSub
      saveEnvelope(env)
    } catch (_) {}
  },

  // Record a small activity event and bump counters. Auto-schedules a debounced flush.
  record(name: ActivityEventName | string, data?: Record<string, unknown>) {
    if (!USAGE_ENABLED) return
    const env = loadEnvelope()
    const now = Date.now()
    env.user_sub = userSub || env.user_sub
    env.cognito_identity_id = cognitoIdentityId || env.cognito_identity_id
    env.guest_id = getGuestId() || env.guest_id
    env.last_seen = now
    const key = String(name)
    env.counts[key] = (env.counts[key] || 0) + 1
    if (env.events.length < DEFAULTS.maxEventsPerDay) {
      const evtSeq = ++sessionSeq
      const evt: ActivityEvent = { n: key, t: now, d: compactData(data), seq: evtSeq, event_id: uuidv4() }
      env.events.push(evt)
    } else {
      // If event cap reached, we still increment counts but avoid growing events[] further
    }
    saveEnvelope(env)

    // Flush triggers
    const overBatch = env.events.length >= DEFAULTS.batchSize
    const overTime = Date.now() - lastFlushAt > DEFAULTS.hardIntervalMs
    if (overBatch || overTime) {
      void flush('threshold')
    } else {
      scheduleFlushSoon()
    }
  },

  async flush(reason: string = 'manual') { if (!USAGE_ENABLED || stopped) return; await flush(reason) },

  stop() {
    try {
      stopped = true
      if (DEBUG_LOG) console.log('[usage] stop: tracking stopped (post-logout)')
      if (flushTimer) clearTimeout(flushTimer)
      if (hardTimer) clearTimeout(hardTimer)
      if (heartbeatTimer) clearInterval(heartbeatTimer as unknown as number)
    } catch (_) { /* ignore */ }
  },

  // Debug helpers (also available via window.marganaUsage)
  getEnvelope(day?: string) {
    const key = storageKey(day)
    return safeGet<DayEnvelope>(key)
  },
  getLastUpload(day?: string) {
    const key = day ? `margana.usage.lastUpload.${day}` : 'margana.usage.lastUpload'
    return safeGet<any>(key)
  },
}

function compactData(input?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!input) return undefined
  const out: Record<string, unknown> = {}
  const entries = Object.entries(input)
  for (const [k, v] of entries) {
    if (v == null) continue
    if (typeof v === 'string' && v.length > 128) { out[k] = v.slice(0, 128) + '…'; continue }
    out[k] = v
  }
  return Object.keys(out).length ? out : undefined
}

async function flush(reason: string) {
  await doFlush(reason)
}

export default ActivityTracker
