import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WipProvider } from '@wip/react'
import { wipClient } from '@/lib/wip'
import AppLayout from '@/components/layout/AppLayout'
import DashboardPage from '@/pages/DashboardPage'
import NamespacesPage from '@/pages/NamespacesPage'
import TerminologyListPage from '@/pages/TerminologyListPage'
import TerminologyDetailPage from '@/pages/TerminologyDetailPage'
import TemplateListPage from '@/pages/TemplateListPage'
import TemplateDetailPage from '@/pages/TemplateDetailPage'
import DocumentListPage from '@/pages/DocumentListPage'
import DocumentDetailPage from '@/pages/DocumentDetailPage'
import FileListPage from '@/pages/FileListPage'
import RegistryPage from '@/pages/RegistryPage'
import PostgresPage from '@/pages/PostgresPage'
import MongoPage from '@/pages/MongoPage'
import NatsPage from '@/pages/NatsPage'
import IntegrityPage from '@/pages/IntegrityPage'
import ActivityPage from '@/pages/ActivityPage'
import NLQueryPage from '@/pages/NLQueryPage'

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
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="namespaces" element={<NamespacesPage />} />
              <Route path="terminologies" element={<TerminologyListPage />} />
              <Route path="terminologies/:id" element={<TerminologyDetailPage />} />
              <Route path="templates" element={<TemplateListPage />} />
              <Route path="templates/:id" element={<TemplateDetailPage />} />
              <Route path="documents" element={<DocumentListPage />} />
              <Route path="documents/:templateValue/:id" element={<DocumentDetailPage />} />
              <Route path="files" element={<FileListPage />} />
              <Route path="registry" element={<RegistryPage />} />
              <Route path="postgres" element={<PostgresPage />} />
              <Route path="mongodb" element={<MongoPage />} />
              <Route path="nats" element={<NatsPage />} />
              <Route path="integrity" element={<IntegrityPage />} />
              <Route path="activity" element={<ActivityPage />} />
              <Route path="query" element={<NLQueryPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </WipProvider>
    </QueryClientProvider>
  )
}
