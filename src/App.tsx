import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WipProvider } from '@wip/react'
import { wipClient } from '@/lib/wip'
import { NamespaceFilterProvider } from '@/hooks/use-namespace-filter'
import AppLayout from '@/components/layout/AppLayout'
import DashboardPage from '@/pages/DashboardPage'
import NamespacesPage from '@/pages/NamespacesPage'
import TerminologyListPage from '@/pages/TerminologyListPage'
import TerminologyDetailPage from '@/pages/TerminologyDetailPage'
import TemplateListPage from '@/pages/TemplateListPage'
import TemplateDetailPage from '@/pages/TemplateDetailPage'
import TemplateBuilderPage from '@/pages/TemplateBuilderPage'
import DocumentListPage from '@/pages/DocumentListPage'
import DocumentDetailPage from '@/pages/DocumentDetailPage'
import DocumentFormPage from '@/pages/DocumentFormPage'
import FileListPage from '@/pages/FileListPage'
import FileDetailPage from '@/pages/FileDetailPage'
import RegistryPage from '@/pages/RegistryPage'
import PostgresPage from '@/pages/PostgresPage'
import MongoPage from '@/pages/MongoPage'
import NatsPage from '@/pages/NatsPage'
import IntegrityPage from '@/pages/IntegrityPage'
import ActivityPage from '@/pages/ActivityPage'
import NLQueryPage from '@/pages/NLQueryPage'
import APIKeysPage from '@/pages/APIKeysPage'
import TermDetailPage from '@/pages/TermDetailPage'
import DevTermPickerPage from '@/pages/_DevTermPickerPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WipProvider client={wipClient}>
        <NamespaceFilterProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="namespaces" element={<NamespacesPage />} />
              <Route path="terminologies" element={<TerminologyListPage />} />
              <Route path="terminologies/:id" element={<TerminologyDetailPage />} />
              <Route path="terminologies/:tid/terms/:termId" element={<TermDetailPage />} />
              <Route path="templates" element={<TemplateListPage />} />
              <Route path="templates/new" element={<TemplateBuilderPage />} />
              <Route path="templates/:id" element={<TemplateDetailPage />} />
              <Route path="templates/:id/edit" element={<TemplateBuilderPage />} />
              <Route path="documents" element={<DocumentListPage />} />
              <Route path="documents/:templateValue/new" element={<DocumentFormPage mode="create" />} />
              <Route path="documents/:templateValue/:id/edit" element={<DocumentFormPage mode="edit" />} />
              <Route path="documents/:templateValue/:id" element={<DocumentDetailPage />} />
              <Route path="files" element={<FileListPage />} />
              <Route path="files/:id" element={<FileDetailPage />} />
              <Route path="registry" element={<RegistryPage />} />
              <Route path="postgres" element={<PostgresPage />} />
              <Route path="mongodb" element={<MongoPage />} />
              <Route path="nats" element={<NatsPage />} />
              <Route path="integrity" element={<IntegrityPage />} />
              <Route path="activity" element={<ActivityPage />} />
              <Route path="query" element={<NLQueryPage />} />
              <Route path="api-keys" element={<APIKeysPage />} />
              <Route path="_dev/term-picker" element={<DevTermPickerPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
        </NamespaceFilterProvider>
      </WipProvider>
    </QueryClientProvider>
  )
}
