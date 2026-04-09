import { Link, useLocation, useMatch } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'
import { useTerm, useTerminology, useTemplate } from '@wip/react'

// ---------------------------------------------------------------------------
// Breadcrumbs — Step 9 polish.
//
// Lives just below the TopBar. Generates a clickable path for the current
// route. Top-level pages use a static label map; deep routes with entity IDs
// (terminology detail, term detail, template detail) resolve labels via
// @wip/react hooks.
//
// Routes that don't match any known pattern get title-cased segments.
// ---------------------------------------------------------------------------

interface Crumb {
  label: string
  to?: string
}

const TOP_LEVEL_LABELS: Record<string, string> = {
  namespaces: 'Namespaces',
  terminologies: 'Terminologies',
  templates: 'Templates',
  documents: 'Documents',
  files: 'Files',
  registry: 'Registry',
  postgres: 'PostgreSQL',
  mongodb: 'MongoDB',
  nats: 'NATS',
  integrity: 'Integrity',
  activity: 'Activity',
  query: 'NL Query',
  'api-keys': 'API Keys',
}

export default function Breadcrumbs() {
  const location = useLocation()
  const segments = location.pathname.split('/').filter(Boolean)

  // All hooks must run unconditionally — match the deepest known patterns first.
  const termMatch = useMatch('/terminologies/:tid/terms/:termId')
  const terminologyMatch = useMatch('/terminologies/:id')
  const templateEditMatch = useMatch('/templates/:id/edit')
  const templateMatch = useMatch('/templates/:id')
  const documentImportMatch = useMatch('/documents/import')
  const documentTableMatch = useMatch('/documents/:templateValue/table')
  const documentNewMatch = useMatch('/documents/:templateValue/new')
  const documentEditMatch = useMatch('/documents/:templateValue/:id/edit')
  const documentMatch = useMatch('/documents/:templateValue/:id')
  const fileMatch = useMatch('/files/:id')

  // Don't render on dashboard
  if (segments.length === 0) return null

  let crumbs: Crumb[]
  if (termMatch) {
    crumbs = [
      { label: 'Terminologies', to: '/terminologies' },
      { label: 'TERMINOLOGY', to: `/terminologies/${termMatch.params.tid}`, _resolve: 'terminology', _id: termMatch.params.tid! } as Crumb & { _resolve: string; _id: string },
      { label: 'TERM', _resolve: 'term', _id: termMatch.params.termId! } as Crumb & { _resolve: string; _id: string },
    ]
  } else if (terminologyMatch) {
    crumbs = [
      { label: 'Terminologies', to: '/terminologies' },
      { label: 'TERMINOLOGY', _resolve: 'terminology', _id: terminologyMatch.params.id! } as Crumb & { _resolve: string; _id: string },
    ]
  } else if (templateEditMatch) {
    crumbs = [
      { label: 'Templates', to: '/templates' },
      { label: 'TEMPLATE', to: `/templates/${templateEditMatch.params.id}`, _resolve: 'template', _id: templateEditMatch.params.id! } as Crumb & { _resolve: string; _id: string },
      { label: 'Edit' },
    ]
  } else if (templateMatch) {
    crumbs = [
      { label: 'Templates', to: '/templates' },
      { label: 'TEMPLATE', _resolve: 'template', _id: templateMatch.params.id! } as Crumb & { _resolve: string; _id: string },
    ]
  } else if (documentImportMatch) {
    crumbs = [
      { label: 'Documents', to: '/documents' },
      { label: 'Import' },
    ]
  } else if (documentTableMatch) {
    crumbs = [
      { label: 'Documents', to: '/documents' },
      { label: documentTableMatch.params.templateValue!, to: `/documents?template=${documentTableMatch.params.templateValue}` },
      { label: 'Table' },
    ]
  } else if (documentNewMatch) {
    crumbs = [
      { label: 'Documents', to: '/documents' },
      { label: documentNewMatch.params.templateValue!, to: `/documents?template=${documentNewMatch.params.templateValue}` },
      { label: 'New' },
    ]
  } else if (documentEditMatch) {
    crumbs = [
      { label: 'Documents', to: '/documents' },
      { label: documentEditMatch.params.templateValue!, to: `/documents?template=${documentEditMatch.params.templateValue}` },
      { label: documentEditMatch.params.id!, to: `/documents/${documentEditMatch.params.templateValue}/${documentEditMatch.params.id}` },
      { label: 'Edit' },
    ]
  } else if (documentMatch) {
    crumbs = [
      { label: 'Documents', to: '/documents' },
      { label: documentMatch.params.templateValue!, to: `/documents?template=${documentMatch.params.templateValue}` },
      { label: documentMatch.params.id! },
    ]
  } else if (fileMatch) {
    crumbs = [
      { label: 'Files', to: '/files' },
      { label: fileMatch.params.id! },
    ]
  } else if (segments[0] === 'templates' && segments[1] === 'new') {
    crumbs = [
      { label: 'Templates', to: '/templates' },
      { label: 'New' },
    ]
  } else {
    // Fallback: top-level route only
    const top = segments[0]!
    const label = TOP_LEVEL_LABELS[top] ?? titleCase(top)
    crumbs = [{ label }]
  }

  return (
    <div className="bg-white border-b border-gray-100 px-6 py-2 flex items-center gap-1.5 text-xs text-gray-500">
      <Link to="/" className="text-gray-400 hover:text-gray-600 inline-flex items-center">
        <Home size={12} />
      </Link>
      {crumbs.map((crumb, i) => (
        <CrumbItem key={i} crumb={crumb} isLast={i === crumbs.length - 1} />
      ))}
    </div>
  )
}

function CrumbItem({ crumb, isLast }: { crumb: Crumb; isLast: boolean }) {
  const c = crumb as Crumb & { _resolve?: 'terminology' | 'term' | 'template'; _id?: string }
  return (
    <>
      <ChevronRight size={12} className="text-gray-300 shrink-0" />
      {c._resolve === 'terminology' && c._id ? (
        <ResolveTerminology id={c._id} to={c.to} isLast={isLast} />
      ) : c._resolve === 'term' && c._id ? (
        <ResolveTerm id={c._id} to={c.to} isLast={isLast} />
      ) : c._resolve === 'template' && c._id ? (
        <ResolveTemplate id={c._id} to={c.to} isLast={isLast} />
      ) : c.to && !isLast ? (
        <Link to={c.to} className="hover:text-gray-700 truncate max-w-[200px]">
          {c.label}
        </Link>
      ) : (
        <span className={isLast ? 'text-gray-700 font-medium truncate max-w-[300px]' : 'truncate max-w-[200px]'}>
          {c.label}
        </span>
      )}
    </>
  )
}

function ResolveTerminology({ id, to, isLast }: { id: string; to?: string; isLast: boolean }) {
  const q = useTerminology(id)
  const label = q.data?.label || q.data?.value || id
  return renderResolvedCrumb(label, to, isLast)
}

function ResolveTerm({ id, to, isLast }: { id: string; to?: string; isLast: boolean }) {
  const q = useTerm(id)
  const label = q.data?.label || q.data?.value || id
  return renderResolvedCrumb(label, to, isLast)
}

function ResolveTemplate({ id, to, isLast }: { id: string; to?: string; isLast: boolean }) {
  const q = useTemplate(id)
  const label = q.data?.label || q.data?.value || id
  return renderResolvedCrumb(label, to, isLast)
}

function renderResolvedCrumb(label: string, to: string | undefined, isLast: boolean) {
  if (to && !isLast) {
    return (
      <Link to={to} className="hover:text-gray-700 truncate max-w-[200px]">
        {label}
      </Link>
    )
  }
  return (
    <span className={isLast ? 'text-gray-700 font-medium truncate max-w-[300px]' : 'truncate max-w-[200px]'}>
      {label}
    </span>
  )
}

function titleCase(s: string): string {
  return s
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
