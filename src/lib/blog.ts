import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { z } from 'zod'

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog')

export const BLOG_EXCERPT_MAX_CHARS = 110
export const BLOG_EXCERPT_TARGET_CHARS = 95

const frontmatterSchema = z.object({
  title: z.string(),
  date: z.union([z.string(), z.date()]).transform((v) =>
    typeof v === 'string' ? v : v.toISOString().split('T')[0]
  ),
  categories: z.array(z.string()).default([]),
  published: z.boolean().default(true),
  excerpt: z
    .string()
    .max(BLOG_EXCERPT_MAX_CHARS, {
      message: `Excerpt must be at most ${BLOG_EXCERPT_MAX_CHARS} characters so it fits on the blog index card.`,
    })
    .optional(),
  author: z.string().optional(),
  featuredImage: z.string().optional(),
  featuredImageAlt: z.string().optional(),
  audioSrc: z.string().optional(),
  audioTitle: z.string().optional(),
  socialTitle: z.string().optional(),
  socialDescription: z.string().optional(),
})

export type BlogPost = {
  slug: string
  title: string
  date: string
  categories: string[]
  published: boolean
  excerpt?: string
  author?: string
  featuredImage?: string
  featuredImageAlt?: string
  audioSrc?: string
  audioTitle?: string
  socialTitle?: string
  socialDescription?: string
  content: string
  readingTime: string
}

function computeReadingTime(content: string): string {
  const words = content.trim().split(/\s+/).length
  const minutes = Math.max(1, Math.ceil(words / 200))
  return `${minutes} min read`
}

function getPostSlugs(): string[] {
  if (!fs.existsSync(BLOG_DIR)) return []
  return fs
    .readdirSync(BLOG_DIR)
    .filter((file) => file.endsWith('.md'))
    .map((file) => file.replace(/\.md$/, ''))
}

export function getPostBySlug(slug: string): BlogPost | null {
  const filePath = path.join(BLOG_DIR, `${slug}.md`)
  if (!fs.existsSync(filePath)) return null

  const raw = fs.readFileSync(filePath, 'utf-8')
  const { data, content } = matter(raw)

  const parsed = frontmatterSchema.safeParse(data)
  if (!parsed.success) {
    console.error(`Invalid frontmatter in ${slug}.md:`, parsed.error.message)
    return null
  }

  return {
    slug,
    title: parsed.data.title,
    date: parsed.data.date,
    categories: parsed.data.categories,
    published: parsed.data.published,
    excerpt: parsed.data.excerpt,
    author: parsed.data.author,
    featuredImage: parsed.data.featuredImage,
    featuredImageAlt: parsed.data.featuredImageAlt,
    audioSrc: parsed.data.audioSrc,
    audioTitle: parsed.data.audioTitle,
    socialTitle: parsed.data.socialTitle,
    socialDescription: parsed.data.socialDescription,
    content,
    readingTime: computeReadingTime(content),
  }
}

export function getAllPosts({ includeUnpublished = false } = {}): BlogPost[] {
  const slugs = getPostSlugs()
  const posts = slugs
    .map((slug) => getPostBySlug(slug))
    .filter((post): post is BlogPost => post !== null)
    .filter((post) => includeUnpublished || post.published)
    .sort((a, b) => (a.date > b.date ? -1 : 1))

  return posts
}

export function getAllCategories(): string[] {
  const posts = getAllPosts()
  const categories = new Set<string>()
  for (const post of posts) {
    for (const cat of post.categories) {
      categories.add(cat)
    }
  }
  return Array.from(categories).sort()
}
