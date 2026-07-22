import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  ENROLLMENT_COST_DISPLAY,
  MINIMUM_TOPUP_DISPLAY,
} from '@/lib/pricing'

const title = 'Lesson Hollow Pricing | First enrollment free, then $0.50 per enrollment'
const description =
  'Simple pay-as-you-grow pricing for homeschool groups, co-ops, and microschools. First enrollment free. $0.50 per enrollment. $10 top-ups.'

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    type: 'website',
    siteName: 'Lesson Hollow',
    url: 'https://lessonhollow.com/pricing',
    images: [{ url: '/og/lesson-hollow-collage-og.png', width: 1200, height: 630, alt: title }],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: ['/og/lesson-hollow-collage-og.png'],
  },
  alternates: {
    canonical: 'https://lessonhollow.com/pricing',
  },
}

export default async function PricingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.user_metadata?.role as string | undefined
  const isGuide = user && role !== 'player'
  const isPlayer = user && role === 'player'

  return (
    <>
      <section className="pricing-hero">
        <hgroup>
          <h1>
            Enroll and track your Players. Pay only when you enroll.
          </h1>
          <p>
            Lesson Hollow is a curriculum-building and progress-tracking app built for
            homeschool families, microschool guides, and self-directed learners. Each
            Player&apos;s first enrollment is free. After that, enrolling in a curriculum
            is $0.50 each with no subscription required.
          </p>
        </hgroup>
        {!isPlayer && (
          <p className="pricing-hero-cta">
            {isGuide ? (
              <Link href="/credits" role="button">
                Manage Credits
              </Link>
            ) : (
              <>
                <Link href="/signup" role="button">
                  Sign Up Free
                </Link>
                <small>No card required</small>
              </>
            )}
          </p>
        )}
      </section>

      <section className="pricing-steps">
        <h2>How it works</h2>
        <ol>
          {STEPS.map((step) => (
            <li key={step.number}>
              <span className="step-number" aria-hidden="true">
                {step.number}
              </span>
              <strong>{step.title}</strong>
              <p>{step.description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="pricing-card-wrap">
        <article className="pricing-card">
          <hgroup>
            <h2>Simple, pay-as-you-grow pricing</h2>
          </hgroup>
          <dl>
            <div>
              <dt aria-hidden="true">💰</dt>
              <dd>
                <strong>{ENROLLMENT_COST_DISPLAY}</strong> per enrollment
              </dd>
            </div>
            <div>
              <dt aria-hidden="true">📦</dt>
              <dd>
                <strong>{MINIMUM_TOPUP_DISPLAY} = 20 enrollments</strong>{' '}
                <small>(minimum top-up)</small>
              </dd>
            </div>
          </dl>
          <p>
            <small>
              Only consume credits when you enroll a Player in a new curriculum.
            </small>
          </p>
        </article>
      </section>

      <section className="pricing-payments">
        <h2>We accept</h2>
        <ul>
          {PAYMENT_METHODS.map((method) => (
            <li key={method.label}>
              <span aria-hidden="true">{method.icon}</span> {method.label}
            </li>
          ))}
        </ul>
        <p>
          <small>Pay the way that works for you.</small>
        </p>
      </section>

      <section className="pricing-faq">
        <h2>Common questions</h2>
        <dl>
          {FAQS.map((faq) => (
            <div key={faq.question}>
              <dt>{faq.question}</dt>
              <dd>{faq.answer}</dd>
            </div>
          ))}
        </dl>
      </section>

      {!isPlayer && (
        <section className="pricing-bottom-cta">
          <article>
            {isGuide ? (
              <>
                <hgroup>
                  <h2>Ready to top up?</h2>
                  <p>Top up when you need more enrollments.</p>
                </hgroup>
                <p>
                  <Link href="/credits" role="button">
                    Manage Credits
                  </Link>
                </p>
              </>
            ) : (
              <>
                <hgroup>
                  <h2>Ready to start enrolling?</h2>
                  <p>Each Player&apos;s first enrollment is free. No card required.</p>
                </hgroup>
                <p>
                  <Link href="/signup" role="button">
                    Sign Up Free
                  </Link>
                </p>
              </>
            )}
          </article>
        </section>
      )}
    </>
  )
}

const STEPS = [
  { number: 1, title: 'Sign up', description: 'Free, no card required.' },
  { number: 2, title: 'Enroll your first Player', description: 'On us. $0.' },
  {
    number: 3,
    title: 'Top up when ready',
    description: `${MINIMUM_TOPUP_DISPLAY} = 20 enrollments. No rush.`,
  },
]

const PAYMENT_METHODS = [
  { icon: '💳', label: 'Card' },
  { icon: 'G', label: 'Google Pay' },
  { icon: '$', label: 'Cash App' },
  { icon: '⚡', label: 'Lightning' },
]

const FAQS = [
  {
    question: 'What happens when I run out of credits?',
    answer:
      'You can’t enroll Players in new curriculums until you top up, but nothing is deleted. Your Players, curriculums, and progress are always safe. Top up anytime.',
  },
  {
    question: 'What if I have multiple Players?',
    answer: `Each Player's first enrollment is free. After that, ${MINIMUM_TOPUP_DISPLAY} covers 20 enrollments.`,
  },
  {
    question: 'Is there a subscription or recurring charge?',
    answer:
      'No. You only pay when you top up, when you want to. No subscriptions, no auto-renewals.',
  },
  {
    question: 'Do I need to pay before trying it?',
    answer: 'No. You can sign up for free, and your first enrollment is free.',
  },
  {
    question: 'How do top-ups work?',
    answer: `When you need more credits, you buy a ${MINIMUM_TOPUP_DISPLAY} top-up and keep using them over time.`,
  },
]
