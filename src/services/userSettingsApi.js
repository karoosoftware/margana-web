// src/services/userSettingsApi.js
import { fetchAuthSession } from 'aws-amplify/auth'
import { API } from '@/config/api'

export async function getUserSettings() {
  const url = API.USER_SETTINGS
  if (!url) throw new Error('USER_SETTINGS endpoint not configured')
  let headers = { 'Content-Type': 'application/json' }
  try {
    const session = await fetchAuthSession()
    const idToken = session.tokens?.idToken?.toString()
    if (idToken) headers = { ...headers, Authorization: `Bearer ${idToken}` }
  } catch (_) {
    /* unauthenticated should be blocked by API */
  }
  const res = await fetch(url, { method: 'GET', headers })
  const text = await res.text().catch(() => '')
  const body = (() => { try { return JSON.parse(text) } catch { return {} } })()
  if (!res.ok) {
    const msg = typeof body === 'object' && body && body.message ? body.message : text
    throw new Error(msg || `Failed to fetch settings (${res.status})`)
  }
  return body
}

export async function updateUserSettings(patch, ifVersion) {
  const url = API.USER_SETTINGS
  if (!url) throw new Error('USER_SETTINGS endpoint not configured')
  let headers = { 'Content-Type': 'application/json' }
  try {
    const session = await fetchAuthSession()
    const idToken = session.tokens?.idToken?.toString()
    if (idToken) headers = { ...headers, Authorization: `Bearer ${idToken}` }
  } catch (_) {}
  const payload = { settings: { ...(patch || {}) } }
  if (typeof ifVersion === 'number') payload.ifVersion = ifVersion
  const res = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(payload) })
  const text = await res.text().catch(() => '')
  const body = (() => { try { return JSON.parse(text) } catch { return {} } })()
  if (!res.ok) {
    const msg = typeof body === 'object' && body && body.message ? body.message : text
    throw new Error(msg || `Failed to update settings (${res.status})`)
  }
  return body
}
