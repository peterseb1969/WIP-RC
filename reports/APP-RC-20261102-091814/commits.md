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

## 772be22 — chore: scaffold refresh — @wip/client 0.73.0
**Time:** 2026-11-02 16:45
**Author:** Peter S <189785956+peterseb1969@users.noreply.github.com>
**Files:** 14 changed, +13/-11
**Tests:** not recorded
**Why:** The refresh brings @wip/client 0.73.0, which has the calls for runtime
namespace reservations on API keys (create with reserve, widen and
narrow a key by one namespace, list and release reservations) and, from
0.72.0, shadowed_by on key info and the revoked grants in revoke's
result. It also brings wip-toolkit and wip-archive 0.24.0 and small doc
updates. CLAUDE.md's fresh render differed only in RC's own description,
key-file path and master-key note, so it was not taken.

Tests: tsc clean; unit 336/336
Discovered: Scaffold tarballs are tracked although .gitignore lists *.tgz, so a refresh's new tarball must be added with git add -f

## 6ff5ecc — feat: create an API key that reserves its namespaces
**Time:** 2026-11-02 16:49
**Author:** Peter S <189785956+peterseb1969@users.noreply.github.com>
**Files:** 7 changed, +666/-105
**Tests:** not recorded
**Why:** A key that is not a platform admin may create a namespace only if the
namespace is reserved and the key holds admin on it. Until now only
wip-deploy made reservations, so a key from the Console could not
bootstrap an app. The Registry now takes reservations on key create.

The create dialog lists namespaces one row each, typed or picked from the
install's namespaces, instead of a comma-separated field. A row for a
namespace that does not exist yet can be marked Reserve, which opens its
six settings filled with the platform defaults; deletion mode "full" and
inbound references "open" carry a warning. A namespace that exists can't
be reserved: a reservation never changes an existing namespace, so the
dialog points to the admin permission instead. Only settings that differ
from the defaults are sent. The permission selector now grants on the
namespaces not reserved, since a reserved one always gets admin. When a
row is reserved, the dialog says that reserving is for apps wip-deploy
does not manage.

The creation banner lists the reserved namespaces and the other grants.
The key list shows how many namespaces a runtime key reserves, and
flags a key shadowed by a config key with the same plaintext, which does
not authenticate. The API-key hooks moved to src/hooks/use-api-keys.ts
so the new components can share them.

Tests: tsc clean; unit 345/345 (9 new); E2E not run yet (the dev container needs a restart onto @wip/client 0.73.0)

## a71e2a6 — feat: a key's namespaces change through widen and narrow, never the key update
**Time:** 2026-11-02 16:51
**Author:** Peter S <189785956+peterseb1969@users.noreply.github.com>
**Files:** 3 changed, +320/-17
**Tests:** not recorded
**Why:** The key update (PATCH /api-keys/{name}) sets a key's namespace list and
nothing else. RC's edit form sent the namespaces through it, so a
namespace removed there kept the key's grant on it, which then applied
again if the namespace was re-added, and a namespace added there got no
grant, leaving the key read-only on it. The Registry now also refuses a
PATCH that drops a reserved namespace.

The edit form no longer has a namespaces field and PATCH no longer sends
them. A scoped runtime key's namespaces show as chips. Removing one asks
first, then calls removeAPIKeyNamespace, which revokes the grant and
releases a reservation whose namespace was never created; the result
says whether the reservation was released or kept. Adding one calls
addAPIKeyNamespace with read, write or admin, or reserves it with its
settings; reserving is not offered for a namespace that exists. Keys
with no namespace scope get no editor, since the Registry has no scope
to widen for them.

Tests: tsc clean; unit 352/352 (7 new); E2E not run yet (the dev container needs a restart onto @wip/client 0.73.0)
Discovered: Before this change, removing a namespace in RC's key edit form left the key's grant on that namespace behind

## 042e92e — feat: revoking a key reports its reservations; the API Keys page lists every reservation
**Time:** 2026-11-02 16:53
**Author:** Peter S <189785956+peterseb1969@users.noreply.github.com>
**Files:** 3 changed, +249/-3
**Tests:** not recorded
**Why:** Revoking a runtime key now also revokes its grants and handles its
namespace reservations: one whose namespace was never created is
released, one whose namespace exists is kept for an operator to release.
The confirmation says so, and that no namespace is deleted. After the
revoke, a banner lists the grants revoked and the reservations released
and kept, with a Release button for each kept one.

A new section on the API Keys page lists every namespace reservation:
those wip-deploy's file makes for the apps it manages and those runtime
keys hold. Each shows its holder, whether the namespace exists yet, and
the settings it will be created with. A conflict, where both sources
reserve one prefix, is highlighted, because the namespace upsert refuses
that prefix until one side is removed. Runtime reservations can be
released here; the file's are left to wip-deploy.

Tests: tsc clean; unit 355/355 (3 new); E2E not run yet (the dev container needs a restart onto @wip/client 0.73.0)

## afb95b2 — test: E2E for API key reservations; changelog and dependency docs
**Time:** 2026-11-02 17:04
**Author:** Peter S <189785956+peterseb1969@users.noreply.github.com>
**Files:** 4 changed, +133/-6
**Tests:** not recorded
**Why:** A new spec drives the reservation flow through the UI against the
default install: create a key that reserves an uncreated namespace with
a non-default setting (and checks that the Registry holds what the
dialog sent), widen it with the run's namespace (reserving is not
offered there, since it exists), have an invalid prefix refused with
the Registry's reason, narrow the reserved namespace and see its
reservation released, and revoke the key and see its grant revoked. It
never creates a namespace, so it does not depend on which apps an
install's wip-deploy manages, and it cleans up the key and the
reservation if a step fails.

The existing API key spec selected the key's row by a regex that now
also matches the namespace chips' remove buttons, so it is anchored to
the start of the name. CHANGELOG has the entry for the feature, and
WIP_DEPENDENCIES moves to @wip/client 0.73.0 and @wip/proxy 0.6.0 (it
still said 0.54.0 and 0.5.1) and lists the reservation endpoints.

Tests: tsc clean; unit 355/355; full E2E 82/82 (2.4 min) against the default install after the dev container restart onto @wip/client 0.73.0; no E2E key or runtime reservation left behind
