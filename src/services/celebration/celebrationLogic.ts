import { cellKey } from '../../utils/highlightUtils.js';

export interface CelebrationContext {
  r: number;
  word: string;
  resp: any;
  baseGrid: any[][];
  editableGrid: any[][];
  lastMadnessSig: string;
  lastRowPulseSigs?: Map<number, string>;
  lastDiagPulseSigs?: Map<string, string>;
  isTargetCell: (r: number, c: number) => boolean;
  computeHighlightFromItem: (item: any, baseGrid: any[][], editableGrid: any[][], isTargetCell: any) => Set<string>;
  firstEditableInRow: (r: number) => { r: number; c: number } | null;
  lastEditableInRow: (r: number) => { r: number; c: number } | null;
}

export interface PulseRowEffect {
  type: 'row';
  r: number;
  theme: string;
  label: string | null;
  cStart: number;
  cEnd: number;
  sig: string;
}

export interface PulseCellsEffect {
  type: 'cells';
  cells: Set<string>;
  theme: string;
  label: string | null;
  rStart: number | null;
  cStart: number | null;
  sig?: string;
  diagonalSig?: string;
}

export type CelebrationEffect = PulseRowEffect | PulseCellsEffect;

/**
 * Extracts the celebration logic for row validation.
 * Detects palindromes, semordnilaps and diagonal intersections.
 */
export function getRowCelebrationEffects(ctx: CelebrationContext): CelebrationEffect[] {
  const {
    r,
    word,
    resp,
    baseGrid,
    editableGrid,
    lastRowPulseSigs,
    lastDiagPulseSigs,
    isTargetCell,
    computeHighlightFromItem,
    firstEditableInRow,
    lastEditableInRow
  } = ctx;

  const effects: CelebrationEffect[] = [];
  const items = Array.isArray(resp?.valid_words_metadata) ? resp.valid_words_metadata : [];
  const rowWord = (word || '').toString().toLowerCase();

  // 1. Row Palindrome/Semordnilap detection
  const found = items.find(
    (it: any) =>
      it &&
      it.type === 'row' &&
      Number(it.index) === Number(r) &&
      String(it.word || '').toLowerCase() === rowWord
  );

  if (found && (found.palindrome === true || found.semordnilap === true)) {
    const theme = (found.palindrome === true) ? 'pal' : (found.semordnilap === true ? 'sem' : 'default');
    const typeLabel = (found.palindrome === true) ? 'Palindrome' : (found.semordnilap === true ? 'Semordnilap' : '');

    let scr = (typeof found.score === 'number') ? found.score : null;
    if (typeLabel === 'Semordnilap') {
      if (typeof scr === 'number') scr = scr * 2;
    }

    const label = typeLabel ? (scr != null ? `${typeLabel} +${scr}` : typeLabel) : null;
    const pulseSig = `${theme}|${label}`;

    if (lastRowPulseSigs && lastRowPulseSigs.get(r) === pulseSig) {
      // Already pulsed recently with this exact effect
    } else {
      let cStart = 0;
      let cEnd = (baseGrid?.[0]?.length || 1) - 1;
      try {
        const first = firstEditableInRow(r);
        const last = lastEditableInRow(r);
        if (first && Number.isFinite(first.c)) cStart = first.c;
        if (last && Number.isFinite(last.c)) cEnd = last.c;
      } catch (_) {}

      effects.push({
        type: 'row',
        r,
        theme,
        label,
        cStart,
        cEnd,
        sig: pulseSig
      });
    }
  }

  // 2. Diagonal intersections
  try {
    const diags = items.filter((it: any) => it && it.type === 'diagonal');
    const bySig = new Map<string, any>();

    for (const d of diags) {
      const setFromMeta = computeHighlightFromItem(d, baseGrid, editableGrid, isTargetCell);
      if (!setFromMeta || !setFromMeta.size) continue;

      const sig = Array.from(setFromMeta).sort().join('|');
      let intersects = false;
      for (const key of setFromMeta) {
        if (typeof key === 'string' && key.startsWith(`${r}:`)) { intersects = true; break; }
      }

      const scr = (typeof d.score === 'number') ? d.score : 0;
      const prev = bySig.get(sig);
      const next = prev || {
        cells: setFromMeta,
        intersects: false,
        semScoreSum: 0,
        semCount: 0,
        pal: false,
        anyScore: null
      };

      next.intersects = next.intersects || intersects;
      if (d.semordnilap === true) {
        next.semCount += 1;
        next.semScoreSum += scr;
      }
      if (d.palindrome === true) {
        next.pal = true;
        next.anyScore = scr;
      }
      if (next.anyScore == null && d.semordnilap !== true && d.palindrome !== true) {
        next.anyScore = scr;
      }
      bySig.set(sig, next);
    }

    // Identify diagonals to clear (intersecting but no longer present)
    // NOTE: This logic might need to be handled by the caller or we return "clear" effects
    // For now, we'll return the pulses and let the caller manage lastDiagPulseSigs

    for (const [sig, agg] of bySig.entries()) {
      if (!agg.intersects) continue;

      let theme = 'diag';
      let labelBase = 'Diagonal';
      let scoreForLabel = agg.anyScore != null ? agg.anyScore : 0;

      if (agg.pal) {
        theme = 'pal';
        labelBase = 'Palindrome';
        scoreForLabel = typeof agg.anyScore === 'number' ? agg.anyScore : 0;
      } else if (agg.semCount > 0) {
        theme = 'sem';
        labelBase = 'Semordnilap';
        scoreForLabel = agg.semScoreSum;
      }

      const label = Number.isFinite(scoreForLabel) ? `${labelBase} +${scoreForLabel}` : labelBase;
      const pulseSig = `${theme}|${label}`;

      if (lastDiagPulseSigs && lastDiagPulseSigs.get(sig) === pulseSig) {
        // Already pulsed recently with this exact diagonal effect
        continue;
      }

      let rs: number | null = null, cs: number | null = null;
      try {
        const arr = Array.from(agg.cells)
          .map((k: any) => {
            const [rr, cc] = String(k).split(':');
            return { rr: Number(rr), cc: Number(cc) };
          })
          .filter(p => Number.isFinite(p.rr) && Number.isFinite(p.cc))
          .sort((a, b) => (a.rr - b.rr) || (a.cc - b.cc));

        if (arr.length) { rs = arr[0].rr; cs = arr[0].cc; }
      } catch (_) {}

      effects.push({
        type: 'cells',
        cells: agg.cells,
        theme,
        label,
        rStart: rs,
        cStart: cs,
        sig: pulseSig,
        diagonalSig: sig
      });
    }
  } catch (_) {}

  return effects;
}

/**
 * Extracts Margana Madness celebration logic.
 */
export function getMadnessCelebrationEffect(ctx: {
  resp: any,
  lastMadnessSig: string,
  currentRow?: number
}): PulseCellsEffect | null {
  const { resp, lastMadnessSig, currentRow } = ctx;
  try {
    if (resp?.meta?.madnessFound && Array.isArray(resp.meta.madnessPath) && resp.meta.madnessPath.length) {
      const sig = resp.meta.madnessPath.map((p: any) => {
        const r = p?.[0] ?? p?.r, c = p?.[1] ?? p?.c;
        return `${r}:${c}`;
      }).join('|');

      if (sig !== lastMadnessSig) {
        // If currentRow is provided, ensure at least one cell in the madness path belongs to this row
        if (typeof currentRow === 'number') {
          const intersects = resp.meta.madnessPath.some((p: any) => {
            const r = Number(p?.[0] ?? p?.r);
            return r === currentRow;
          });
          if (!intersects) return null;
        }

        const set = new Set<string>();
        let rStart: number | null = null, cStart: number | null = null;
        for (let i = 0; i < resp.meta.madnessPath.length; i++) {
          const p = resp.meta.madnessPath[i];
          const r = Number(p?.[0] ?? p?.r), c = Number(p?.[1] ?? p?.c);
          if (Number.isFinite(r) && Number.isFinite(c)) {
            set.add(cellKey(r, c));
            if (i === 0) { rStart = r; cStart = c; }
          }
        }
        if (set.size > 0) {
          const score = Number.isFinite(Number(resp.meta.madnessScore)) ? Number(resp.meta.madnessScore) : null;
          const label = score != null ? `Madness +${score}` : 'Madness!';
          return {
            type: 'cells',
            cells: set,
            theme: 'mad',
            label,
            rStart,
            cStart,
            sig
          };
        }
      }
    }
  } catch (_) {}
  return null;
}
