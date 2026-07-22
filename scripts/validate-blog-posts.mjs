#!/usr/bin/env node
// Validates every file in content/blog/*.md against the same rules the Next.js
// blog renderer enforces, and exits non-zero on any violation. Wired into
// `npm run build` via the `prebuild` script so the Fly deploy fails loudly
// when a post is malformed (instead of silently 404-ing in production).
//
// Source of truth for these constants is src/lib/blog.ts. Keep them in sync.
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import matter from 'gray-matter'

const BLOG_EXCERPT_MAX_CHARS = 110

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog')

function fail(file, message) {
  console.error(`\n✖ ${path.relative(process.cwd(), file)}`)
  console.error(`  ${message}`)
  process.exit(1)
}

if (!fs.existsSync(BLOG_DIR)) {
  console.log('No content/blog directory; nothing to validate.')
  process.exit(0)
}

const files = fs
  .readdirSync(BLOG_DIR)
  .filter((f) => f.endsWith('.md'))
  .map((f) => path.join(BLOG_DIR, f))

if (files.length === 0) {
  console.log('No blog posts to validate.')
  process.exit(0)
}

for (const file of files) {
  const raw = fs.readFileSync(file, 'utf-8')
  const { data } = matter(raw)

  // Skip unpublished drafts. The blog renderer (src/lib/blog.ts) filters
  // `published: false` posts from getAllPosts() by default, so they never
  // appear on the live site. Validating them blocks deploys for drafts
  // that aren't ready to ship yet.
  if (data.published === false) {
    continue
  }

  if (typeof data.title !== 'string' || data.title.trim() === '') {
    fail(file, 'frontmatter `title` is required and must be a non-empty string.')
  }

  if (data.date == null) {
    fail(file, 'frontmatter `date` is required (YYYY-MM-DD or ISO date).')
  }

  if (data.excerpt != null) {
    if (typeof data.excerpt !== 'string') {
      fail(file, 'frontmatter `excerpt` must be a string when present.')
    }
    if (data.excerpt.length > BLOG_EXCERPT_MAX_CHARS) {
      fail(
        file,
        `excerpt is ${data.excerpt.length} characters; max is ${BLOG_EXCERPT_MAX_CHARS}. ` +
          `Shorten it so it fits in the 3-line clamp on the blog index card. ` +
          `See docs/authoring-blog-posts.md.`
      )
    }
  }

  if (data.featuredImage != null) {
    if (typeof data.featuredImage !== 'string' || !data.featuredImage.startsWith('/')) {
      fail(
        file,
        'frontmatter `featuredImage` must be an absolute path starting with `/` (e.g. /blog/my-hero.jpg).'
      )
    }
    const imagePath = path.join(process.cwd(), 'public', data.featuredImage.replace(/^\//, ''))
    if (!fs.existsSync(imagePath)) {
      fail(file, `featuredImage references missing file: ${data.featuredImage}`)
    }
  }
}

console.log(`validated ${files.length} blog post${files.length === 1 ? '' : 's'}`)
