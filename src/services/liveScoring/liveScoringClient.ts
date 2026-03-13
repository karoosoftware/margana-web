import { 
  LiveScoringOptions, 
  LiveScoringDependencies, 
  LiveScoringResult 
} from "./types";
import { buildSyntheticResponse } from "./syntheticResponse";
import { LivePayload } from "@/services/wordValidation/liveScoringPrecheck";
import { useTutorial } from "@/composables/useTutorial";

export async function liveScoringDecisionAndFetch(
  payload: LivePayload,
  opts: LiveScoringOptions,
  deps: LiveScoringDependencies,
  currentLiveTotalScore: number
): Promise<LiveScoringResult> {
  const { isTutorialActive, currentStep } = useTutorial()
  if (isTutorialActive.value && currentStep.value?.response) {
    // console.log("[LiveScoringClient] Tutorial Mode: Returning mocked response")
    return {
      mode: "api",
      reason: "maybe_valid",
      data: currentStep.value.response,
      meta: { prechecked: true, triggerRow: opts.triggerRow, triggerAnagram: !!opts.triggerAnagram }
    }
  }

  const forceApi = !!opts.forceApi;
  const triggerRow = opts.triggerRow !== undefined ? opts.triggerRow : null;
  const triggerAnagram = !!opts.triggerAnagram;
  const anagramWord = opts.anagramWord;

  if (triggerAnagram && anagramWord != null) {
    if (payload.meta) {
      payload.meta.userAnagram = String(anagramWord).toUpperCase();
    }
  }

  const disableXorPrecheck = import.meta.env.VITE_DISABLE_XOR_PRECHECK === "true";

  if (!forceApi && !disableXorPrecheck) {
    const pre = await deps.precheckRowsAndAnagram(payload);
    // console.log("[LiveScoringClient] Precheck result:", pre);

    if (triggerAnagram) {
      if (pre.anagramCheck === "definitely_invalid") {
        // console.log("[LiveScoringClient] Synthetic: anagram definitely invalid");
        return {
          mode: "synthetic",
          reason: "anagram_definitely_invalid",
          data: buildSyntheticResponse(payload, pre.rowChecks, currentLiveTotalScore, { 
            triggerAnagram: true, 
            anagramCheck: pre.anagramCheck,
            rowValid: deps.rowValid
          }),
          meta: { prechecked: true, triggerAnagram: true }
        };
      }
    }

    if (triggerRow != null) {
      const trigStatus = pre.rowChecks[triggerRow] ?? pre.rowChecks[String(triggerRow) as any];
      if (trigStatus === "definitely_invalid") {
        // console.log("[LiveScoringClient] Synthetic: row definitely invalid", { triggerRow, trigStatus });
        return {
          mode: "synthetic",
          reason: "row_definitely_invalid",
          data: buildSyntheticResponse(payload, pre.rowChecks, currentLiveTotalScore, { 
            triggerRow,
            rowValid: deps.rowValid
          }),
          meta: { prechecked: true, triggerRow }
        };
      }
    } else {
      // General refresh or Commit mode
      const hasInvalid = Object.values(pre.rowChecks).some(v => v === "definitely_invalid") || pre.anagramCheck === "definitely_invalid";
      
      if (opts.useCommitEndpoint && hasInvalid) {
        // console.log("[LiveScoringClient] Synthetic: commit blocked due to definitely_invalid word");
        return {
          mode: "synthetic",
          reason: pre.anagramCheck === "definitely_invalid" ? "anagram_definitely_invalid" : "row_definitely_invalid",
          data: buildSyntheticResponse(payload, pre.rowChecks, currentLiveTotalScore, {
            rowValid: deps.rowValid,
            triggerAnagram: pre.anagramCheck === "definitely_invalid"
          }),
          meta: { prechecked: true }
        };
      }

      if (pre.shouldCallApi === false) {
        // console.log("[LiveScoringClient] Synthetic: precheck says no API");
        return {
          mode: "synthetic",
          reason: "precheck_says_no_api",
          data: buildSyntheticResponse(payload, pre.rowChecks, currentLiveTotalScore, {
            rowValid: deps.rowValid
          }),
          meta: { prechecked: true }
        };
      }
    }
  }

  // console.log("[LiveScoringClient] Proceeding to API call", { forceApi, useCommitEndpoint: opts.useCommitEndpoint });

  try {
    const session = await deps.fetchAuthSession().catch(() => null);
    const idToken = session?.tokens?.idToken?.toString();
    const isGuest = !idToken;
    
    let data: any;
    if (isGuest) {
      // For Guests, we use the specific guest endpoint with SigV4 signing via Amplify
      // This ensures even unauthenticated users are signed via Cognito Identity Pool.
      const gid = localStorage.getItem('margana.guest_id') || 'anon';
      const res = await deps.post({
        apiName: 'MarganaApi',
        path: `${deps.apiUrls.ENDPOINTS.MARGANA_SUBMISSION_GUEST}/${gid}`,
        options: {
          body: payload
        }
      }).response;
      data = await res.body.json();
    } else {
      // Registered Users: use standard fetch with Bearer token
      // Both commit and live scoring now use standard fetch with Bearer token.
      const useCommit = !!opts.useCommitEndpoint;
      const url = useCommit ? deps.apiUrls.MARGANA_SUBMISSION_COMMIT : deps.apiUrls.MARGANA_SUBMISSION;

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`
      };

      const res = await deps.fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => "unknown");
        console.error("[LiveScoringClient] API Error:", res.status, errorText);
        throw new Error(`Status ${res.status}`);
      }
      data = await res.json();
    }

    return {
      mode: "api",
      reason: forceApi ? "forced_api" : "maybe_valid",
      data,
      meta: { prechecked: !forceApi, triggerRow, triggerAnagram }
    };
  } catch (e) {
    console.error("[LiveScoringClient] API call failed:", e);
    return {
      mode: "api",
      reason: "api_error",
      data: null,
      meta: { prechecked: !forceApi, triggerRow, triggerAnagram, error: (e as Error).message }
    };
  }
}
