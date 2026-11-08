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
