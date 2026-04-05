import { useState } from 'react'
import { Activity as ActivityIcon, Clock, RefreshCw } from 'lucide-react'
import { useActivity } from '@wip/react'
import LoadingState from '@/components/common/LoadingState'
import ErrorState from '@/components/common/ErrorState'

export default function ActivityPage() {
  const [limit] = useState(50)
  const { data, isLoading, error, refetch } = useActivity({ limit })

  const activities = data?.activities ?? []

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Activity</h1>
          <p className="text-sm text-gray-400 mt-1">Audit trail explorer</p>
        </div>
        <button onClick={() => refetch()} className="p-2 border border-gray-200 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-50" title="Refresh">
          <RefreshCw size={14} />
        </button>
      </div>

      {isLoading && <LoadingState label="Loading activity..." />}
      {error && <ErrorState message={error.message} onRetry={() => refetch()} />}

      {data && (
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
          {activities.length === 0 ? (
            <p className="text-sm text-gray-400 p-6 text-center">No activity recorded.</p>
          ) : (
            activities.map((act, i) => (
              <div key={`${act.entity_id}-${act.timestamp}-${i}`} className="flex items-center gap-3 px-4 py-2.5">
                <ActivityIcon size={14} className="text-gray-300 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-gray-700">
                    <span className="font-medium capitalize">{act.action}</span>{' '}
                    <span className="text-gray-500">{act.type}</span>
                  </span>
                  <div className="text-xs text-gray-400 font-mono truncate mt-0.5">{act.entity_id}</div>
                </div>
                {act.user && <span className="text-xs text-gray-400 shrink-0">{act.user}</span>}
                <span className="text-xs text-gray-400 shrink-0 flex items-center gap-1">
                  <Clock size={10} />
                  {new Date(act.timestamp).toLocaleString()}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
