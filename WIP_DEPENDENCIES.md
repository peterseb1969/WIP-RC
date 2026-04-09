# RC-Console — WIP Dependencies

## Overview

RC-Console is a WIP admin console — it **inspects and manages WIP itself** rather than storing domain data. It does not create its own terminologies, templates, or documents. It reads and displays whatever exists in the connected WIP instance.

## Services used

| Service | How accessed | Purpose |
|---------|-------------|---------|
| def-store | @wip/proxy | Terminologies, terms, ontology relationships, hierarchy traversal |
| template-store | @wip/proxy | Templates, fields, versions, activation |
| document-store | @wip/proxy | Documents: list, create (POST), update (PATCH), archive, validate, versions |
| registry | @wip/proxy | Entry search, namespace stats, API key management |
| reporting-sync | @wip/proxy | SQL queries, table browser, sync status, integrity, search |
| ingest-gateway | @wip/proxy (health only) | Health check on dashboard |
| files | @wip/proxy | File listing, metadata, upload |

## Client libraries

| Library | Version | Key features used |
|---------|---------|-------------------|
| @wip/client | 0.11.0 | `documents.updateDocument(id, patch, { ifMatch })` (RFC 7396 PATCH), `documents.createDocument`, `documents.archiveDocument`, `defStore.getTerm/getParents/getChildren`, `defStore.listRelationships`, `reporting.search` |
| @wip/react | 0.6.0 | `useUpdateDocument`, `useCreateDocument`, `useArchiveDocument`, `useUploadFile`, `useCreateRelationships`, `useDeleteRelationships`, plus all read hooks (`useDocument`, `useTerms`, `useTemplates`, etc.) |
| @wip/proxy | 0.2.0 | Express middleware for API proxying with auth injection |

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
