import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { z } from 'zod'

const PRESS_DIR = path.join(process.cwd(), 'content', 'press')
const COVERAGE_FILE = path.join(PRESS_DIR, 'coverage.json')
const RELEASES_DIR = path.join(PRESS_DIR, 'releases')

const coverageSchema = z.object({
  id: z.string(),
  title: z.string(),
  publisher: z.string(),
  publisherUrl: z.string().url().optional(),
  url: z.string().url(),
  date: z.string().nullable(),
  dateNote: z.string().optional(),
  summary: z.string(),
})

export type CoverageItem = z.infer<typeof coverageSchema>

const releaseSchema = z.object({
  title: z.string(),
  date: z.union([z.string(), z.date()]).transform((v) =>
    typeof v === 'string' ? v : v.toISOString().split('T')[0]
  ),
  published: z.boolean().default(true),
  excerpt: z.string().max(200).optional(),
})

export type PressRelease = {
  slug: string
  title: string
  date: string
  published: boolean
  excerpt?: string
  content: string
}

export function getAllCoverage(): CoverageItem[] {
  if (!fs.existsSync(COVERAGE_FILE)) return []

  const raw = fs.readFileSync(COVERAGE_FILE, 'utf-8')
  const data = JSON.parse(raw)

  if (!Array.isArray(data)) return []

  return data
    .map((item) => {
      const parsed = coverageSchema.safeParse(item)
      if (!parsed.success) {
        console.error('Invalid coverage entry:', parsed.error.message)
        return null
      }
      return parsed.data
    })
    .filter((item): item is CoverageItem => item !== null)
}

function getReleaseSlugs(): string[] {
  if (!fs.existsSync(RELEASES_DIR)) return []
  return fs
    .readdirSync(RELEASES_DIR)
    .filter((file) => file.endsWith('.md'))
    .map((file) => file.replace(/\.md$/, ''))
}

export function getReleaseBySlug(slug: string): PressRelease | null {
  const filePath = path.join(RELEASES_DIR, `${slug}.md`)
  if (!fs.existsSync(filePath)) return null

  const raw = fs.readFileSync(filePath, 'utf-8')
  const { data, content } = matter(raw)

  const parsed = releaseSchema.safeParse(data)
  if (!parsed.success) {
    console.error(`Invalid frontmatter in release ${slug}.md:`, parsed.error.message)
    return null
  }

  return {
    slug,
    title: parsed.data.title,
    date: parsed.data.date,
    published: parsed.data.published,
    excerpt: parsed.data.excerpt,
    content,
  }
}

export function getAllReleases({ includeUnpublished = false } = {}): PressRelease[] {
  const slugs = getReleaseSlugs()
  const releases = slugs
    .map((slug) => getReleaseBySlug(slug))
    .filter((release): release is PressRelease => release !== null)
    .filter((release) => includeUnpublished || release.published)
    .sort((a, b) => (a.date > b.date ? -1 : 1))

  return releases
}
