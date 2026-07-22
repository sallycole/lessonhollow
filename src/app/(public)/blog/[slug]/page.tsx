import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { getPostBySlug, getAllPosts } from '@/lib/blog'
import { MarkdownContent } from '@/components/markdown-content'

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

  return {
    title: `${post.title} — Lesson Hollow Blog`,
    description,
    openGraph: {
      title: socialTitle,
      description: socialDescription,
      type: 'article',
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

  return (
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
  )
}
