import { getUrl } from 'aws-amplify/storage'
import { Bucket } from '@/config/api'

/**
 * Returns yesterday's date in YYYY-MM-DD format (local time).
 */
export function getYesterdayDateISO() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Fetches a user's results for a specific date from S3.
 * Returns null if not found or on error.
 */
export async function fetchUserResults(sub, dateISO) {
  if (!sub || !dateISO) return null
  const [y, m, d] = dateISO.split('-')
  const path = `public/users/${sub}/${y}/${m}/${d}/margana-user-results.json`
  try {
    const { url } = await getUrl({
      path,
      options: { bucket: { bucketName: Bucket.MARGANA_GAME_RESULTS, region: 'eu-west-2' } }
    })
    const res = await fetch(url)
    if (!res.ok) return null
    return await res.json()
  } catch (err) {
    // Missing file is a common case, don't necessarily log as error
    return null
  }
}

/**
 * Checks if a user has results for a specific date.
 */
export async function checkUserPlayed(sub, dateISO) {
  if (!sub || !dateISO) return false
  const [y, m, d] = dateISO.split('-')
  const path = `public/users/${sub}/${y}/${m}/${d}/margana-user-results.json`
  try {
    const { url } = await getUrl({
      path,
      options: { bucket: { bucketName: Bucket.MARGANA_GAME_RESULTS, region: 'eu-west-2' } }
    })
    // Use GET instead of HEAD to avoid 403 Forbidden on signed URLs intended for GET
    const res = await fetch(url)
    return res.ok
  } catch (_) {
    return false
  }
}

/**
 * Fetches the official puzzle (completed or semi-completed) for a specific date.
 */
export async function fetchOfficialPuzzle(dateISO, type = 'completed') {
  if (!dateISO) return null
  const [y, m, d] = dateISO.split('-')
  const filename = type === 'completed' ? 'margana-completed.json' : 'margana-semi-completed.json'
  const path = `public/daily-puzzles/${y}/${m}/${d}/${filename}`
  try {
    const { url } = await getUrl({
      path,
      options: { bucket: { bucketName: Bucket.MARGANA_WORD_GAME, region: 'eu-west-2' } }
    })
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Failed to fetch ${type} puzzle: ${res.status}`)
    return await res.json()
  } catch (err) {
    console.error(`Error fetching official ${type} puzzle for ${dateISO}:`, err)
    throw err
  }
}
