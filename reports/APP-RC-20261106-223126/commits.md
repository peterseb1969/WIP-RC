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
