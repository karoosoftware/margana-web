// Shared highlighting utilities for Margana and Yesterday pages
// All functions are pure and operate on provided grid/accessors.

export function sanitizeLetter(v) {
  return (v || '').toString().replace(/[^a-zA-Z]/g, '').slice(0, 1).toUpperCase()
}

export function cellKey(r, c) {
  return `${r}:${c}`
}

export function composeRowWordFromGrids(r, baseGrid, editableGrid, isTargetCellFn) {
  const cols = baseGrid?.[0]?.length || 0
  const letters = []
  for (let c = 0; c < cols; c++) {
    const v = isTargetCellFn(r, c) ? baseGrid[r][c] : (editableGrid?.[r]?.[c] || '')
    letters.push(sanitizeLetter(v))
  }
  return letters.join('')
}

export function extractMainDiagsFromGrids(baseGrid, editableGrid, isTargetCellFn) {
  const rows = baseGrid?.length || 0
  if (!rows) return []
  const cols = baseGrid[0].length
  const out = []
  // top row starts
  for (let sc = 0; sc < cols; sc++) {
    const coords = []
    const chars = []
    let r = 0, c = sc
    while (r < rows && c < cols) {
      const v = isTargetCellFn(r, c) ? baseGrid[r][c] : (editableGrid?.[r]?.[c] || '')
      chars.push(sanitizeLetter(v))
      coords.push([r, c])
      r++; c++
    }
    out.push({ str: chars.join(''), coords })
  }
  // left col starts (skip 0,0)
  for (let sr = 1; sr < rows; sr++) {
    const coords = []
    const chars = []
    let r = sr, c = 0
    while (r < rows && c < cols) {
      const v = isTargetCellFn(r, c) ? baseGrid[r][c] : (editableGrid?.[r]?.[c] || '')
      chars.push(sanitizeLetter(v))
      coords.push([r, c])
      r++; c++
    }
    out.push({ str: chars.join(''), coords })
  }
  return out
}

export function extractAntiDiagsFromGrids(baseGrid, editableGrid, isTargetCellFn) {
  const rows = baseGrid?.length || 0
  if (!rows) return []
  const cols = baseGrid[0].length
  const out = []
  // top row starts from right to left
  for (let sc = cols - 1; sc >= 0; sc--) {
    const coords = []
    const chars = []
    let r = 0, c = sc
    while (r < rows && c >= 0) {
      const v = isTargetCellFn(r, c) ? baseGrid[r][c] : (editableGrid?.[r]?.[c] || '')
      chars.push(sanitizeLetter(v))
      coords.push([r, c])
      r++; c--
    }
    out.push({ str: chars.join(''), coords })
  }
  // right col starts (skip top-right)
  for (let sr = 1; sr < rows; sr++) {
    const coords = []
    const chars = []
    let r = sr, c = cols - 1
    while (r < rows && c >= 0) {
      const v = isTargetCellFn(r, c) ? baseGrid[r][c] : (editableGrid?.[r]?.[c] || '')
      chars.push(sanitizeLetter(v))
      coords.push([r, c])
      r++; c--
    }
    out.push({ str: chars.join(''), coords })
  }
  return out
}

// Given a metadata item with optional start/end coordinates, compute exact highlight.
// Returns a Set of cell keys (r:c) when successful; otherwise returns an empty Set.
export function computeHighlightFromItem(item, baseGrid, editableGrid, isTargetCellFn) {
  try {
    const set = new Set()
    if (!item || typeof item !== 'object') return set
    const rows = baseGrid?.length || 0
    if (!rows) return set
    const cols = baseGrid[0].length

    const word = sanitizeLetterSequence(item.word)
    if (!word) return set

    // 0) Explicit coords/path array (supports madness or custom highlights)
    const rawPath = Array.isArray(item.coords) ? item.coords : (Array.isArray(item.path) ? item.path : null)
    if (rawPath && rawPath.length) {
      const path = []
      for (const p of rawPath) {
        const r = Number(p?.r ?? (Array.isArray(p) ? p[0] : NaN))
        const c = Number(p?.c ?? (Array.isArray(p) ? p[1] : NaN))
        if (!Number.isFinite(r) || !Number.isFinite(c)) return set
        if (r < 0 || r >= rows || c < 0 || c >= cols) return set
        path.push([r, c])
      }
      // Optional: validate letters match (best-effort)
      const letters = []
      for (const [pr, pc] of path) {
        const v = isTargetCellFn(pr, pc) ? baseGrid[pr][pc] : (editableGrid?.[pr]?.[pc] || '')
        letters.push(sanitizeLetter(v))
      }
      const seq = letters.join('')
      const ok = seq === word || seq === reverse(word) || !seq // allow empty validation if letters unobtainable
      if (!ok && word) {
        // If mismatch, still allow highlighting the provided path to visualize special cases
      }
      for (const [pr, pc] of path) set.add(cellKey(pr, pc))
      return set
    }

    // 1) Prefer explicit start/end coordinates if present
    const s = item.start_index
    const e = item.end_index
    if (s && e && Number.isFinite(s.r) && Number.isFinite(s.c) && Number.isFinite(e.r) && Number.isFinite(e.c)) {
      const sr = Number(s.r), sc = Number(s.c)
      const er = Number(e.r), ec = Number(e.c)
      if (sr < 0 || sc < 0 || er < 0 || ec < 0 || sr >= rows || er >= rows || sc >= cols || ec >= cols) return set

      const dr = Math.sign(er - sr)
      const dc = Math.sign(ec - sc)
      // Disallow zero step (unless word length 1, which we don't support here)
      if (dr === 0 && dc === 0) return set

      let r = sr, c = sc
      const path = []
      // Construct the path inclusively until we reach end
      // Guard with max iterations
      const maxSteps = rows * cols + 5
      let steps = 0
      while (true) {
        path.push([r, c])
        if (r === er && c === ec) break
        r += dr; c += dc
        steps++
        if (steps > maxSteps) { return set }
        if (r < 0 || r >= rows || c < 0 || c >= cols) { return set }
      }
      // Validate letters match the word (case-insensitive)
      const letters = []
      for (const [pr, pc] of path) {
        const v = isTargetCellFn(pr, pc) ? baseGrid[pr][pc] : (editableGrid?.[pr]?.[pc] || '')
        letters.push(sanitizeLetter(v))
      }
      const seq = letters.join('')
      const ok = seq === word || seq === reverse(word)
      if (!ok) return set
      for (const [pr, pc] of path) set.add(cellKey(pr, pc))
      return set
    }

    // 2) If no coordinates, fall back to word search
    return findHighlightForWord(word, baseGrid, editableGrid, isTargetCellFn)
  } catch (_) {
    return new Set()
  }
}

// Returns a Set of cell keys (r:c) that should be highlighted for the given word.
// Includes reverse direction matches for rows/cols/diagonals.
export function findHighlightForWord(word, baseGrid, editableGrid, isTargetCellFn) {
  const set = new Set()
  const rows = baseGrid?.length || 0
  if (!rows) return set
  const cols = baseGrid[0].length
  const target = sanitizeLetterSequence(word)
  if (!target) return set

  // rows
  for (let r = 0; r < rows; r++) {
    const rowStr = composeRowWordFromGrids(r, baseGrid, editableGrid, isTargetCellFn)
    let start = rowStr.indexOf(target)
    if (start < 0) start = rowStr.indexOf(reverse(target))
    if (start >= 0) {
      for (let c = start; c < Math.min(start + target.length, cols); c++) set.add(cellKey(r, c))
      return set
    }
  }
  // columns
  for (let c = 0; c < cols; c++) {
    const arr = []
    for (let r = 0; r < rows; r++) {
      const v = isTargetCellFn(r, c) ? baseGrid[r][c] : (editableGrid?.[r]?.[c] || '')
      arr.push(sanitizeLetter(v))
    }
    const colStr = arr.join('')
    let start = colStr.indexOf(target)
    if (start < 0) start = colStr.indexOf(reverse(target))
    if (start >= 0) {
      for (let r = start; r < Math.min(start + target.length, rows); r++) set.add(cellKey(r, c))
      return set
    }
  }
  // diagonals
  const mains = extractMainDiagsFromGrids(baseGrid, editableGrid, isTargetCellFn)
  for (let i = 0; i < mains.length; i++) {
    const d = mains[i]
    let start = d.str.indexOf(target)
    if (start < 0) start = d.str.indexOf(reverse(target))
    if (start >= 0) {
      for (let k = start; k < start + target.length; k++) {
        const [r, c] = d.coords[k]
        set.add(cellKey(r, c))
      }
      return set
    }
  }
  const antis = extractAntiDiagsFromGrids(baseGrid, editableGrid, isTargetCellFn)
  for (let i = 0; i < antis.length; i++) {
    const d = antis[i]
    let start = d.str.indexOf(target)
    if (start < 0) start = d.str.indexOf(reverse(target))
    if (start >= 0) {
      for (let k = start; k < start + target.length; k++) {
        const [r, c] = d.coords[k]
        set.add(cellKey(r, c))
      }
      return set
    }
  }
  // not found
  return set
}

export function getAnagramWordFromSlots(slots) {
  if (!Array.isArray(slots) || !slots.length) return ''
  return slots.map(ch => {
    const s = sanitizeLetter(ch)
    return s ? s : ' '
  }).join('').trim().toUpperCase()
}

function reverse(s) { return String(s).split('').reverse().join('') }
function sanitizeLetterSequence(s) { return String(s || '').toUpperCase().replace(/[^A-Z]/g, '') }
