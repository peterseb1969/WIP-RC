# RC-Console — Changelog

## 2026-04-05 — Initial build complete (Steps 1-13)

### Session APP-RC-20260404-2358
- Added: Full project scaffold — Express backend with @wip/proxy, collapsible dark sidebar, 13 routes, TanStack Query + WipProvider setup
- Added: Dashboard with 6 service health cards, namespace stats grid, infrastructure quick-links, recent activity feed
- Added: PostgreSQL page — table browser, SQL query pad (dark theme, Cmd+Enter), query history, CSV export, sync status
- Added: MongoDB page — database list, collection browser, index inspector, paginated document browser with JSON viewer
- Added: NATS page — connection status, expandable stream cards, consumer detail with lag highlighting
- Added: Namespaces page — expandable rows with stats, create form
- Added: Terminologies pages — searchable list with filters, detail view with term management and pagination
- Added: Templates pages — list with namespace filter, detail with field table, type badges, cross-links
- Added: Documents pages — template card selector, paginated table, document detail with field display, JSON viewer, version history
- Added: Files page — paginated list with filtering
- Added: Registry page — search with split-pane results + JSON viewer
- Added: Integrity page — on-demand checks, status banner, issue list
- Added: Activity page — audit trail timeline

### Session APP-RC-20260405-0040
- Added: NL Query page — Claude API integration with 7 WIP tools in an agentic loop, chat UI with markdown rendering, tool call inspector, 6 example queries
- Added: Auth integration — TopBar shows user info when OIDC is active, "dev mode" badge otherwise
- Added: Test suite — 35 tests (UI components + NL query tool validation)
- Added: Dockerfile — multi-stage build, health check, production static serving
- Added: Documentation — README, ARCHITECTURE, WIP_DEPENDENCIES, KNOWN_ISSUES, CHANGELOG

### Libraries
- @wip/client@0.5.1, @wip/react@0.5.0, @wip/proxy@0.2.0
- @anthropic-ai/sdk@0.39, react-markdown@9, remark-gfm@4
- Total: ~14,000 lines added across 11 commits
