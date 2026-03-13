# Margana Web

Vue frontend for Margana.

## Setup

```sh
npm ci
```

## Development

```sh
npm run dev
npm run dev:preprod
```

## Build

The XOR word filters depend on a build-time copy of `build-assets/margana-word-list.txt`.

```sh
npm run build:wordfilter
npm run build
```

## Notes

- `src/` and `public/` are the frontend application surface.
- `scripts/build-xor-filter.ts` is currently the only required migrated script.
- The canonical word list should be fetched by CI/CD into `build-assets/` before running `npm run build:wordfilter`.
- Split-specific docs:
  - `docs/frontend-build-contract.md`
  - `docs/required-env-vars.md`
  - `docs/REPO_SPLIT_STRATEGY.md`
  - `docs/deployment-inventory.md`
