import { ListChecks, Link2, ArrowRight, type LucideIcon } from 'lucide-react'
import type { CurriculumLanding } from '@/content/curricula/types'

type DesireBridgeProps = {
  landing: CurriculumLanding | null
}

const DEFAULT_HEADING = 'Why this can actually happen'
const DEFAULT_PARAGRAPH =
  'A curriculum is only as good as the structure behind it. Lesson Hollow turns a list into a path you can follow day by day. One task at a time, every resource linked, every session tracked.'

const DEFAULT_BENEFITS = [
  {
    title: 'Clear next step',
    description:
      'No guessing what comes after this. Lesson Hollow surfaces the next task automatically so you stay in rhythm.',
  },
  {
    title: 'Resources attached',
    description:
      'Books, videos, and prompts live with the task itself. No more juggling tabs or hunting for links.',
  },
  {
    title: 'Real sequence',
    description:
      'Not "some ideas," but an ordered path through the topic. Start at task one and follow the thread.',
  },
]

const ICON_SLOTS: LucideIcon[] = [ArrowRight, Link2, ListChecks]

export function DesireBridge({ landing }: DesireBridgeProps) {
  const heading = landing?.desireBridge?.heading ?? DEFAULT_HEADING
  const paragraph = landing?.desireBridge?.paragraph ?? DEFAULT_PARAGRAPH
  const benefits = landing?.desireBridge?.benefits ?? DEFAULT_BENEFITS

  return (
    <section className="desire-bridge">
      <h2>{heading}</h2>

      <div className="desire-grid">
        {benefits.map((benefit, idx) => {
          const Icon = ICON_SLOTS[idx % ICON_SLOTS.length]
          return (
            <article key={benefit.title}>
              <Icon size={20} aria-hidden="true" />
              <h3>{benefit.title}</h3>
              <p>{benefit.description}</p>
            </article>
          )
        })}
      </div>

      <p className="desire-summary">{paragraph}</p>
    </section>
  )
}
