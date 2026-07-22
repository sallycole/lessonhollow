import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { getAllPosts, getPostBySlug, getAllCategories } from '../blog'

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog')
const TEST_DIR = path.join(BLOG_DIR, '__test_tmp__')

function writePost(filename: string, content: string) {
  fs.writeFileSync(path.join(BLOG_DIR, filename), content)
}

function removePost(filename: string) {
  const filePath = path.join(BLOG_DIR, filename)
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
}

describe('blog library', () => {
  const testFiles = ['__test-post-a.md', '__test-post-b.md', '__test-draft.md']

  beforeEach(() => {
    writePost(
      '__test-post-a.md',
      `---
title: Post A
date: 2026-01-15
categories:
  - tech
  - announcements
published: true
excerpt: First test post.
featuredImage: /blog/test-post-a.jpg
featuredImageAlt: Test post A image.
---

Content of post A.`
    )
    writePost(
      '__test-post-b.md',
      `---
title: Post B
date: 2026-02-20
categories:
  - updates
published: true
---

Content of post B.`
    )
    writePost(
      '__test-draft.md',
      `---
title: Draft Post
date: 2026-03-01
published: false
---

This is a draft.`
    )
  })

  afterEach(() => {
    for (const file of testFiles) {
      removePost(file)
    }
  })

  describe('getPostBySlug', () => {
    it('reads a post and parses frontmatter', () => {
      const post = getPostBySlug('__test-post-a')
      expect(post).not.toBeNull()
      expect(post!.title).toBe('Post A')
      expect(post!.date).toBe('2026-01-15')
      expect(post!.categories).toEqual(['tech', 'announcements'])
      expect(post!.published).toBe(true)
      expect(post!.excerpt).toBe('First test post.')
      expect(post!.featuredImage).toBe('/blog/test-post-a.jpg')
      expect(post!.featuredImageAlt).toBe('Test post A image.')
      expect(post!.content).toContain('Content of post A')
    })

    it('computes reading time', () => {
      const post = getPostBySlug('__test-post-a')
      expect(post!.readingTime).toBe('1 min read')
    })

    it('returns null for nonexistent slug', () => {
      expect(getPostBySlug('nonexistent-post-xyz')).toBeNull()
    })

    it('defaults published to true when omitted', () => {
      writePost(
        '__test-post-a.md',
        `---
title: No Published Field
date: 2026-01-01
---

Content.`
      )
      const post = getPostBySlug('__test-post-a')
      expect(post!.published).toBe(true)
    })
  })

  describe('getAllPosts', () => {
    it('returns published posts sorted by date descending', () => {
      const posts = getAllPosts()
      const testPosts = posts.filter((p) => p.slug.startsWith('__test-'))
      expect(testPosts.length).toBe(2)
      expect(testPosts[0].title).toBe('Post B')
      expect(testPosts[1].title).toBe('Post A')
    })

    it('excludes unpublished posts by default', () => {
      const posts = getAllPosts()
      const draft = posts.find((p) => p.slug === '__test-draft')
      expect(draft).toBeUndefined()
    })

    it('includes unpublished posts when requested', () => {
      const posts = getAllPosts({ includeUnpublished: true })
      const draft = posts.find((p) => p.slug === '__test-draft')
      expect(draft).toBeDefined()
      expect(draft!.published).toBe(false)
    })
  })

  describe('getAllCategories', () => {
    it('returns unique sorted categories from published posts', () => {
      const categories = getAllCategories()
      expect(categories).toContain('tech')
      expect(categories).toContain('announcements')
      expect(categories).toContain('updates')
    })
  })

  describe('frontmatter validation', () => {
    it('returns null for posts missing required title', () => {
      writePost(
        '__test-post-a.md',
        `---
date: 2026-01-01
---

No title.`
      )
      const post = getPostBySlug('__test-post-a')
      expect(post).toBeNull()
    })

    it('returns null for posts missing required date', () => {
      writePost(
        '__test-post-a.md',
        `---
title: No Date
---

No date.`
      )
      const post = getPostBySlug('__test-post-a')
      expect(post).toBeNull()
    })
  })
})
