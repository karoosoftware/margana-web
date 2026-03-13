import { ref } from 'vue'

export function mondayOfWeek(d = new Date()) {
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = dt.getUTCDay() || 7
  dt.setUTCDate(dt.getUTCDate() - (day - 1))
  return dt
}

export function isoWeekId(d = new Date()) {
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = dt.getUTCDay() || 7
  dt.setUTCDate(dt.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((dt - yearStart) / 86400000) + 1) / 7)
  const y = dt.getUTCFullYear()
  return `${y}-W${String(weekNo).padStart(2, '0')}`
}

export function buildWeekFromStart(ws) {
  try {
    const [y, m, d] = ws.split('-').map(n => parseInt(n, 10))
    const start = new Date(Date.UTC(y, m - 1, d))
    return Array.from({ length: 7 }, (_, i) => {
      const dt = new Date(start)
      dt.setUTCDate(start.getUTCDate() + i)
      const yyyy = dt.getUTCFullYear()
      const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
      const dd = String(dt.getUTCDate()).padStart(2, '0')
      return `${yyyy}-${mm}-${dd}`
    })
  } catch { return [] }
}

export function mondayFromWeekId(weekId) {
  try {
    const [yStr, wStr] = String(weekId).split('-W')
    const y = parseInt(yStr, 10)
    const w = parseInt(wStr, 10)
    if (!Number.isFinite(y) || !Number.isFinite(w)) throw new Error('bad week')
    // ISO: Thursday is always in the target week; set to Jan 4th baseline
    const jan4 = new Date(Date.UTC(y, 0, 4))
    const jan4Day = jan4.getUTCDay() || 7
    const week1Mon = new Date(jan4)
    week1Mon.setUTCDate(jan4.getUTCDate() - (jan4Day - 1))
    const target = new Date(week1Mon)
    target.setUTCDate(week1Mon.getUTCDate() + (w - 1) * 7)
    return target
  } catch {
    return mondayOfWeek(new Date())
  }
}

export function todayIsoLocal() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function fmtDayLetter(d) {
  try {
    const dt = new Date(d + 'T12:00:00') // Use noon to avoid timezone shifts near midnight
    const wd = dt.toLocaleDateString(undefined, { weekday: 'short' })
    return (wd && typeof wd === 'string') ? wd.slice(0, 1) : ''
  } catch { return '' }
}

export function maskFutureAndToday(series, daysList, udsMap) {
  try {
    const today = todayIsoLocal()
    const src = Array.isArray(series) ? series : []
    const D = daysList || []
    
    // If udsMap is provided (user_daily_scores map), we use it to check if today is played.
    // In PerformanceView, we assume today is played, but in MetricDashboard we check udsMap.
    const hideToday = udsMap ? Number(udsMap[today] ?? 0) === 0 : false

    return src.map((val, i) => {
      const d = D[i]
      if (!d) return val
      if (d > today) return NaN
      if (d === today && hideToday) return NaN
      return val
    })
  } catch {
    return Array.isArray(series) ? series : []
  }
}

export function useGuestMetrics() {
  const days = ref([])
  const youDailyScores = ref([])
  const guestTargetLine = ref([])
  const youCumScores = ref([])
  const guestStreak = ref(0)
  const guestStreakPoints = ref(0)

  async function loadGuestData(referenceDate = new Date()) {
    const ws = mondayOfWeek(referenceDate)
    const weekStartStr = `${ws.getUTCFullYear()}-${String(ws.getUTCMonth() + 1).padStart(2, '0')}-${String(ws.getUTCDate()).padStart(2, '0')}`
    const weekDays = buildWeekFromStart(weekStartStr)
    days.value = weekDays

    const dailyScores = []
    const targetLine = []
    const cumScores = []
    let runningTotal = 0
    let weeklyHigh = 0

    weekDays.forEach((d) => {
      let score = 0
      try {
        const saved = localStorage.getItem(`margana.result.${d}`)
        if (saved) {
          const body = JSON.parse(saved)
          score = Number(body?.total_score || 0)
        }
      } catch { score = 0 }
      
      dailyScores.push(score)
      if (score > weeklyHigh) weeklyHigh = score
      targetLine.push(weeklyHigh)
      
      runningTotal += score
      cumScores.push(runningTotal)
    })

    youDailyScores.value = dailyScores
    guestTargetLine.value = targetLine
    youCumScores.value = cumScores

    return {
      week_id: isoWeekId(referenceDate),
      week_start: weekStartStr,
      days: weekDays,
      user_daily_scores_map: weekDays.reduce((acc, d, i) => {
        acc[d] = dailyScores[i]
        return acc
      }, {})
    }
  }

  return {
    days,
    youDailyScores,
    guestTargetLine,
    youCumScores,
    guestStreak,
    guestStreakPoints,
    loadGuestData
  }
}
