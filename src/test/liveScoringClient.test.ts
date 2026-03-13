import { describe, it, expect, vi, beforeEach } from "vitest";
import { liveScoringDecisionAndFetch } from "../services/liveScoring/liveScoringClient";

import { LivePayload } from "../services/wordValidation/liveScoringPrecheck";

describe("liveScoringClient", () => {
  const mockPayload: LivePayload = {
    meta: {
      rows: 5,
      cols: 5,
      wordLength: 5,
      skippedRows: [],
      userAnagram: "TEST"
    },
    cells: []
  };

  const mockDeps = {
    precheckRowsAndAnagram: vi.fn(),
    fetchAuthSession: vi.fn(),
    fetch: vi.fn(),
    post: vi.fn(),
    apiUrls: {
      GATEWAY: "https://api.example.com",
      MARGANA_SUBMISSION: "https://api.example.com/live-scoring",
      MARGANA_SUBMISSION_COMMIT: "https://api.example.com/commit",
      ENDPOINTS: {
        MARGANA_SUBMISSION_GUEST: "/live-scoring-guest"
      }
    },
    rowValid: { 0: false, 1: false, 2: false, 3: false, 4: false }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDeps.fetchAuthSession.mockResolvedValue({ tokens: { idToken: { toString: () => "fake-token" } } });
    mockDeps.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ total_score: 100 })
    });
    mockDeps.post.mockReturnValue({
      response: Promise.resolve({
        body: {
          json: async () => ({ total_score: 100 })
        }
      })
    });
  });

  it("should return synthetic response if triggerRow is definitely_invalid", async () => {
    mockDeps.precheckRowsAndAnagram.mockResolvedValue({
      rowChecks: { 0: "definitely_invalid" },
      anagramCheck: "incomplete",
      shouldCallApi: true
    });

    const result = await liveScoringDecisionAndFetch(
      mockPayload,
      { triggerRow: 0 },
      mockDeps,
      50
    );

    expect(result.mode).toBe("synthetic");
    expect(result.reason).toBe("row_definitely_invalid");
    expect(result.data.total_score).toBe(50);
    expect(mockDeps.fetch).not.toHaveBeenCalled();
  });

  it("should call API if triggerRow is maybe_valid", async () => {
    mockDeps.precheckRowsAndAnagram.mockResolvedValue({
      rowChecks: { 0: "maybe_valid" },
      anagramCheck: "incomplete",
      shouldCallApi: true
    });

    const result = await liveScoringDecisionAndFetch(
      mockPayload,
      { triggerRow: 0 },
      mockDeps,
      50
    );

    expect(result.mode).toBe("api");
    expect(result.reason).toBe("maybe_valid");
    expect(result.data.total_score).toBe(100);
    expect(mockDeps.fetch).toHaveBeenCalledWith(
      "https://api.example.com/live-scoring",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Authorization": "Bearer fake-token"
        })
      })
    );
  });

  it("should return synthetic response if anagram is definitely_invalid", async () => {
    mockDeps.precheckRowsAndAnagram.mockResolvedValue({
      rowChecks: {},
      anagramCheck: "definitely_invalid",
      shouldCallApi: true
    });

    const result = await liveScoringDecisionAndFetch(
      mockPayload,
      { triggerAnagram: true, anagramWord: "INVALID" },
      mockDeps,
      50
    );

    expect(result.mode).toBe("synthetic");
    expect(result.reason).toBe("anagram_definitely_invalid");
    expect(mockDeps.fetch).not.toHaveBeenCalled();
  });

  it("should call API if forceApi is true", async () => {
    const result = await liveScoringDecisionAndFetch(
      mockPayload,
      { forceApi: true },
      mockDeps,
      50
    );

    expect(result.mode).toBe("api");
    expect(result.reason).toBe("forced_api");
    expect(mockDeps.fetch).toHaveBeenCalled();
    expect(mockDeps.precheckRowsAndAnagram).not.toHaveBeenCalled();
  });

  it("should return synthetic response if precheck says no API", async () => {
    mockDeps.precheckRowsAndAnagram.mockResolvedValue({
      rowChecks: { 0: "incomplete" },
      anagramCheck: "incomplete",
      shouldCallApi: false
    });

    const result = await liveScoringDecisionAndFetch(
      mockPayload,
      {},
      mockDeps,
      50
    );

    expect(result.mode).toBe("synthetic");
    expect(result.reason).toBe("precheck_says_no_api");
    expect(mockDeps.fetch).not.toHaveBeenCalled();
  });

  it("should call COMMIT API if useCommitEndpoint is true", async () => {
    mockDeps.precheckRowsAndAnagram.mockResolvedValue({
      rowChecks: { 0: "maybe_valid" },
      anagramCheck: "maybe_valid",
      shouldCallApi: true
    });

    const result = await liveScoringDecisionAndFetch(
      mockPayload,
      { useCommitEndpoint: true },
      mockDeps,
      50
    );

    expect(result.mode).toBe("api");
    expect(mockDeps.fetch).toHaveBeenCalledWith(
      "https://api.example.com/commit",
      expect.any(Object)
    );
  });

  it("should return synthetic response with commit_result if precheck fails during commit", async () => {
    mockDeps.precheckRowsAndAnagram.mockResolvedValue({
      rowChecks: { 0: "definitely_invalid" },
      anagramCheck: "incomplete",
      shouldCallApi: true
    });

    const result = await liveScoringDecisionAndFetch(
      mockPayload,
      { useCommitEndpoint: true, triggerRow: 0 },
      mockDeps,
      50
    );

    expect(result.mode).toBe("synthetic");
    expect(result.data.commit_result).toBeDefined();
    expect(result.data.commit_result.accepted).toBe(false);
    expect(mockDeps.fetch).not.toHaveBeenCalled();
  });

  it("should return synthetic response if any word is definitely_invalid during commit", async () => {
    mockDeps.precheckRowsAndAnagram.mockResolvedValue({
      rowChecks: { 0: "maybe_valid", 1: "definitely_invalid" },
      anagramCheck: "maybe_valid",
      shouldCallApi: true
    });

    const result = await liveScoringDecisionAndFetch(
      mockPayload,
      { useCommitEndpoint: true },
      mockDeps,
      50
    );

    expect(result.mode).toBe("synthetic");
    expect(result.reason).toBe("row_definitely_invalid");
    expect(mockDeps.fetch).not.toHaveBeenCalled();
  });

  it("should return synthetic response if anagram is definitely_invalid during commit", async () => {
    mockDeps.precheckRowsAndAnagram.mockResolvedValue({
      rowChecks: { 0: "maybe_valid" },
      anagramCheck: "definitely_invalid",
      shouldCallApi: true
    });

    const result = await liveScoringDecisionAndFetch(
      mockPayload,
      { useCommitEndpoint: true },
      mockDeps,
      50
    );

    expect(result.mode).toBe("synthetic");
    expect(result.reason).toBe("anagram_definitely_invalid");
    expect(mockDeps.fetch).not.toHaveBeenCalled();
  });

  it("should use Amplify post for guests", async () => {
    mockDeps.fetchAuthSession.mockResolvedValue(null); // No session = guest
    mockDeps.precheckRowsAndAnagram.mockResolvedValue({
      rowChecks: { 0: "maybe_valid" },
      anagramCheck: "incomplete",
      shouldCallApi: true
    });

    const result = await liveScoringDecisionAndFetch(
      mockPayload,
      { triggerRow: 0 },
      mockDeps,
      50
    );

    expect(result.mode).toBe("api");
    expect(mockDeps.post).toHaveBeenCalledWith(expect.objectContaining({
      apiName: 'MarganaApi',
      path: "/live-scoring-guest/anon",
      options: expect.objectContaining({
        body: mockPayload
      })
    }));
    expect(mockDeps.fetch).not.toHaveBeenCalled();
  });
});
