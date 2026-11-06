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

## 21a6fb0 — fix: Refresh re-reads the namespace counts on the Dashboard and Namespaces pages
**Time:** 2026-11-03 01:52
**Author:** Peter S <189785956+peterseb1969@users.noreply.github.com>
**Files:** 5 changed, +206/-8
**Tests:** not recorded
**Why:** The document counts on these two pages come from per-namespace stats
queries of their own, cached for a minute. The Dashboard's only Refresh
re-checked service health, and the Namespaces page's Refresh refetched
the namespace list, so neither touched the counts: while an install
filled a namespace the numbers stayed put until a browser reload.

The Dashboard's Namespaces section gets its own Refresh, which re-reads
the namespace list and then every namespace's counts (the stats hook now
returns a refresh for this). The health button keeps re-checking health
only, as its tooltip says. The Namespaces page's Refresh now also
re-reads the expanded namespace's counts. The other pages with a Refresh
button show counts from the query that button refetches; the documents
list, checked in a browser, picks up a new document on Refresh.

A new E2E spec writes documents through the API between two reads and
checks that each Refresh shows them. With the fix stashed it fails as
reported (the Dashboard count stayed where it was).

Tests: tsc clean; unit 355/355; full E2E 83/83 (3.4 min) against the default install
Discovered: The first version of the spec compared fixed counts and passed alone but failed in the full suite, where other specs had already put 137 documents in the run namespace; it now compares with the count read at the start

## b0c238a — feat: the documents list shows when it is refreshing and takes no second click
**Time:** 2026-11-03 21:21
**Author:** Peter S <189785956+peterseb1969@users.noreply.github.com>
**Files:** 3 changed, +150/-8
**Tests:** not recorded
**Why:** On a large namespace the documents list takes seconds to re-read (6.5 s
for a page of 25 on a namespace of 222k documents), and nothing showed
that a refresh was running. A second click made it worse: refetch()
cancels the running request and starts it again, so each impatient click
restarted the wait.

A shared RefreshButton spins and reads "Refreshing…" while the data
behind it is being read, whether from a click or from TanStack re-reading
on its own (e.g. on returning to the tab), and is disabled meanwhile.
RefreshingValue keeps a count on screen but dims and pulses it, with an
"updating…" tag beside it and "(updating)" for screen readers. On the
documents list (one template or all) the count and the rows are marked
this way, and the refresh no longer cancels a running read. A refresh
that fails now keeps the documents last read, with an inline error and
Retry, instead of replacing them with an error page; only a first load
that fails shows the error page.

Tests: tsc clean; unit 358/358 (3 new); E2E not run yet

## e5fe2ea — feat: every Refresh button shows a running read and takes no second click
**Time:** 2026-11-03 21:24
**Author:** Peter S <189785956+peterseb1969@users.noreply.github.com>
**Files:** 16 changed, +133/-150
**Tests:** not recorded
**Why:** The shared RefreshButton and RefreshingValue from the documents list now
serve every Refresh on the console: templates, terminologies and their
terms, files, the documents table view, activity and the audit log,
API keys and reservations, namespaces, registered views, NATS streams,
the Dashboard's health, namespace counts and integrity re-check, and
Backup's recent jobs. Each spins and reads "Refreshing…" while its data
is being read, including when TanStack re-reads on its own, ignores
clicks meanwhile and no longer cancels a running read. The counts each
one refreshes stay on screen, dimmed and pulsing: list totals, the
Dashboard's totals and per-namespace counts, an expanded namespace's
counts, a stream's messages, storage and consumers, a parity result,
and the integrity summary, whose re-run no longer shows the first-run
spinner above an old result.

The Database settings and Parity buttons already spun and disabled
themselves; they stay as they are, with the parity counts now dimmed
while a re-check runs. Integrity's Run Check was already disabled while
running. The PostgreSQL page's Batch Sync tab icon is not a button.

Tests: tsc clean; unit 358/358; E2E not run yet

## 90fcaae — feat: opt-in auto-refresh on the documents list
**Time:** 2026-11-03 21:25
**Author:** Peter S <189785956+peterseb1969@users.noreply.github.com>
**Files:** 3 changed, +150/-0
**Tests:** not recorded
**Why:** For watching a namespace fill, during an install for example, the
documents list (one template or all) gets an Auto toggle next to
Refresh. While it is on, the list re-reads 5 s after each read finishes:
the next read is scheduled only when the previous one is done, so reads
never overlap, which matters where one read takes seconds (6.5 s on a
namespace of 222k documents). Nothing is read while the browser tab is
hidden; the read that was due runs when it is shown again. The count
and rows show each read the way a Refresh does. The toggle is off on
every visit, because each read of a large namespace costs the platform
seconds.

Tests: tsc clean; unit 363/363 (5 new: the scheduling, no read during a read, a new callback each render, hidden tab, switching off); E2E not run yet

## 4d69958 — test: E2E for a running refresh and for auto-refresh on the documents list
**Time:** 2026-11-03 21:32
**Author:** Peter S <189785956+peterseb1969@users.noreply.github.com>
**Files:** 3 changed, +157/-0
**Tests:** not recorded
**Why:** The test holds the documents request in the browser so the in-between
state can be checked on any install: while it is held the button reads
"Refreshing…" and is disabled, the count is marked as updating, and a
forced second click sends no second request. Once released the button
and count return to normal. With Auto on, a document written through the
API shows in the count without a click. The spec's namespace check now
names its button by its new label. CHANGELOG has the entry.

Tests: tsc clean; unit 363/363; full E2E 84/84 (2.5 min) against the default install
Discovered: In the full suite the run namespace holds enough templates that the documents page shows a dropdown instead of cards, so the test selects its template through the URL, as the other specs do

## 50a5c48 — chore: scaffold refresh — @wip/client 0.75.0, @wip/react 0.25.0
**Time:** 2026-11-03 23:06
**Author:** Peter S <189785956+peterseb1969@users.noreply.github.com>
**Files:** 14 changed, +53/-32
**Tests:** not recorded
**Why:** @wip/client 0.75.0 adds managed_by and origin on API keys, managed_by on
grants and reservations, the MANAGED_BY_DEPLOYER error code, and error
items on grant revokes: the Registry now imports the install's key file
and reservations file as records wip-deploy owns, and refuses API writes
to them. @wip/client 0.74.0 and @wip/react 0.25.0 drop the requalify
identity synonyms call and its hook, whose endpoint is gone; RC never
used them, and the maintenance gate's comment no longer names it. The
refresh also brings wip-toolkit 0.24.1 and doc updates. CLAUDE.md's
fresh render was not taken, as before.

Tests: tsc clean; unit 363/363

## a0e8abe — feat: keys, grants and reservations wip-deploy owns are read-only in the console
**Time:** 2026-11-03 23:20
**Author:** Peter S <189785956+peterseb1969@users.noreply.github.com>
**Files:** 10 changed, +410/-30
**Tests:** not recorded
**Why:** The Registry now imports the install's key file and reservations file as
records marked managed_by: wip-deploy and refuses every API write to
them (409, error_code managed_by_deployer). The console decides on
managed_by, never on source, since a deployer key is listed as a config
entry now and as a stored record once the services switch over.

- API keys: a managed key gets a "wip-deploy" badge and no Edit, Revoke
  or namespace editor. In their place it names the command to use,
  wip-deploy app-namespace add|remove <app> <namespace> and
  wip-deploy rotate-key <key> (both checked against the deployer's CLI).
  A key restored from another install gets a "restored" badge and stays
  editable. The "not covered by backups" warning shows only on keys the
  console can change.
- Grants (Namespaces page): a managed grant shows "wip-deploy" instead
  of a revoke button. A grant to a key whose grants the key file
  declares (its grants field is set, even to {}) is not offered: the
  form says why and the Grant button is disabled. A revoke the Registry
  refuses per item, inside a 200, used to look like success; it now
  shows the error.
- Reservations: no Release on managed rows, whatever their source, and
  the conflict text no longer claims the namespace can't be created
  (current Registries never report one).
- A key, grant or reservation write refused with managed_by_deployer,
  from a stale view or another tab, shows the refusal and re-reads the
  listing, so the record turns read-only on screen.

The grants query key moved into the key hooks module, which the grants
panel now imports for the key list, so the two don't import each other.

Tests: tsc clean; unit 376/376 (13 new); full E2E 87/87 (2.6 min) against the default install on @wip/client 0.75.0, including a new spec that checks the install's own managed key, grant and reservation read-only without changing them

## 6207340 — feat: an expanded namespace shows live and retired contents, with its own Refresh
**Time:** 2026-11-04 16:57
**Author:** Peter S <189785956+peterseb1969@users.noreply.github.com>
**Files:** 7 changed, +307/-46
**Tests:** not recorded
**Why:** The expanded namespace showed the Registry's per-namespace counts. Those
count every entity the Registry ever registered, soft-deleted ones
included (kb: 5,908 documents = 5,885 live + 23 deleted), so deleting
never lowered them, and watching a namespace showed additions only.

Each kind now shows its live count with its retired count beneath,
read from the service that owns the data:
- documents: latest_only active and inactive totals;
- templates: from every version grouped by template, live while any
  version is active (latest_only with status=inactive returns
  superseded versions of live templates, so it can't count retired ones);
- terminologies: active and inactive totals;
- terms: the active terms (the sum of each terminology's term_count,
  which counts active terms), with the deprecated ones as the Registry's
  term count minus that, since a hard-deleted term leaves the Registry;
- files: active plus orphan (orphans named), and deleted.

Terms and files are new. The Registry's figure stays in each card's
tooltip. A Refresh next to the counts re-reads the namespace's settings,
counts and grants, with the shared spinner and dimmed counts; the page's
own Refresh re-reads the counts too, as before. The refresh E2E now
checks that a deletion shows: one fewer live, one more deleted.

Tests: tsc clean; unit 380/380 (4 new); full E2E 87/87 (2.6 min) against the default install
Discovered: The Dashboard's totals still come from the Registry's counts, deleted entities included

## 5be5aa1 — chore: scaffold refresh — @wip/client 0.77.0
**Time:** 2026-11-04 21:09
**Author:** Peter S <189785956+peterseb1969@users.noreply.github.com>
**Files:** 9 changed, +332/-51
**Tests:** not recorded
**Why:** @wip/client 0.76.0 and 0.77.0 add the system backup and restore
(systemBackup, systemRestore with mode upsert, overwrite or mirror, and
expect for the dry run's plan digest), attachment records
(upsertAttachments, deactivateAttachments, listAttachments,
getAttachment), orphaned grants (listAllGrants, activateGrants,
Grant.orphaned) and typed error codes (SALT_MISMATCH, RESTORE_REFUSED,
PLAN_CHANGED, wipErrorCode). The refresh also brings wip-toolkit 0.25.6
and doc updates. CLAUDE.md's fresh render was not taken, as before.

Tests: tsc clean; unit 380/380

## 2a977e8 — feat: a System tab on Backup & Restore for the Registry's auth state
**Time:** 2026-11-04 21:12
**Author:** Peter S <189785956+peterseb1969@users.noreply.github.com>
**Files:** 5 changed, +556/-4
**Tests:** not recorded
**Why:** The Registry can back up and restore its auth state as one archive:
every API key (bcrypt hash, never the key), grant, namespace
reservation and app attachment. The new System tab on Backup & Restore
does both.

- Download saves the archive as a JSON file, named by host and time,
  with a note that it holds every key hash and the key salt. The
  console only holds it in memory on the way to the file.
- Restore reads an uploaded archive (only its envelope is checked here;
  the Registry checks every record), lets the operator pick upsert,
  overwrite or mirror and whether to restore user grants from another
  login provider, and always runs a dry run first. The report leads
  with the Registry's warnings (for example, that the stack holds auth
  state of its own), says whether the archive's salt would be adopted,
  lists refusals, and counts per section (keys, grants, reservations,
  attachments) what would be created, replaced, unchanged, skipped
  (with each reason), orphaned, unresolved, deleted or deactivated,
  with the records behind each number.
- Apply applies exactly the reviewed plan: changing the file or an
  option drops the dry run. A plan with refusals can't be applied. A
  mirror needs "mirror" typed first and sends the dry run's plan digest,
  so the Registry refuses it if what it would remove has changed.
- The coded refusals are explained: a salt this stack can't take (the
  archive's key hashes would not work here; retrying doesn't help), a
  restore that would remove or replace the console's own key, and a
  mirror whose plan changed since the dry run.

Peter chose no extra admin gate in RC's server for these endpoints for
now; the gateway limits RC to wip-admins.

Tests: tsc clean; unit 389/389 (9 new); E2E not run yet (the dev container needs a restart onto @wip/client 0.77.0)

## d1ac4e1 — feat: orphaned grants are listed with what activates them
**Time:** 2026-11-04 21:13
**Author:** Peter S <189785956+peterseb1969@users.noreply.github.com>
**Files:** 6 changed, +322/-0
**Tests:** not recorded
**Why:** A system restore writes a grant on a namespace the stack neither has
nor reserves as orphaned: it gives nothing until activated. A platform
admin creating the namespace activates every orphan on it; a namespace
admin can activate one on an existing namespace; a reservation holder
creating the namespace activates nothing.

- API Keys page: an "Orphaned grants" section (beside Reservations)
  lists every orphan from the Registry's global listing, since an
  orphan's namespace usually doesn't exist and so has no grants panel to
  show it. Each row has namespace, subject, permission, when it was
  orphaned, and the namespace's state: exists (with Activate), absent
  and reserved (named, with the note that the holder creating it will
  not activate the grant), or absent (activates when a platform admin
  creates it). Revoke asks first. wip-deploy's records get no actions.
- Namespaces page: a grant still orphaned on an existing namespace is
  marked "orphaned" in that namespace's Grants panel, with Activate.
- Activate and revoke are bulk-first calls; a per-item error is shown,
  not taken as success.

Tests: tsc clean; unit 393/393 (4 new); E2E not run yet (the dev container needs a restart onto @wip/client 0.77.0)

## 32fec92 — feat: an Attachments page for apps served at /apps/<name> that wip-deploy doesn't deploy
**Time:** 2026-11-04 21:16
**Author:** Peter S <189785956+peterseb1969@users.noreply.github.com>
**Files:** 9 changed, +622/-5
**Tests:** not recorded
**Why:** The Registry now holds attachment records: an app the router's app edge
serves at /apps/<name>, proxied to an upstream, behind the auth gateway
or not. A new Attachments page under Admin manages them.

- The list shows each record's path, upstream, status and whether
  wip-deploy manages it; inactive records are hidden until asked for.
  Expanded, a record shows its login rule, health path and TLS setting,
  a link to open it, and the keys whose owner is app:<name>, the
  convention that ties a key to an attached app without a field. "Create
  a key for <name>" opens the API Keys create form with that owner.
- Attach and Edit use one form with every field, since a write replaces
  the whole record: name (fixed on edit; the path is /apps/<name>),
  upstream (scheme, host and port), display name, health path, login
  required and allowed groups, the proxy options, and upstream TLS
  (verify, and an optional CA as PEM). New records start with the
  Registry's defaults. The form checks the name rule, the upstream shape
  and that groups need login, and leaves the rest to the Registry.
- Attaching warns that the app is served on WIP's own origin and can act
  in the browser as its visitors, so only trusted apps should be
  attached.
- The Registry's per-item refusals are explained: an upstream that is
  one of the install's own services or an internal address, a name an
  app of this install already routes under, a record wip-deploy manages.
  Warnings, such as an upstream not reachable from the Registry yet, are
  shown after saving.
- Deactivate asks first and keeps the record; Revive writes it again.
  wip-deploy's records are read-only.

Tests: tsc clean; unit 402/402 (9 new); E2E not run yet (the dev container needs a restart onto @wip/client 0.77.0)

## dcf5724 — test: E2E for the system backup and restore, orphaned grants and attachments
**Time:** 2026-11-04 21:33
**Author:** Peter S <189785956+peterseb1969@users.noreply.github.com>
**Files:** 3 changed, +139/-0
**Tests:** not recorded
**Why:** The new spec never changes the install's auth state. It downloads a
system backup from the System tab, uploads that file and dry-runs an
upsert restore; dry-runs a mirror and checks Apply stays disabled until
"mirror" is typed; checks the API Keys page's orphaned-grants section
against the Registry's own listing; and on the Attachments page has a
blocked upstream refused, attaches a probe with an upstream that
resolves nowhere, edits it and deactivates it. The probe reuses one
fixed name on every run, so at most one inactive record exists
(attachment records are never hard-deleted). CHANGELOG has the entry.

Tests: tsc clean; unit 402/402; full E2E 91/91 (2.8 min) against the default install on @wip/client 0.77.0

## 2ca89a1 — fix: reserving a namespace on an existing key is a visible checkbox, as on create
**Time:** 2026-11-05 22:07
**Author:** Peter S <189785956+peterseb1969@users.noreply.github.com>
**Files:** 4 changed, +83/-20
**Tests:** not recorded
**Why:** Adding a namespace to an existing key could reserve it, but only through
a "reserve (admin)" entry in the access dropdown, beside read, write and
admin. The create dialog offers the same thing as a Reserve checkbox
next to each namespace, so on an existing key the option went unnoticed.

The key's namespace editor now has the same Reserve checkbox next to the
namespace field. Ticking it opens the reservation settings and disables
the access dropdown, showing admin, since a reserved namespace always
gets admin. As before, it can't be ticked for a namespace that exists:
a reservation never changes an existing namespace.

A new E2E step reserves a second, uncreated namespace on an existing key
with a non-default setting, checks it under Reservations, and narrows it
again, which releases the reservation.

Tests: tsc clean; unit 402/402; full E2E 92/92 (2.6 min) against the default install

## 30b3556 — chore: scaffold refresh — @wip/react 0.26.0, @wip/client 0.83.0, @wip/proxy 0.7.0
**Time:** 2026-11-06 20:36
**Author:** Peter S <189785956+peterseb1969@users.noreply.github.com>
**Files:** 16 changed, +199/-39
**Tests:** not recorded
**Why:** @wip/react 0.26.0's WipProvider keeps an app origin's session fresh: on
an install that serves each app on its own origin, the gateway's app
session lasts 15 minutes, and the provider renews it silently through a
hidden iframe. RC wraps the app in WipProvider, so it gets the renewal
with no code change.

@wip/client 0.78.0 to 0.83.0 add system backups scoped to one app's
namespaces, more restore skip codes, and attachment reads that say
whether the app is served; RC's use of them is unchanged. @wip/proxy
0.7.0 trims the API key and refuses a malformed one at startup. The
refresh also brings wip-toolkit 0.25.7, wip-archive 0.25.0 and doc
updates, among them the app contract's app-origin rule.

Tests: tsc clean; unit 402/402
