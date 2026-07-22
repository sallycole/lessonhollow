import { Star } from 'lucide-react'
import type { CurriculumLanding } from '@/content/curricula/types'

type CredibilityBandProps = {
  landing: CurriculumLanding | null
}

export function CredibilityBand({ landing }: CredibilityBandProps) {
  const proofItems = landing?.proofItems
  const proofQuote = landing?.proofQuote

  if (!proofItems?.length && !proofQuote) return null

  return (
    <section className="credibility-band">
      <h2>Why you&apos;ll love this path</h2>

      {proofItems && proofItems.length > 0 && (
        <ul className="proof-items">
          {proofItems.map((item, i) => (
            <li key={i}>
              <Star size={16} aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}

      {proofQuote && (
        <blockquote>
          <p>
            <em>&ldquo;{proofQuote.text}&rdquo;</em>
          </p>
          {proofQuote.attribution && (
            <footer>
              <small>— {proofQuote.attribution}</small>
            </footer>
          )}
        </blockquote>
      )}
    </section>
  )
}
