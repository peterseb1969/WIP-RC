import { useParams } from 'react-router-dom'

export default function DocumentDetailPage() {
  const { templateValue, id } = useParams()
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-800 mb-4">Document: {id}</h1>
      <p className="text-gray-500">Template: {templateValue}</p>
    </div>
  )
}
