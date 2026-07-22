import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function DiscoverDetailNotFound() {
  return (
    <article className="discover-notfound">
      <h1>Curriculum not found</h1>
      <p>This curriculum may not be public or may have been removed.</p>
      <Link href="/discover" role="button" className="outline">
        <ArrowLeft size={14} /> Browse all curriculums
      </Link>
    </article>
  )
}
