import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { getPostBySlug, getAllPosts } from '@/lib/blog'
import { MarkdownContent } from '@/components/markdown-content'
import { SITE_URL, SITE_NAME } from '@/lib/seo'
import { BlogPostingJsonLd } from '@/components/json-ld'

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const post = getPostBySlug(slug)

  if (!post || !post.published) {
    return { title: 'Not Found — Lesson Hollow' }
  }

  const description =
    post.excerpt || `${post.title} — a post on the Lesson Hollow blog.`

  const socialTitle = post.socialTitle || post.title
  const socialDescription = post.socialDescription || description
  const canonicalUrl = `${SITE_URL}/blog/${slug}`

  return {
    title: `${post.title} — Lesson Hollow Blog`,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: socialTitle,
      description: socialDescription,
      type: 'article',
      siteName: SITE_NAME,
      url: canonicalUrl,
      publishedTime: post.date,
      images: post.featuredImage
        ? [{ url: post.featuredImage, alt: post.featuredImageAlt || post.title }]
        : undefined,
    },
    ...(post.featuredImage
      ? {
          twitter: {
            card: 'summary_large_image' as const,
            title: socialTitle,
            description: socialDescription,
            images: [post.featuredImage],
          },
        }
      : {
          twitter: {
            card: 'summary' as const,
            title: socialTitle,
            description: socialDescription,
          },
        }),
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const post = getPostBySlug(slug)

  if (!post || !post.published) {
    notFound()
  }

  const allPosts = getAllPosts()
  const currentIndex = allPosts.findIndex((p) => p.slug === slug)
  const prevPost = currentIndex < allPosts.length - 1 ? allPosts[currentIndex + 1] : null
  const nextPost = currentIndex > 0 ? allPosts[currentIndex - 1] : null
  const canonicalUrl = `${SITE_URL}/blog/${slug}`

  return (
    <>
      <BlogPostingJsonLd
        headline={post.title}
        datePublished={post.date}
        author={post.author}
        image={post.featuredImage}
        url={canonicalUrl}
        description={post.excerpt}
      />
      <article className="blog-post">
        <header>
          <h1>{post.title}</h1>
        <p className="post-meta">
          {post.author && (
            <>
              <span>{post.author}</span>
              {' · '}
            </>
          )}
          <time dateTime={post.date}>
            {new Date(post.date + 'T00:00:00').toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </time>
          {' · '}
          <span>{post.readingTime}</span>
        </p>
        {post.categories.length > 0 && (
          <p className="post-categories">
            {post.categories.map((cat) => (
              <Link
                key={cat}
                href={`/blog?category=${encodeURIComponent(cat)}`}
              >
                {cat}
              </Link>
            ))}
          </p>
        )}
      </header>

      {post.featuredImage && (
        <Image
          src={post.featuredImage}
          alt={post.featuredImageAlt || post.title}
          width={1600}
          height={900}
          priority
          className="post-hero"
        />
      )}

      <MarkdownContent content={post.content} />

      <nav className="post-nav" aria-label="Blog post navigation">
        <div className="post-nav-prev">
          {prevPost && (
            <Link href={`/blog/${prevPost.slug}`}>
              <small>← Previous</small>
              <strong>{prevPost.title}</strong>
            </Link>
          )}
        </div>
        <Link href="/blog" role="button" className="outline">
          Blog Home
        </Link>
        <div className="post-nav-next">
          {nextPost && (
            <Link href={`/blog/${nextPost.slug}`}>
              <small>Next →</small>
              <strong>{nextPost.title}</strong>
            </Link>
          )}
        </div>
      </nav>
      </article>
    </>
  )
}
