import { useParams } from 'react-router-dom'

export default function TemplateDetailPage() {
  const { id } = useParams()
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-800 mb-4">Template: {id}</h1>
      <p className="text-gray-500">Template fields, versions, and dependencies.</p>
    </div>
  )
}
