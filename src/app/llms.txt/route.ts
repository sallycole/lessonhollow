import { getAllPosts } from '@/lib/blog'
import { getLandingContent, getRegisteredCurriculumIds } from '@/content/curricula'

const SITE_URL = 'https://lessonhollow.com'

const SUMMARY = `Lesson Hollow is an online dashboard for homeschool families with AI assistance for managing curricula. Parents build or import curricula, enroll children (called players), and track daily learning tasks. The platform includes a Model Context Protocol (MCP) server that lets AI assistants create curriculums, enroll children, and work the daily task list. One parent account can follow up to 20 children. The app is open source under the MIT license.`

const STATIC_PAGES: Array<{ title: string; path: string; description: string }> = [
  {
    title: 'Lesson Hollow',
    path: '/',
    description:
      'At Lesson Hollow, lifelong learners step up to be guides and their crew steps up to be players on a learning journey. Build curriculums together, knock out daily tasks, and watch the progress stack up.',
  },
  {
    title: 'Discover Curriculums',
    path: '/discover',
    description:
      'Explore free ready-made homeschool curriculums on Lesson Hollow. Enroll your children in curated learning paths and track their daily progress.',
  },
  {
    title: 'Pricing',
    path: '/pricing',
    description:
      'Simple pay-as-you-grow pricing for homeschool groups, co-ops, and microschools. First enrollment free. $0.50 per enrollment. $10 top-ups.',
  },
  {
    title: 'Blog',
    path: '/blog',
    description:
      'News, updates, and insights from the Lesson Hollow team about self-directed learning.',
  },
  {
    title: 'Press Room',
    path: '/press',
    description:
      'Media coverage and press releases from Lesson Hollow, the curriculum building and progress tracking app for homeschool families.',
  },
  {
    title: 'Building a Curriculum File (Large Language Model Prompt)',
    path: '/help/llm/building-a-curriculum-file',
    description:
      'Instructions for large language models to generate a valid Lesson Hollow curriculum CSV file.',
  },
  {
    title: 'Using Open Source Curriculum Files',
    path: '/help/llm/using-open-source-curriculum-files',
    description:
      'Find real curriculum CSV examples and format documentation in the Lesson Hollow GitHub repository.',
  },
  {
    title: 'Building a Curriculum File',
    path: '/help/tips/building-a-curriculum-file',
    description: 'How to create a Lesson Hollow curriculum CSV using a spreadsheet.',
  },
  {
    title: 'Forking the Lesson Hollow Repo',
    path: '/help/tips/forking-the-lesson-hollow-repo',
    description:
      'Fork Lesson Hollow and vibe-code it into your own homeschool dashboard instead of building from scratch.',
  },
  {
    title: 'Model Context Protocol Server',
    path: '/api/mcp',
    description:
      'The Model Context Protocol (MCP) endpoint for AI assistants to manage players, curriculums, enrollments, and daily tasks programmatically.',
  },
  {
    title: 'GitHub Repository',
    path: 'https://github.com/sallycole/lessonhollow',
    description:
      'Full source code, curriculum CSV examples, and format documentation. MIT license.',
  },
]

function generateLlmsTxt(): string {
  const lines: string[] = []

  lines.push('# Lesson Hollow')
  lines.push('')
  lines.push(`> ${SUMMARY}`)
  lines.push('')

  lines.push('## Sitemaps')
  lines.push(
    `- [XML Sitemap](${SITE_URL}/sitemap.xml): Includes all crawlable and indexable pages.`
  )
  lines.push('')

  lines.push('## Pages')
  for (const page of STATIC_PAGES) {
    const url = page.path.startsWith('http') ? page.path : `${SITE_URL}${page.path}`
    lines.push(`- [${page.title}](${url}): ${page.description}`)
  }
  lines.push('')

  lines.push('## Curriculums')
  const registeredIds = Array.from(getRegisteredCurriculumIds())
  for (const id of registeredIds) {
    const landing = getLandingContent(id)
    if (!landing) continue
    const title = landing.hero.headline
    const url = `${SITE_URL}/discover/${landing.slug}`
    const description = landing.ogDescription || landing.hero.subhead
    lines.push(`- [${title}](${url}): ${description}`)
  }
  lines.push('')

  lines.push('## Posts')
  const posts = getAllPosts()
  for (const post of posts) {
    const title = post.title
    const url = `${SITE_URL}/blog/${post.slug}`
    const description = post.description || post.excerpt || `${post.title} on the Lesson Hollow blog.`
    lines.push(`- [${title}](${url}): ${description}`)
  }

  return lines.join('\n')
}

export async function GET() {
  const content = generateLlmsTxt()

  return new Response(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
