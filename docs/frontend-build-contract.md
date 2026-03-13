# Frontend Build Contract

This repository is the standalone Vue frontend for Margana. It no longer builds inside the old monorepo, so CI and local builds must supply the few inputs that used to be implicit.

## Required build inputs

The frontend build depends on:

- Node.js `^20.19.0 || >=22.12.0`
- `package-lock.json` for deterministic `npm ci`
- environment values for the selected Vite mode (`preprod`, `prod`, or local)
- a build-time copy of `build-assets/margana-word-list.txt`

## Build-time asset contract

`scripts/build-xor-filter.ts` reads:

- `build-assets/margana-word-list.txt`

and writes:

- `src/assets/word-filters/word-filter-len-3.json`
- `src/assets/word-filters/word-filter-len-4.json`
- `src/assets/word-filters/word-filter-len-5.json`
- `src/assets/word-filters/word-filter-len-6.json`
- `src/assets/word-filters/word-filter-len-7.json`
- `src/assets/word-filters/word-filter-len-8.json`
- `src/assets/word-filters/word-filter-len-9.json`
- `src/assets/word-filters/word-filter-len-10.json`

The canonical source of `margana-word-list.txt` is expected to live outside Git. CI should fetch it from the static-assets bucket before running `npm run build:wordfilter`.

## Temporary duplicated or shared config

`badge-milestones.json` now lives in this repo at [`src/resources/badge-milestones.json`](/Users/paulbradbury/IdeaProjects/margana-web/src/resources/badge-milestones.json) so the frontend no longer imports from the old monorepo-only `python/` path.

`letter-scores-v3.json` is also frontend-owned at [`src/resources/letter-scores-v3.json`](/Users/paulbradbury/IdeaProjects/margana-web/src/resources/letter-scores-v3.json), while the wider split plan still treats letter scores as shared scoring configuration across frontend and backend packaging.

These should be treated as temporary split-era duplication or shared-config exceptions. After the monorepo split work is complete, clean this up by choosing a single source of truth for each shared config file and defining how the other repo consumes it.

## Expected build sequence

From a clean checkout, the minimal frontend build sequence is:

```sh
npm ci
npm run build:wordfilter
npm run build:preprod
```

For production mode, replace the last command with `npm run build:prod`.

## Failure expectations

The build should fail fast when:

- `build-assets/margana-word-list.txt` is missing
- the AWS-authenticated CI job cannot read the canonical word list object
- required Vite environment variables are missing for the selected mode

## Environment ownership

At the time of the split, `.env.preprod` and `.env.prod` remain committed bootstrap snapshots for the frontend. They should be treated as environment configuration owned by deployment, not as durable application defaults.

Recommended direction:

- keep `.env.example` as the developer-facing contract
- prefer GitHub Environment variables or a generated env file for CI-managed values
- avoid introducing new secret values into committed `.env.*` files
