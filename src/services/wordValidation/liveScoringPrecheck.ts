import { isDefinitelyInvalidWord } from "@/services/wordValidation/wordFilters";

export type WordCheck = "incomplete" | "definitely_invalid" | "maybe_valid";

export type LivePayload = {
  meta?: {
    rows?: number;
    cols?: number;
    wordLength?: number;
    skippedRows?: number[];
    userAnagram?: string | null;
  };
  cells?: Array<{ r: number; c: number; letter: string }>;
};

/**
 * Build a padded row string of length wordLength, using " " for blanks.
 * Matches the API's row_summaries.word style like "gad  " or "e   r".
 */
function buildRowWordPadded(payload: LivePayload, row: number): string {
  const meta = payload.meta ?? {};
  const rows = Number(meta.rows ?? 0);
  const cols = Number(meta.cols ?? 0);
  const wordLength = Number(meta.wordLength ?? cols);

  if (!Number.isFinite(rows) || !Number.isFinite(cols) || !Number.isFinite(wordLength)) return "";
  if (rows <= 0 || cols <= 0 || wordLength <= 0) return "";
  if (row < 0 || row >= rows) return "";

  // Collect letters for the row
  const lettersByCol = new Map<number, string>();
  const cells = Array.isArray(payload.cells) ? payload.cells : [];

  for (const cell of cells) {
    if (!cell) continue;
    if (Number(cell.r) !== row) continue;

    const c = Number(cell.c);
    if (!Number.isFinite(c) || c < 0 || c >= cols) continue;

    const letter = typeof cell.letter === "string" ? cell.letter : "";
    lettersByCol.set(c, letter);
  }

  // First `wordLength` columns: letter => lower-case; blank/non-letter => space
  let out = "";
  for (let c = 0; c < wordLength; c++) {
    const raw = (lettersByCol.get(c) ?? "").trim();
    out += /^[A-Za-z]$/.test(raw) ? raw.toLowerCase() : " ";
  }

  return out;
}

/**
 * For a padded word (spaces = blanks):
 * - If it has any spaces => incomplete
 * - Else check dictionary membership via XOR filter
 */
async function checkPaddedWord(padded: string): Promise<WordCheck> {
  if (!padded) return "incomplete";
  if (padded.includes(" ")) return "incomplete";

  // Complete word: should be all letters
  if (!/^[a-z]+$/.test(padded)) return "definitely_invalid";

  return (await isDefinitelyInvalidWord(padded)) ? "definitely_invalid" : "maybe_valid";
}

async function checkAnagram(meta: LivePayload["meta"]): Promise<WordCheck> {
  const raw = meta?.userAnagram
  // console.log("[LiveScoringPrecheck] Checking anagram:", raw);
  if (typeof raw !== "string") return "incomplete"

  const g = raw.trim().toLowerCase()

  // UI rule: 3–10 letters only
  if (!g || g.length < 3 || g.length > 10) {
    // console.log("[LiveScoringPrecheck] Anagram incomplete (length):", g.length);
    return "incomplete"
  }
  if (!/^[a-z]+$/.test(g)) {
    // console.log("[LiveScoringPrecheck] Anagram incomplete (chars):", g);
    return "incomplete"
  }

  const isInvalid = await isDefinitelyInvalidWord(g);
  // console.log("[LiveScoringPrecheck] Anagram XOR check:", g, "isInvalid:", isInvalid);
  return isInvalid ? "definitely_invalid" : "maybe_valid"
}


/**
 * Client-side gate for API.MARGANA_SUBMISSION:
 * - Build each row word (skipping skippedRows) and the anagram word.
 * - Only "maybe_valid" words should trigger the API call.
 * - If everything is incomplete or definitely invalid, skip the call.
 */
export async function precheckRowsAndAnagram(payload: LivePayload): Promise<{
  rowChecks: Record<number, WordCheck>;
  anagramCheck: WordCheck;
  shouldCallApi: boolean;
}> {
  const meta = payload.meta ?? {};
  const rows = Number(meta.rows ?? 0);

  const skipped = new Set<number>(
    (meta.skippedRows ?? []).map((n) => Number(n)).filter((n) => Number.isFinite(n))
  );

  const rowChecks: Record<number, WordCheck> = {};
  const rowPromises: Array<Promise<void>> = [];

  if (Number.isFinite(rows) && rows > 0) {
    for (let r = 0; r < rows; r++) {
      if (skipped.has(r)) continue;

      const padded = buildRowWordPadded(payload, r);
      rowPromises.push(
        (async () => {
          rowChecks[r] = await checkPaddedWord(padded);
          // console.log(`[LiveScoringPrecheck] Row ${r} check:`, padded, rowChecks[r]);
        })()
      );
    }
  }

  // ✅ Compute anagramCheck as a returned value (no closure mutation → no TS warning)
  const [anagramCheck] = await Promise.all([
    checkAnagram(meta),
    Promise.all(rowPromises),
  ]);

  const shouldCallApi =
    Object.values(rowChecks).some((v) => v === "maybe_valid") ||
    anagramCheck === "maybe_valid";

  return { rowChecks, anagramCheck, shouldCallApi };
}