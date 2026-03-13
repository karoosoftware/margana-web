Build-time assets for the frontend pipeline live here.

CI/CD should fetch the canonical `margana-word-list.txt` from the static assets bucket and place it in this directory before running `npm run build:wordfilter`.
