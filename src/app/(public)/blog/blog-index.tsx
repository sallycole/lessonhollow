'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import type { BlogPost } from '@/lib/blog'

function PostCard({ post, priority = false }: { post: BlogPost; priority?: boolean }) {
  return (
    <article className="post-card">
      <Link href={`/blog/${post.slug}`}>
        {post.featuredImage && (
          <Image
            src={post.featuredImage}
            alt={post.featuredImageAlt || post.title}
            width={1200}
            height={675}
            priority={priority}
          />
        )}
        <header>
          <small>
            <time dateTime={post.date}>
              {new Date(post.date + 'T00:00:00').toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </time>
            {' · '}
            {post.readingTime}
          </small>
        </header>
        <h2>{post.title}</h2>
        {post.excerpt && <p>{post.excerpt}</p>}
      </Link>
    </article>
  )
}

export function BlogIndex({ posts }: { posts: BlogPost[] }) {
  const searchParams = useSearchParams()
  const activeCategory = searchParams.get('category')
  const [search, setSearch] = useState('')

  const categoryFiltered = activeCategory
    ? posts.filter((p) => p.categories.includes(activeCategory))
    : posts

  const filteredPosts = search.trim()
    ? categoryFiltered.filter((p) => {
        const q = search.toLowerCase()
        return (
          p.title.toLowerCase().includes(q) ||
          (p.excerpt && p.excerpt.toLowerCase().includes(q))
        )
      })
    : categoryFiltered

  if (posts.length === 0) {
    return (
      <article className="blog-empty">
        <p>No posts yet.</p>
        <p>
          <small>Check back soon for updates.</small>
        </p>
      </article>
    )
  }

  return (
    <>
      {activeCategory && (
        <p className="blog-filter">
          Filtered by: <strong>{activeCategory}</strong>{' '}
          <Link href="/blog">Clear filter</Link>
        </p>
      )}

      <input
        type="search"
        placeholder="Search posts…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="Search posts"
      />

      <section className="blog-list" aria-label="Blog posts">
        {filteredPosts.map((post, index) => (
          <PostCard key={post.slug} post={post} priority={index < 2} />
        ))}
      </section>

      {filteredPosts.length === 0 && search.trim() && (
        <article className="blog-empty">
          <p>No posts matching &ldquo;{search}&rdquo;.</p>
          <button type="button" className="outline" onClick={() => setSearch('')}>
            Clear search
          </button>
        </article>
      )}
    </>
  )
}
