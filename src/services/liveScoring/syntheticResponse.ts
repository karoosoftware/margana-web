import { LivePayload, WordCheck } from "@/services/wordValidation/liveScoringPrecheck";

export function buildSyntheticResponse(
  payload: LivePayload,
  rowChecks: Record<number, WordCheck>,
  liveTotalScore: number,
  options: { 
    triggerAnagram?: boolean; 
    anagramCheck?: WordCheck; 
    triggerRow?: number | null; 
    rowValid?: Record<number, boolean>;
  }
) {
  const meta = payload.meta ?? {};
  const rowsCount = Number(meta.rows ?? 0);
  const topSkipped = Array.isArray(meta.skippedRows) ? meta.skippedRows : [];
  const skippedSet = new Set(topSkipped);

  const row_summaries = Array.from({ length: rowsCount }, (_, rr) => {
    const status = rowChecks[rr] ?? rowChecks[String(rr) as any];
    const isSkipped = skippedSet.has(rr);

    if (isSkipped) return { row: rr, skipped: true, valid: true, score: 0 };
    if (status === "definitely_invalid") return { row: rr, skipped: false, valid: false, score: 0 };

    const existing = (options.rowValid && typeof options.rowValid[rr] === 'boolean') ? options.rowValid[rr] : false;
    return { row: rr, skipped: false, valid: existing, score: 0 };
  });

  const submitted = options.triggerAnagram 
    ? (String(payload?.meta?.userAnagram || "").toLowerCase() || null) 
    : null;

  return {
    meta: { prechecked: true, ...meta, madnessFound: false },
    total_score: Number(liveTotalScore),
    skippedRows: topSkipped,
    row_summaries,
    valid_words: {
      rows: { lr: [], rl: [] },
      columns: { tb: [], bt: [] },
      diagonals: { main: [], main_rev: [], anti: [], anti_rev: [] },
      anagram: [],
    },
    valid_words_metadata: [],
    invoice: null,
    saved: { bucket: null, key: null, uploaded: false },
    anagram_result: { submitted, accepted: false },
    commit_result: { accepted: false, reason: "precheck_failed" }
  };
}
