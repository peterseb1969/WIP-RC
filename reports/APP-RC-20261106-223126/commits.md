# Commits — APP-RC-20261106-223126

## 868762f — fix: attachments are served at the root of their own origin; scaffold refresh to @wip/client 0.88.0
**Time:** 2026-11-08 02:29
**Author:** Peter S <189785956+peterseb1969@users.noreply.github.com>
**Files:** 27 changed, +323/-309
**Tests:** not recorded
**Why:** The Registry no longer serves apps under /apps/<name>: an attached app is
at the root of its own origin, https://<name>.<host>/, and the upstream
gets every path as the browser sent it. The Registry refuses (422) an
attachment write that carries strip_prefix, preserve_prefix_subpaths or
redirect_bare_path, and records no longer carry path, so every create and
edit from RC's Attachments page would have failed.

- The form, its draft and the request drop the three settings.
- Each row shows the app's origin; Open links https://<name>.<host>/,
  worked out by swapping RC's own first hostname label (RC is at
  rc.<host>). On a hostname without a dot (the local dev server) there is
  no link.
- A record the install doesn't serve says why (no app edge, a refused
  upstream host, an unreadable attach policy), and a write refused because
  the install runs no app edge says the install doesn't serve attached
  apps.

The refresh brings @wip/client 0.88.0 (0.84.0 drops the attachment
fields; later releases add candidates and error_code to registry
lookups), @wip/react 0.26.1, wip-toolkit 0.26.0, wip-archive 0.30.0 and
the docs for apps at the root of their own origins. CLAUDE.md takes the
refresh's three changed lines by hand, keeping RC's own paragraphs.

Tests: tsc clean; unit 409/409 (3 new); full E2E 92/92 on wip.localhost with the next commit applied
Discovered: npm ls @wip/client @wip/react @wip/proxy gives 0.88.0, 0.26.1, 0.7.0

## a86b19a — fix: RC is served at the root of its own origin, with no base path
**Time:** 2026-11-08 02:29
**Author:** Peter S <189785956+peterseb1969@users.noreply.github.com>
**Files:** 12 changed, +49/-83
**Tests:** not recorded
**Why:** WIP now serves every app at the root of an origin of its own,
https://<label>.<host>/, and nothing under /apps/ on its own origin; there
is no redirect from old links. RC's label is rc, so it is at
https://rc.<host>/ on every install redeployed after the change, and an
image built for /apps/rc breaks there.

- APP_BASE_PATH and VITE_BASE_PATH are gone: Express mounts its router,
  session cookie and OIDC callback at '/', Vite keeps its default base,
  and the Dockerfile and the CI image build no longer take a base path.
  Client fetches still go through BASE_URL, now '/'.
- Logout without a return_to redirected to '/' + '/' = '//' when no base
  path was set; it now redirects to '/'.
- The E2E suite defaults to https://rc.wip.localhost:8443/. Its login
  waits for RC's origin, since RC's path '/' also matches Dex's and the
  gateway's pages.
- README, ARCHITECTURE and CHANGELOG describe the root origin. DESIGN.md
  is the original plan and stays as it is.

Tests: tsc clean; unit 409/409; production build references /assets/ and no /apps/; full E2E 92/92 (2.8 min) on wip.localhost against https://rc.wip.localhost:8443/
Discovered: Two earlier E2E runs were lost to a Registry restart on the install (502 in global setup) and to a session end

## aa7e56c — fix: a Registry outage or an ambiguous value is not shown as "not found"
**Time:** 2026-11-08 02:36
**Author:** Peter S <189785956+peterseb1969@users.noreply.github.com>
**Files:** 6 changed, +48/-9
**Tests:** not recorded
**Why:** WIP now answers 503 registry_unavailable when the Registry does not
answer, and 409 with the candidates when an identifier names several
entities; both used to be 404s. A survey of RC found three places that
would misreport them; elsewhere RC shows the server's own message, which
says "retry shortly" or names the candidates, and @wip/client retries a
GET on 503 twice first.

- The documents table showed "Template not found" for any failure to
  read the template. It now shows the error.
- The term and document pickers marked a stored value whose lookup
  answered 409 as "lookup failed". They now say "ambiguous"; a 404 is
  still "not found", and anything else, an outage included, "lookup
  failed". The term picker shows the platform's message on hover.
- The document picker offered only its own namespace's documents,
  silently, when the namespace's reference settings could not be read.
  It now says so.

Tests: tsc clean; unit 411/411 (2 new); full E2E 92/92 (3.0 min) on wip.localhost
Discovered: Neither picker has a component test, so the 409 and failed-settings notes are covered by the helper's unit test only

## 2a6ad98 — fix: the document form's fields take a required namespace
**Time:** 2026-11-13 07:54
**Author:** Peter S <189785956+peterseb1969@users.noreply.github.com>
**Files:** 5 changed, +11/-10
**Tests:** not recorded
**Why:** @wip/client's uploadFile and @wip/react's useUploadFile now require the
namespace the file is stored in: the document-store refuses an upload
without one (422), and the client throws on an empty one before sending.
RC's file widget got it as namespace?: string from FieldInput,
ArrayFieldInput, NestedObjectInput and the form's FieldRow, so it would
stop compiling once a scaffold refresh brings that client.

The chain is closed: FieldInput is rendered only from DocumentForm's
FieldRow, ArrayFieldInput and NestedObjectInput, and DocumentForm always
resolves a namespace (the document's, else its template's). The prop is
now a required string along it, so the compiler proves the upload always
has one. TermFieldInput and ReferenceFieldInput keep it optional; they
have callers without a namespace.

Tests: tsc clean against the vendored @wip/client 0.88.0 (not yet against the client that requires it, which has no tarball); unit 411/411; E2E files, nested objects and namespaces 11/11 on wip.localhost

## 8ea392f — fix: a merge of an archive with several namespaces lists each into itself; merge offers align and retire options
**Time:** 2026-11-14 12:54
**Author:** Peter S <189785956+peterseb1969@users.noreply.github.com>
**Files:** 4 changed, +191/-15
**Tests:** not recorded
**Why:** The merge panel offered one "Target namespace" field for any archive and
sent it whenever it differed from the archive's first namespace. The
platform answers 400 to target_namespace for an archive holding several
namespaces in merge mode, since it writes each namespace into the one of
the same name. So for such an archive the field could only break the
merge, and the panel never said which namespaces would be written.

- A multi-namespace archive: the panel lists each namespace merging into
  itself, with no redirect field, and RC never sends target_namespace.
- A single-namespace archive keeps the redirect field.
- Either way, a target namespace this install doesn't have is flagged,
  and the merge is refused before any request: the platform refuses a
  merge into a missing namespace (document-store's merge checks every
  target exists).
- New merge options, with the platform's own descriptions:
  align_templates (match templates by value, for an archive from another
  install whose version numbers don't line up) and carry_retirements
  (retire the target's terms the archive has retired).

Tests: tsc clean; unit 415/415 (4 new); new E2E restore-merge spec passes (three-namespace archive, one deleted); full E2E 81 passed, 4 failed, 8 not run, all failures outside this change (terminology create sends extensible, which the platform now refuses; system backups are now version 2; a registry synonym count), the merge spec passing in every run
Discovered: WIP's def-store now refuses extensible on terminology create, the system backup format moved to version 2, and the registry spec's synonym check fails; RC needs to follow all three

## f7cfcdc — fix: RC follows @wip/client 0.108 and @wip/react 0.26.20; scaffold refresh
**Time:** 2026-11-15 01:38
**Author:** Peter S <189785956+peterseb1969@users.noreply.github.com>
**Files:** 39 changed, +579/-274
**Tests:** not recorded
**Why:** The scaffold refresh brings @wip/client 0.108.29, @wip/react 0.26.20 and
@wip/proxy 0.9.1. The client's types now follow API changes RC still
relied on, and twelve sites stopped compiling; two of them were already
refused at runtime.

- Terminologies no longer carry extensible: nothing read it, and
  def-store now refuses it with 422. Create, edit and the detail line
  drop it. (Creating a terminology from RC was failing on this.)
- A term's value can't be updated (also a 422). The edit row shows it
  read-only and says how to rename: create the new term, then deprecate
  or merge the old one into it.
- A reporting row count is null when the platform didn't take one
  (another kind of view, or a count that took too long). The PostgreSQL
  page shows "not counted" with the platform's note, never 0, and pages
  an uncounted table while each page comes back full.
- The audit action is the AuditAction union. The Activity filter is typed
  and offers every action, restored and merged included.
- An integrity summary's checks_not_run is a map of skipped checks. The
  summary grid shows only the counts, adds the four new ones
  (misplaced document refs, identity not verifiable, mandatory fields
  missing, nested templates not found), and lists the checks that didn't
  run, which make a result incomplete.

CLAUDE.md takes the refresh's new lines (claim a case before working on
it, the stale-caveat rule, two wording updates) and keeps RC's own.

Tests: tsc clean; unit 417/417 (2 new); full E2E on wip.localhost 87 passed, 3 failed, 3 not run, the failures being the system backup's version 2 and a registry synonym check, both outside this change; terminology create passes again
Discovered: the system backup format moved to version 2, which RC's System tab refuses, and the registry spec's synonym count no longer matches

## dd151e4 — fix: the System tab reads system backups of version 2; the registry spec counts synonyms from the entry's own start
**Time:** 2026-11-15 01:46
**Author:** Peter S <189785956+peterseb1969@users.noreply.github.com>
**Files:** 6 changed, +79/-7
**Tests:** not recorded
**Why:** The platform now writes system backups at version 2: every read a key
has is a grant in the archive. In version 1, a runtime key's namespaces
list gave read by itself, and restoring such a backup writes that read
as grants (the report's scope_read_grants). RC's System tab accepted
version 1 only, so a fresh backup from the same install was refused on
upload. It now reads versions 1 and 2, shows the version in the archive
summary, and says how many read grants restoring a version 1 backup
writes.

The registry E2E expected a new document's entry to have one synonym.
It now has two: its identity values and its own {ns, type, template,
identity_hash} value synonym. RC showed both correctly. The spec now
counts relative to what the entry starts with.

Tests: tsc clean; unit 418/418 (1 new); full E2E on wip.localhost 92 passed, 1 failed (the integrity check came back partial while document-store restarted mid-run) and 1/1 on a re-run of that spec
Discovered: The Integrity page shows "No integrity issues found" in green under a red "Partial" banner when a service didn't answer and no documents were checked

## 70fbc17 — test: the attachment E2E skips itself on an install without an app edge
**Time:** 2026-11-15 15:08
**Author:** Peter S <189785956+peterseb1969@users.noreply.github.com>
**Files:** 1 changed, +7/-1
**Tests:** not recorded
**Why:** An install that runs no app edge refuses every attachment write with
no_app_edge, and RC says the install doesn't serve attached apps. The
test assumed an app edge and failed on dev-test, which has none. It now
reads RC's refusal and skips the rest of itself with that reason.

Tests: full E2E on dev-test 92/93 before (this test the one failure), system-auth 3 passed and 1 skipped after; prod-test 93/93; wip.localhost system-auth 4/4
