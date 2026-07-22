import type { CurriculumLanding } from '@/content/curricula/types'

type FooterContextProps = {
  landing: CurriculumLanding | null
}

const DEFAULT_REASSURANCE =
  'You can start with this sequence as-is, adapt it to fit your needs, and still keep the structure intact.'

export function FooterContext({ landing }: FooterContextProps) {
  const text = landing?.footerReassurance ?? DEFAULT_REASSURANCE
  return (
    <section className="footer-context">
      <p>{text}</p>
    </section>
  )
}
