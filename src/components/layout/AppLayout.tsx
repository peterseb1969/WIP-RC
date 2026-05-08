import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { WipFooter } from '@wip/react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import Breadcrumbs from './Breadcrumbs'

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <Breadcrumbs />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
          <WipFooter appName="RC-Console" />
        </main>
      </div>
    </div>
  )
}
