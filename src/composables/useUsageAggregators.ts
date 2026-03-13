import { ref } from 'vue'

// --- Constants ---

// Typing Aggregator
export const TYP_AGG_DEBOUNCE_MS = 2000
export const TYP_SCROLL_SAMPLE_MS = 500
export const TYP_AGG_BURST_MS = 1000
export const TYP_AGG_BURST_MIN = 3
export const TYP_AGG_MIN_KEYS = 1
export const USAGE_TYPING_AGG = true

// Highlight Aggregator
export const HIGHLIGHT_AGG_DEBOUNCE_MS = 2000
export const HIGHLIGHT_SCROLL_SAMPLE_MS = 500
export const HIGHLIGHT_AGG_MIN_HIGHLIGHTS = 1
export const USAGE_HIGHLIGHT_AGG = true

// Shuffle Aggregator
export const SHUF_AGG_DEBOUNCE_MS = 5000
export const SHUF_SCROLL_SAMPLE_MS = 500
export const SHUF_AGG_MIN_SHUFFLES = 1
export const USAGE_SHUFFLE_AGG = true

const isVisible = () => (typeof document !== 'undefined' ? document.visibilityState === 'visible' : true)

function dispatchUsage(name: string, data: any) {
  try {
    window.dispatchEvent(new CustomEvent('margana-usage', { detail: { name, data } }))
  } catch (_) {
    // ignore
  }
}

export function useUsageAggregators() {
  const typingAgg = (() => {
    let active = false
    let startTs = 0
    let endTs = 0
    let letters = 0
    let backspaces = 0
    let enters = 0
    let lastKeyTs = 0
    let sumDelta = 0
    let maxDelta = 0
    let intervals = 0
    let burstCount = 0
    let recentKeys: number[] = []
    let debounceTimer: any = null
    let scrollTimer: any = null
    let scrollMax = 0
    let seqFirst = 0
    let seqLast = 0
    let keystrokeSeq = 0
    let visibleAtStart = isVisible()

    function scrollSample() {
      try {
        const doc = document.documentElement
        const body = document.body
        const scrollTop = (window.pageYOffset || doc.scrollTop || body.scrollTop || 0)
        const docHeight = Math.max(body.scrollHeight, body.offsetHeight, doc.clientHeight, doc.scrollHeight, doc.offsetHeight)
        const viewH = window.innerHeight || doc.clientHeight
        const denom = Math.max(1, docHeight - viewH)
        const pct = Math.max(0, Math.min(100, Math.round((scrollTop / denom) * 100)))
        if (pct > scrollMax) scrollMax = pct
      } catch (_) { /* ignore */ }
    }

    function start(now: number) {
      active = true
      startTs = endTs = lastKeyTs = now
      letters = backspaces = enters = 0
      sumDelta = maxDelta = intervals = 0
      burstCount = 0
      recentKeys = []
      scrollMax = 0
      visibleAtStart = isVisible()
      seqFirst = (keystrokeSeq += 1)
      seqLast = seqFirst
      try {
        if (scrollTimer) clearInterval(scrollTimer)
        scrollTimer = setInterval(scrollSample, TYP_SCROLL_SAMPLE_MS)
      } catch (_) { /* ignore */ }
    }

    function applyKey(now: number, kind: 'letter' | 'backspace' | 'enter') {
      if (!active) start(now)
      if (kind === 'letter') letters += 1
      else if (kind === 'backspace') backspaces += 1
      else if (kind === 'enter') enters += 1

      if (lastKeyTs > 0) {
        const delta = now - lastKeyTs
        if (delta >= 0) {
          sumDelta += delta
          intervals += 1
          if (delta > maxDelta) maxDelta = delta
        }
      }
      lastKeyTs = now
      endTs = now
      seqLast = (keystrokeSeq += 1)

      if (kind === 'letter') {
        const cutoff = now - TYP_AGG_BURST_MS
        recentKeys = recentKeys.filter(ts => ts >= cutoff)
        const preSize = recentKeys.length
        recentKeys.push(now)
        if (preSize + 1 >= TYP_AGG_BURST_MIN) burstCount += 1
      }

      if (debounceTimer) try { clearTimeout(debounceTimer) } catch (_) { /* ignore */ }
      debounceTimer = setTimeout(() => flush('debounce'), TYP_AGG_DEBOUNCE_MS)
    }

    function payload() {
      const duration = Math.max(0, endTs - startTs)
      const avg = intervals > 0 ? Math.round(sumDelta / intervals) : null
      return {
        board_id: 'game-board',
        page_id: 'margana',
        start_ts: startTs,
        end_ts: endTs,
        duration_ms: duration,
        key_count: letters,
        backspace_count: backspaces,
        enter_count: enters,
        avg_inter_key_ms: avg,
        max_pause_ms: maxDelta || null,
        burst_count: burstCount,
        visible: visibleAtStart && isVisible(),
        scroll_pct_max: scrollMax,
        sample_rate: 1.0,
        seq_first: seqFirst,
        seq_last: seqLast,
      }
    }

    function flush(reason: string) {
      if (!USAGE_TYPING_AGG) return
      if (!active) return
      try { if (debounceTimer) clearTimeout(debounceTimer) } catch (_) { /* ignore */ }
      try { if (scrollTimer) clearInterval(scrollTimer) } catch (_) { /* ignore */ }
      debounceTimer = null
      scrollTimer = null
      if (letters >= TYP_AGG_MIN_KEYS || (backspaces + enters) > 0) {
        try { dispatchUsage('typing_agg', payload()) } catch (_) { /* ignore */ }
      }
      active = false
      startTs = endTs = lastKeyTs = 0
      letters = backspaces = enters = 0
      sumDelta = maxDelta = intervals = 0
      burstCount = 0
      recentKeys = []
      scrollMax = 0
      seqFirst = seqLast = 0
    }

    return {
      onLetter() { if (!USAGE_TYPING_AGG) return; applyKey(Date.now(), 'letter') },
      onBackspace() { if (!USAGE_TYPING_AGG) return; applyKey(Date.now(), 'backspace') },
      onEnter() { if (!USAGE_TYPING_AGG) return; applyKey(Date.now(), 'enter') },
      flush
    }
  })()

  const highlightAgg = (() => {
    let active = false
    let startTs = 0
    let endTs = 0
    let highlightCount = 0
    let lastTs = 0
    let sumDelta = 0
    let maxDelta = 0
    let intervals = 0
    let debounceTimer: any = null
    let scrollTimer: any = null
    let scrollMax = 0
    let seqFirst = 0
    let seqLast = 0
    let actionSeq = 0
    let visibleAtStart = isVisible()

    function scrollSample() {
      try {
        const doc = document.documentElement
        const body = document.body
        const scrollTop = (window.pageYOffset || doc.scrollTop || body.scrollTop || 0)
        const docHeight = Math.max(body.scrollHeight, body.offsetHeight, doc.clientHeight, doc.scrollHeight, doc.offsetHeight)
        const viewH = window.innerHeight || doc.clientHeight
        const denom = Math.max(1, docHeight - viewH)
        const pct = Math.max(0, Math.min(100, Math.round((scrollTop / denom) * 100)))
        if (pct > scrollMax) scrollMax = pct
      } catch (_) { /* ignore */ }
    }

    function start(now: number) {
      active = true
      startTs = lastTs = now
      highlightCount = 0
      sumDelta = maxDelta = intervals = 0
      scrollMax = 0
      visibleAtStart = isVisible()
      seqFirst = (actionSeq += 1)
      seqLast = seqFirst
      try {
        if (scrollTimer) clearInterval(scrollTimer)
        scrollTimer = setInterval(scrollSample, HIGHLIGHT_SCROLL_SAMPLE_MS)
      } catch (_) { /* ignore */ }
    }

    function applyHighlight(now: number) {
      if (!active) start(now)
      highlightCount += 1
      if (lastTs > 0) {
        const delta = now - lastTs
        if (delta >= 0) {
          sumDelta += delta
          intervals += 1
          if (delta > maxDelta) maxDelta = delta
        }
      }
      lastTs = now
      endTs = now
      seqLast = (actionSeq += 1)
      if (debounceTimer) try { clearTimeout(debounceTimer) } catch (_) { /* ignore */ }
      debounceTimer = setTimeout(() => flush('debounce'), HIGHLIGHT_AGG_DEBOUNCE_MS)
    }

    function flush(reason: string) {
      if (!USAGE_HIGHLIGHT_AGG) return
      if (!active) return
      try { if (debounceTimer) clearTimeout(debounceTimer) } catch (_) { /* ignore */ }
      try { if (scrollTimer) clearInterval(scrollTimer) } catch (_) { /* ignore */ }
      debounceTimer = null
      scrollTimer = null
      if (highlightCount >= HIGHLIGHT_AGG_MIN_HIGHLIGHTS) {
        try {
          const duration = Math.max(0, endTs - startTs)
          const avg = intervals > 0 ? Math.round(sumDelta / intervals) : null
          dispatchUsage('highlight_agg', {
            board_id: 'game-board',
            page_id: 'margana',
            start_ts: startTs,
            end_ts: endTs,
            duration_ms: duration,
            highlight_count: highlightCount,
            avg_inter_highlight_ms: avg,
            max_pause_ms: maxDelta || null,
            visible: visibleAtStart && isVisible(),
            scroll_pct_max: scrollMax,
            sample_rate: 1.0,
            seq_first: seqFirst,
            seq_last: seqLast,
          })
        } catch (_) { /* ignore */ }
      }
      active = false
      highlightCount = 0
      scrollMax = 0
    }

    return {
      onHighlight() { if (!USAGE_HIGHLIGHT_AGG) return; applyHighlight(Date.now()) },
      flush
    }
  })()

  const shuffleAgg = (() => {
    let active = false
    let startTs = 0
    let endTs = 0
    let shuffleCount = 0
    let resetCount = 0
    let lastTs = 0
    let sumDelta = 0
    let maxDelta = 0
    let intervals = 0
    let debounceTimer: any = null
    let scrollTimer: any = null
    let scrollMax = 0
    let seqFirst = 0
    let seqLast = 0
    let actionSeq = 0
    let visibleAtStart = isVisible()

    function scrollSample() {
      try {
        const doc = document.documentElement
        const body = document.body
        const scrollTop = (window.pageYOffset || doc.scrollTop || body.scrollTop || 0)
        const docHeight = Math.max(body.scrollHeight, body.offsetHeight, doc.clientHeight, doc.scrollHeight, doc.offsetHeight)
        const viewH = window.innerHeight || doc.clientHeight
        const denom = Math.max(1, docHeight - viewH)
        const pct = Math.max(0, Math.min(100, Math.round((scrollTop / denom) * 100)))
        if (pct > scrollMax) scrollMax = pct
      } catch (_) { /* ignore */ }
    }

    function start(now: number) {
      active = true
      startTs = lastTs = now
      shuffleCount = 0
      resetCount = 0
      sumDelta = maxDelta = intervals = 0
      scrollMax = 0
      visibleAtStart = isVisible()
      seqFirst = (actionSeq += 1)
      seqLast = seqFirst
      try {
        if (scrollTimer) clearInterval(scrollTimer)
        scrollTimer = setInterval(scrollSample, SHUF_SCROLL_SAMPLE_MS)
      } catch (_) { /* ignore */ }
    }

    function applyAction(now: number, type: 'shuffle' | 'reset') {
      if (!active) start(now)
      if (type === 'shuffle') shuffleCount += 1
      else if (type === 'reset') resetCount += 1
      if (lastTs > 0) {
        const delta = now - lastTs
        if (delta >= 0) {
          sumDelta += delta
          intervals += 1
          if (delta > maxDelta) maxDelta = delta
        }
      }
      lastTs = now
      endTs = now
      seqLast = (actionSeq += 1)
      if (debounceTimer) try { clearTimeout(debounceTimer) } catch (_) { /* ignore */ }
      debounceTimer = setTimeout(() => flush('debounce'), SHUF_AGG_DEBOUNCE_MS)
    }

    function flush(reason: string) {
      if (!USAGE_SHUFFLE_AGG) return
      if (!active) return
      try { if (debounceTimer) clearTimeout(debounceTimer) } catch (_) { /* ignore */ }
      try { if (scrollTimer) clearInterval(scrollTimer) } catch (_) { /* ignore */ }
      debounceTimer = null
      scrollTimer = null
      if ((shuffleCount + resetCount) >= SHUF_AGG_MIN_SHUFFLES) {
        try {
          const duration = Math.max(0, endTs - startTs)
          const avg = intervals > 0 ? Math.round(sumDelta / intervals) : null
          dispatchUsage('shuffle_agg', {
            board_id: 'game-board',
            page_id: 'margana',
            start_ts: startTs,
            end_ts: endTs,
            duration_ms: duration,
            shuffle_count: shuffleCount,
            reset_count: resetCount,
            avg_inter_action_ms: avg,
            max_pause_ms: maxDelta || null,
            visible: visibleAtStart && isVisible(),
            scroll_pct_max: scrollMax,
            sample_rate: 1.0,
            seq_first: seqFirst,
            seq_last: seqLast,
          })
        } catch (_) { /* ignore */ }
      }
      active = false
      shuffleCount = resetCount = 0
      scrollMax = 0
    }

    return {
      onClick() { if (!USAGE_SHUFFLE_AGG) return; applyAction(Date.now(), 'shuffle') },
      onClear() { if (!USAGE_SHUFFLE_AGG) return; applyAction(Date.now(), 'reset') },
      flush
    }
  })()

  return {
    typingAgg,
    highlightAgg,
    shuffleAgg
  }
}
