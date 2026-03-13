# Required Environment Variables

This document lists the current Vite environment contract used by the frontend code.

## Required for app startup

These values are read directly by [`src/config/api.ts`](/Users/paulbradbury/IdeaProjects/margana-web/src/config/api.ts):

- `VITE_API_GATEWAY`
- `VITE_API_ENDPOINT_MARGANA_COMMIT_WORDS`
- `VITE_API_ENDPOINT_MARGANA_VALIDATE_WORDS`
- `VITE_API_ENDPOINT_MARGANA_ACCEPT_INVITE`
- `VITE_API_ENDPOINT_MARGANA_CREATE_GROUP`
- `VITE_API_ENDPOINT_MARGANA_SEND_GROUP_INVITE`
- `VITE_API_ENDPOINT_MARGANA_UPDATE_GROUP_PENDING`
- `VITE_API_ENDPOINT_MARGANA_TERMS_AUDIT`
- `VITE_API_ENDPOINT_MARGANA_TERMS_AUDIT_GUEST`
- `VITE_API_ENDPOINT_MARGANA_SEND_FRIEND_INVITE`
- `VITE_API_ENDPOINT_MARGANA_GET_GROUP`
- `VITE_API_ENDPOINT_MARGANA_METRIC`
- `VITE_API_ENDPOINT_USER_SETTINGS`
- `VITE_API_ENDPOINT_PROFILE`
- `VITE_API_ENDPOINT_CHECK_USERNAME`
- `VITE_API_ENDPOINT_MARGANA_SUBMISSION`
- `VITE_API_ENDPOINT_MARGANA_SUBMISSION_GUEST`
- `VITE_API_ENDPOINT_MARGANA_SUBMISSION_COMMIT`
- `VITE_API_ENDPOINT_MARGANA_DASHBOARD_SUMMARY`
- `VITE_API_ENDPOINT_LEADERBOARDS`
- `VITE_API_ENDPOINT_LEADERBOARDS_PUBLIC`
- `VITE_USER_POOL_ID`
- `VITE_USER_POOL_CLIENT_ID`
- `VITE_IDENTITY_POOL_ID`
- `VITE_MARGANA_WORD_GAME`
- `VITE_MARGANA_GAME_RESULTS`

## Required when analytics uploads are enabled

These values are read by [`src/usage/ActivityTracker.ts`](/Users/paulbradbury/IdeaProjects/margana-web/src/usage/ActivityTracker.ts):

- `VITE_MARGANA_ANALYTICS_BUCKET`

If `VITE_MARGANA_ANALYTICS_REGION` is omitted, the client defaults to `eu-west-2`.

## Optional feature flags and metadata

- `VITE_USAGE_ENABLED`
- `VITE_USAGE_RETENTION_DAYS`
- `VITE_USAGE_DEBUG_LOG`
- `VITE_USAGE_DUAL_WRITE`
- `VITE_USAGE_LAYOUT`
- `VITE_USAGE_DEBUG_DELAY_CLEAR_MS`
- `VITE_APP_VERSION`
- `VITE_DISABLE_XOR_PRECHECK`

## Current committed env files

The split currently keeps `.env.preprod` and `.env.prod` committed so the frontend can still build with the known AWS resource identifiers already in use.

Those files contain deploy-time identifiers, not application secrets. The long-term target should still be CI- or environment-managed configuration so infrastructure-owned values are not maintained by hand in Git.
