# RC-Console — WIP Dependencies

## Overview

RC-Console is a WIP admin console — it **inspects and manages WIP itself** rather than storing domain data. It does not create its own terminologies, templates, or documents. It reads and displays whatever exists in the connected WIP instance.

## Services used

| Service | How accessed | Purpose |
|---------|-------------|---------|
| def-store | @wip/proxy | Terminologies, terms |
| template-store | @wip/proxy | Templates, fields, versions |
| document-store | @wip/proxy | Documents, queries, versions |
| registry | @wip/proxy | Entry search, namespace stats |
| reporting-sync | @wip/proxy | SQL queries, table browser, sync status, integrity |
| ingest-gateway | @wip/proxy (health only) | Health check on dashboard |
| files | @wip/proxy | File listing, metadata |

## Direct infrastructure connections

| System | Connection | Purpose |
|--------|-----------|---------|
| MongoDB | `mongodb://localhost:27017/` | Collection stats, indexes, document browsing (read-only) |
| NATS | `nats://localhost:4222` | JetStream stream/consumer monitoring (read-only) |

These bypass WIP's API layer because WIP does not expose infrastructure metrics via REST.

## WIP databases inspected (MongoDB)

- `wip_registry`
- `wip_def_store`
- `wip_template_store`
- `wip_document_store`

## Terminologies and templates

RC-Console does not own any terminologies or templates. It reads all active terminologies and templates across all namespaces for display and management.

## Seed files

Not applicable — RC-Console has no data model to seed.

## External data sources

| Source | Purpose |
|--------|---------|
| Claude API (Anthropic) | NL Query — natural language data exploration |

## Cross-app references

RC-Console is namespace-agnostic — it displays data from all namespaces. Other apps' terminologies, templates, and documents are all visible and manageable through RC-Console.
