# Commits — APP-RC-20261102-091814

## 77ca5a9 — chore: update dependencies within their declared ranges
**Time:** 2026-11-02 09:22
**Author:** Peter S <189785956+peterseb1969@users.noreply.github.com>
**Files:** 1 changed, +931/-830
**Tests:** not recorded
**Why:** npm update moved packages to the newest versions their package.json
ranges allow, without changing any range. npm audit goes from 26
advisories to 1 low one: esbuild's dev-server file read on Windows,
which RC cannot reach. The only automatic fix for it downgrades esbuild;
moving tsx to 4.23.x (esbuild ~0.28) is the proper route, left for later.

This is step 3 of the Node 20 end-of-life work. The dev container already
runs on this lockfile: its entrypoint hash marker matches it, and the
installed versions of vite, react-router-dom and @tanstack/react-query
match the lockfile's.

Tests: tsc clean; unit 336/336; full E2E 77/77 (2.5 min) against the default install
Discovered: The dev container picked up this lockfile on its own last restart, so no extra restart was needed
