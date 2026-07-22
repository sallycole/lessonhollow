import type { Metadata } from 'next'
import Link from 'next/link'
import { hero, features, audiences, cta } from '@/content/homepage'

export const metadata: Metadata = {
  title: 'Lesson Hollow | Build your curriculum. Track your progress.',
  description: 'At Lesson Hollow, lifelong learners step up to be guides and their crew steps up to be players on a learning journey. Build curriculums together, knock out daily tasks, and watch the progress stack up.',
  openGraph: {
    title: 'Lesson Hollow | Your curriculum. Your pace.',
    description: 'Build your curriculum. Track your progress. Share your path.',
    images: [
      {
        url: '/og/lesson-hollow-collage-og.png',
        width: 1200,
        height: 630,
        alt: 'Lesson Hollow',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lesson Hollow | Your curriculum. Your pace.',
    description: 'Build your curriculum. Track your progress. Share your path.',
    images: ['/og/lesson-hollow-collage-og.png'],
  },
}

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <hgroup>
          <h1>
            {hero.headline} {hero.tagline}
          </h1>
          <p>{hero.description}</p>
        </hgroup>
        <p className="hero-ctas">
          <Link href={hero.primaryCta.href} role="button">
            {hero.primaryCta.label}
          </Link>
          <Link href={hero.secondaryCta.href} role="button" className="outline">
            {hero.secondaryCta.label}
          </Link>
        </p>
      </section>

      <section id="features" className="features-section">
        <hgroup>
          <h2>{features.heading}</h2>
          <p>{features.description}</p>
        </hgroup>
        <div className="features-grid">
          {features.items.map((feature) => {
            const Icon = feature.icon
            return (
              <article key={feature.title}>
                <Icon size={28} aria-hidden="true" />
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            )
          })}
        </div>
      </section>

      <section className="audiences-section">
        <h2>{audiences.heading}</h2>
        <div className="grid">
          {audiences.items.map((audience) => (
            <article key={audience.label}>
              <h3>{audience.label}</h3>
              <p>{audience.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="home-cta">
        <article>
          <hgroup>
            <h2>{cta.heading}</h2>
            <p>{cta.description}</p>
          </hgroup>
          <p>
            <Link href={cta.buttonHref} role="button">
              {cta.buttonLabel}
            </Link>
          </p>
        </article>
      </section>
    </>
  )
}
