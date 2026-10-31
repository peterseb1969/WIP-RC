#!/bin/sh
# Canonical dev-container entrypoint from CASE-58 (CT-YAC wrote this pattern;
# RC adopts verbatim minus the file:../libs/ tarball linking, which RC doesn't
# need — libs/ lives inside the bind-mounted source dir).
#
# Handles:
#   1. First-start populate: named volume /app/node_modules is empty → npm ci.
#   2. Staleness: package-lock.json, the Node version or the image's libc
#      changed → npm ci. A base-image bump with an unchanged lockfile must
#      re-install too: packages with native add-ons (rollup, esbuild) are
#      built for one Node and one libc, and the named volume outlives the image.
#   3. Corrupted install (killed mid-install): .package-lock.json absent → retry.
set -e

NODE_MODULES=/app/node_modules
LOCKFILE=/app/package-lock.json
HASH_MARKER="$NODE_MODULES/.wip-lock-hash"

current_hash() {
  [ -f "$LOCKFILE" ] && {
    cat "$LOCKFILE"
    node -v
    if [ -e /etc/alpine-release ]; then echo musl; else echo glibc; fi
  } | sha256sum | cut -c1-64
}

run_install() {
  echo "[dev-entrypoint] $1"
  (cd /app && npm ci --prefer-offline)
  current_hash > "$HASH_MARKER"
}

if [ ! -f "$NODE_MODULES/.package-lock.json" ]; then
  run_install "node_modules empty — running npm ci (first run, expect 30-60s)"
elif [ "$(current_hash)" != "$(cat "$HASH_MARKER" 2>/dev/null)" ]; then
  run_install "package-lock.json, Node version or libc changed — re-running npm ci"
fi

exec "$@"
