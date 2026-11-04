import type { APIKeyInfo, Attachment, AttachmentBulkResult, AttachmentRequest } from '@wip/client'

// App attachments: an app served at /apps/<name> by the router's app edge,
// recorded in the Registry rather than in wip-deploy's manifests. Every
// write replaces the whole record, so the form always sends all fields.

/** The Registry's name rule; the path is always /apps/<name>. */
export const NAME_PATTERN = /^[a-z][a-z0-9-]{1,40}$/

/** The form's view of a record: lists as comma text, every field present. */
export interface AttachmentDraft {
  name: string
  upstream: string
  display_name: string
  auth_required: boolean
  allowed_groups: string
  strip_prefix: boolean
  preserve_prefix_subpaths: string
  redirect_bare_path: boolean
  upstream_host_header: boolean
  streaming: boolean
  ui_only: boolean
  health: string
  tls_verify: boolean
  ca_pem: string
}

/** A new record's draft, with the Registry's defaults. */
export function newDraft(): AttachmentDraft {
  return {
    name: '', upstream: '', display_name: '',
    auth_required: true, allowed_groups: '',
    strip_prefix: false, preserve_prefix_subpaths: '', redirect_bare_path: true,
    upstream_host_header: false, streaming: false, ui_only: true, health: '',
    tls_verify: true, ca_pem: '',
  }
}

export function draftFrom(a: Attachment): AttachmentDraft {
  return {
    name: a.name, upstream: a.upstream, display_name: a.display_name ?? '',
    auth_required: a.auth_required, allowed_groups: (a.allowed_groups ?? []).join(', '),
    strip_prefix: a.strip_prefix, preserve_prefix_subpaths: (a.preserve_prefix_subpaths ?? []).join(', '),
    redirect_bare_path: a.redirect_bare_path, upstream_host_header: a.upstream_host_header,
    streaming: a.streaming, ui_only: a.ui_only, health: a.health ?? '',
    tls_verify: a.upstream_tls?.verify ?? true, ca_pem: a.upstream_tls?.ca_pem ?? '',
  }
}

const list = (text: string) => text.split(',').map(s => s.trim()).filter(Boolean)

/** The full request for a draft, or what to fix first. The Registry checks the rest. */
export function requestFrom(d: AttachmentDraft): { request: AttachmentRequest } | { error: string } {
  const name = d.name.trim()
  if (!NAME_PATTERN.test(name)) {
    return { error: 'Name: a lowercase letter, then 1–40 lowercase letters, digits or hyphens.' }
  }
  const upstream = d.upstream.trim()
  if (!/^https?:\/\/[^/\s]+\/?$/.test(upstream)) {
    return { error: 'Upstream: scheme, host and optional port only, e.g. http://my-app:8080 (no path).' }
  }
  const groups = list(d.allowed_groups)
  if (groups.length && !d.auth_required) {
    return { error: 'Allowed groups need "Login required": the gateway checks groups only for logged-in visitors.' }
  }
  const health = d.health.trim()
  return {
    request: {
      name,
      upstream: upstream.replace(/\/$/, ''),
      auth_required: d.auth_required,
      allowed_groups: groups,
      strip_prefix: d.strip_prefix,
      preserve_prefix_subpaths: list(d.preserve_prefix_subpaths),
      redirect_bare_path: d.redirect_bare_path,
      upstream_host_header: d.upstream_host_header,
      streaming: d.streaming,
      upstream_tls: { verify: d.tls_verify, ca_pem: d.ca_pem.trim() || null },
      display_name: d.display_name.trim(),
      ui_only: d.ui_only,
      health: health || null,
    },
  }
}

/** What an attachment write's per-item refusal means. */
export function attachmentErrorMessage(item: AttachmentBulkResult): string {
  const rule = item.details?.rule
  const said = item.error ?? 'refused'
  if (item.error_code === 'forbidden' && rule === 'upstream_blocked') {
    return `The upstream is one of this install's own services or an internal address, which an attachment may not proxy to. ${said}`
  }
  if (item.error_code === 'name_collision') {
    return `An app of this install already routes under /apps/${item.name ?? ''}. Pick another name. ${said}`
  }
  if (item.error_code === 'managed_by_deployer') {
    return `wip-deploy manages this attachment; change it in the install's manifests. ${said}`
  }
  if (item.error_code === 'concurrency_conflict') return `Someone changed it at the same time; try again. ${said}`
  return rule ? `${said} (${rule})` : said
}

/** The keys that belong to an attached app, by the `owner: app:<name>` convention. */
export function keysOfApp(keys: APIKeyInfo[], name: string): APIKeyInfo[] {
  return keys.filter(k => k.owner === `app:${name}`)
}
