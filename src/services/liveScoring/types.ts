import { WordCheck, LivePayload } from "@/services/wordValidation/liveScoringPrecheck";

export type LiveScoringMode = "synthetic" | "api";

export type LiveScoringReason =
  | "row_definitely_invalid"
  | "anagram_definitely_invalid"
  | "precheck_says_no_api"
  | "forced_api"
  | "maybe_valid"
  | "api_success"
  | "api_error";

export interface LiveScoringResult {
  mode: LiveScoringMode;
  reason: LiveScoringReason;
  data: any; // The response (synthetic or real)
  meta: {
    prechecked: boolean;
    triggerRow?: number | null;
    triggerAnagram?: boolean;
    [key: string]: any;
  };
}

export interface LiveScoringOptions {
  forceApi?: boolean;
  triggerRow?: number | null;
  triggerAnagram?: boolean;
  anagramWord?: string | null;
  useCommitEndpoint?: boolean;
}

export interface LiveScoringDependencies {
  precheckRowsAndAnagram: (payload: LivePayload) => Promise<{
    rowChecks: Record<number, WordCheck>;
    anagramCheck: WordCheck;
    shouldCallApi: boolean;
  }>;
  fetchAuthSession: () => Promise<any>;
  fetch: typeof fetch;
  post: (input: any) => { response: Promise<any> };
  apiUrls: {
    GATEWAY: string;
    MARGANA_SUBMISSION : string;
    MARGANA_SUBMISSION_COMMIT: string;
    ENDPOINTS: {
      MARGANA_SUBMISSION_GUEST: string;
    };
  };
  rowValid: Record<number, boolean>;
}
