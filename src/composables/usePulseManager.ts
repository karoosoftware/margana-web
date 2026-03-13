import { ref, computed, type Ref } from 'vue'
import { cellKey } from '../utils/highlightUtils.js'

export function usePulseManager(
  baseGrid: Ref<any[][]>,
  settingsShowPulseLabels: Ref<boolean>
) {
  const THEME_PRIORITY: Record<string, number> = {
    mad: 100,
    pal: 50,
    sem: 40,
    diag: 30,
    ana: 20,
    default: 0
  }

  const pulseCells = ref(new Set<string>())
  const pulseThemes = ref(new Map<string, string>())
  const pulseLabels = ref(new Map<string, { text: string; theme: string }>())

  const _pulseTimers = new Map<string, any>()
  const _pulseAnchors = new Map<string, string>()
  const _activePulseThemes = ref(new Map<string, Map<string, string>>())

  function updateGlobalPulseState() {
    const newCells = new Set<string>()
    const newThemes = new Map<string, string>()
    const prio = (t: string) => THEME_PRIORITY[t] || THEME_PRIORITY.default

    for (const [k, cellMap] of _activePulseThemes.value.entries()) {
      if (cellMap.size === 0) continue
      newCells.add(k)
      let best: string | null = null
      for (const t of cellMap.values()) {
        if (best == null || prio(t) >= prio(best)) best = t
      }
      if (best) newThemes.set(k, best)
    }
    pulseCells.value = newCells
    pulseThemes.value = newThemes
  }

  const effectivePulseLabels = computed(() => (settingsShowPulseLabels.value === false ? new Map() : pulseLabels.value))
  const effectivePulseThemes = computed(() => (settingsShowPulseLabels.value === false ? new Map() : pulseThemes.value))

  function clearPulse() {
    pulseCells.value = new Set()
    pulseThemes.value = new Map()
    pulseLabels.value = new Map()
    for (const t of _pulseTimers.values()) {
      clearTimeout(t)
    }
    _pulseTimers.clear()
    _pulseAnchors.clear()
    _activePulseThemes.value.clear()
  }

  function getPulseState() {
    return {
      pulseThemes: new Map(pulseThemes.value),
      pulseLabels: new Map(pulseLabels.value)
    }
  }

  function restorePulseState(state: any) {
    clearPulse()
    if (!state) return

    const themes = state.pulseThemes ? new Map(state.pulseThemes) : new Map()
    const labels = state.pulseLabels ? new Map(state.pulseLabels) : new Map()

    const active = new Map<string, Map<string, string>>()
    for (const [cell, theme] of themes.entries()) {
      active.set(cell, new Map([['restore', theme]]))
    }
    _activePulseThemes.value = active
    pulseLabels.value = labels
    updateGlobalPulseState()
  }

  function triggerPulseRow(r: number, theme = 'default', label: string | null = null, cStart: number | null = null, cEnd: number | null = null) {
    try {
      const rows = baseGrid.value.length || 0
      const cols = rows ? baseGrid.value[0].length : 0
      if (r < 0 || r >= rows) return

      const key = `row:${r}:${theme}`

      for (let c = 0; c < cols; c++) {
        const k = cellKey(r, c)
        if (!_activePulseThemes.value.has(k)) _activePulseThemes.value.set(k, new Map())
        _activePulseThemes.value.get(k)!.set(key, theme)
      }
      updateGlobalPulseState()

      let anchorCol = Math.floor(cols / 2)
      if (Number.isFinite(cStart) && Number.isFinite(cEnd)) {
        const left = Math.min(Number(cStart), Number(cEnd))
        const right = Math.max(Number(cStart), Number(cEnd))
        anchorCol = Math.floor((left + right) / 2)
      }
      const anchorKey = cellKey(r, Math.max(0, Math.min(cols - 1, anchorCol)))

      if (label) {
        const labelMap = new Map(pulseLabels.value)
        if (_pulseAnchors.has(key)) {
          const oldAnchor = _pulseAnchors.get(key)
          if (oldAnchor !== anchorKey && oldAnchor) labelMap.delete(oldAnchor)
        }
        labelMap.set(anchorKey, { text: String(label), theme })
        pulseLabels.value = labelMap
        _pulseAnchors.set(key, anchorKey)
      }

      if (_pulseTimers.has(key)) {
        clearTimeout(_pulseTimers.get(key))
      }
      _pulseTimers.set(key, setTimeout(() => {
        try {
          for (let c = 0; c < cols; c++) {
            const k = cellKey(r, c)
            const cellMap = _activePulseThemes.value.get(k)
            if (cellMap) {
              cellMap.delete(key)
              if (cellMap.size === 0) _activePulseThemes.value.delete(k)
            }
          }
          updateGlobalPulseState()

          const lm = new Map(pulseLabels.value)
          const activeAnchor = _pulseAnchors.get(key)
          if (activeAnchor) lm.delete(activeAnchor)
          pulseLabels.value = lm

          _pulseAnchors.delete(key)
          _pulseTimers.delete(key)
        } catch (_) {
          _pulseTimers.delete(key)
        }
      }, 5000))
    } catch (_) {}
  }

  function triggerPulseCells(cells: Set<string>, theme = 'default', label: string | null = null, rStart: number | null = null, cStart: number | null = null) {
    try {
      if (!cells || !cells.size) return
      const key = `cells:${theme}:${Array.from(cells).sort().join('|')}`

      for (const k of cells) {
        if (!_activePulseThemes.value.has(k)) _activePulseThemes.value.set(k, new Map())
        _activePulseThemes.value.get(k)!.set(key, theme)
      }
      updateGlobalPulseState()

      let anchorKey: string | null = null
      if (Number.isFinite(rStart) && Number.isFinite(cStart)) {
        anchorKey = cellKey(Number(rStart), Number(cStart))
      } else {
        try {
          const arr = Array.from(cells)
            .map(k => {
              const [rs, cs] = String(k).split(':')
              const rr = Number(rs), cc = Number(cs)
              return { k, rr: Number.isFinite(rr) ? rr : 0, cc: Number.isFinite(cc) ? cc : 0 }
            })
            .sort((a, b) => (a.rr - b.rr) || (a.cc - b.cc))
          const mid = Math.floor(arr.length / 2)
          anchorKey = (arr[mid] && arr[mid].k) ? arr[mid].k : (arr[0] ? arr[0].k : null)
        } catch (_) {
          anchorKey = null
        }
      }

      if (label && anchorKey) {
        const labelMap = new Map(pulseLabels.value)
        let targetAnchorKey = _pulseAnchors.get(key)

        if (!(targetAnchorKey && labelMap.has(targetAnchorKey))) {
          targetAnchorKey = anchorKey
          if (labelMap.has(targetAnchorKey)) {
             try {
                const ordered = Array.from(cells)
                    .map(k => {
                      const [rs, cs] = String(k).split(':')
                      return {k, rr: Number(rs), cc: Number(cs)}
                    })
                    .filter(p => Number.isFinite(p.rr) && Number.isFinite(p.cc))
                    .sort((a, b) => (a.rr - b.rr) || (a.cc - b.cc))

                const candidates = []
                if (ordered.length) {
                  candidates.push(ordered[ordered.length - 1].k)
                  if (ordered.length > 2) candidates.push(ordered[Math.floor(ordered.length / 2)].k)
                  for (const p of ordered) candidates.push(p.k)
                }
                for (const k of candidates) {
                  if (!labelMap.has(k)) {
                    targetAnchorKey = k;
                    break
                  }
                }
              } catch (_) {}
          }
        }
        if (targetAnchorKey) {
            labelMap.set(targetAnchorKey, { text: String(label), theme })
            pulseLabels.value = labelMap
            _pulseAnchors.set(key, targetAnchorKey)
        }
      }

      if (_pulseTimers.has(key)) {
        clearTimeout(_pulseTimers.get(key))
      }
      _pulseTimers.set(key, setTimeout(() => {
        try {
          for (const k of cells) {
            const cellMap = _activePulseThemes.value.get(k)
            if (cellMap) {
              cellMap.delete(key)
              if (cellMap.size === 0) _activePulseThemes.value.delete(k)
            }
          }
          updateGlobalPulseState()

          const lm = new Map(pulseLabels.value)
          const activeAnchor = _pulseAnchors.get(key)
          if (activeAnchor) lm.delete(activeAnchor)
          pulseLabels.value = lm

          _pulseAnchors.delete(key)
          _pulseTimers.delete(key)
        } catch (_) {
          _pulseTimers.delete(key)
        }
      }, 5000))
    } catch (_) {}
  }

  return {
    pulseCells,
    pulseThemes,
    pulseLabels,
    effectivePulseLabels,
    effectivePulseThemes,
    clearPulse,
    getPulseState,
    restorePulseState,
    triggerPulseRow,
    triggerPulseCells
  }
}
