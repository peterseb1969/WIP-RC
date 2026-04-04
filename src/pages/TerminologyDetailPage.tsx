import { useParams } from 'react-router-dom'

export default function TerminologyDetailPage() {
  const { id } = useParams()
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-800 mb-4">Terminology: {id}</h1>
      <p className="text-gray-500">Terminology details and term management.</p>
    </div>
  )
}
