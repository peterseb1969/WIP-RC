# RC-Console — WIP Dependencies

## Overview

RC-Console is a WIP admin console — it **inspects and manages WIP itself** rather than storing domain data. It does not create its own terminologies, templates, or documents. It reads and displays whatever exists in the connected WIP instance.

## Services used

| Service | How accessed | Purpose |
|---------|-------------|---------|
| def-store | @wip/proxy | Terminologies, terms, ontology relationships, hierarchy traversal |
| template-store | @wip/proxy | Templates, fields, versions, activation |
| document-store | @wip/proxy | Documents: list, create (POST), update (PATCH), archive, validate, versions, CSV import |
| registry | @wip/proxy | Entry search, namespace stats, API key management, backup/restore jobs |
| reporting-sync | @wip/proxy | SQL queries, table browser, sync status, integrity, search |
| ingest-gateway | @wip/proxy (health only) | Health check on dashboard |
| files | @wip/proxy | File listing, metadata, upload, download (0.5.0 streams both directions — backup archives and file content) |

## Client libraries

| Library | Version | Key features used |
|---------|---------|-------------------|
| @wip/client | 0.11.0 | `documents.updateDocument(id, patch, { ifMatch })` (RFC 7396 PATCH), `documents.createDocument`, `documents.archiveDocument`, `documents.validateDocument`, `defStore.getTerm/getParents/getChildren`, `defStore.listRelationships`, `reporting.search`, backup/restore job management |
| @wip/react | 0.6.0 | `useUpdateDocument`, `useCreateDocument`, `useArchiveDocument`, `useUploadFile`, `useCreateRelationships`, `useDeleteRelationships`, plus all read hooks (`useDocument`, `useTerms`, `useTemplates`, etc.) |
| @wip/proxy | 0.2.0 | Express middleware for API proxying with auth injection |

## Direct infrastructure connections

| System | Connection | Purpose |
|--------|-----------|---------|
| MongoDB | `mongodb://localhost:27017/` | Collection stats, indexes, document browsing (read-only) |
| NATS | `nats://localhost:4222` | JetStream stream/consumer monitoring (read-only) |

These bypass WIP's API layer because WIP does not expose infrastructure metrics via REST.

## Backup & restore

The backup/restore page uses WIP's document-store backup API to start backup, restore and validate jobs and poll their status — proxied through `@wip/proxy` (0.5.0+), which streams request and response bodies both ways, so archive uploads and downloads no longer buffer in the Express backend. Restore uploads post straight to `/wip/api/document-store/backup/namespaces/_/restore`.

One bespoke route remains: `GET /api/backup-download/:jobId`. Not for streaming (the proxy does that now) but to rewrite the archive filename — WIP sends `Content-Disposition: <namespace>-<jobid>.zip`, and the route replaces it with the human-useful `<namespace>_<timestamp>.zip` the client requests. The browser's `download` attribute cannot override `Content-Disposition` for same-origin responses, so the rewrite is server-side.

## WIP databases inspected (MongoDB)

- `wip_registry`
- `wip_def_store`
- `wip_template_store`
- `wip_document_store`

## System terminologies used

| Terminology | Purpose | Fallback |
|-------------|---------|----------|
| `_ONTOLOGY_RELATIONSHIP_TYPES` | Populates the relationship type dropdown in Add Relationship slide-out and Hierarchy tab type selector | Hardcoded list: `is_a`, `has_subtype`, `part_of`, `has_part`, `maps_to`, `mapped_from`, `related_to`, `finding_site`, `causative_agent` |

## Terminologies and templates

RC-Console does not own any terminologies or templates. It reads all active terminologies and templates across all namespaces for display and management. The Document Form dynamically generates input fields from whatever template the user selects.

## Seed files

Not applicable — RC-Console has no data model to seed.

## External data sources

| Source | Purpose |
|--------|---------|
| Claude API (Anthropic) | NL Query — natural language data exploration |

## Cross-app references

RC-Console is namespace-agnostic — it displays data from all namespaces. Other apps' terminologies, templates, and documents are all visible and manageable through RC-Console. The Document Form supports cross-app reference fields (e.g., a ClinTrial document referencing a term from a shared ontology) because it reads the template's field definitions at runtime.
