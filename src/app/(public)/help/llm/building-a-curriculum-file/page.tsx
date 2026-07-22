import type { Metadata } from 'next'
import { PageActions } from './page-actions'

export const metadata: Metadata = {
  title: 'Building a Curriculum File (LLM) — Lesson Hollow Help',
  description:
    'Instructions for LLMs to generate a valid Lesson Hollow curriculum CSV file.',
  openGraph: {
    title: 'Building a Curriculum File (LLM) — Lesson Hollow Help',
    description:
      'Instructions for LLMs to generate a valid Lesson Hollow curriculum CSV file.',
    images: [
      {
        url: '/og/lesson-hollow-collage-og.png',
        width: 1200,
        height: 630,
        alt: 'Lesson Hollow Help',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Building a Curriculum File (LLM) — Lesson Hollow Help',
    description:
      'Instructions for LLMs to generate a valid Lesson Hollow curriculum CSV file.',
    images: ['/og/lesson-hollow-collage-og.png'],
  },
}

const LLM_PROMPT_BLOCK = `Create a Lesson Hollow curriculum CSV using this EXACT format. Follow every rule below.

=== RULES (follow these strictly) ===

1. The file must start with exactly these 5 metadata rows in this order:
   Name,<curriculum name>
   Description,<curriculum description>
   Publisher,<publisher name>
   Grade Level,<one of: Any, Pre-K, Kindergarten, 1st Grade, 2nd Grade, 3rd Grade, 4th Grade, 5th Grade, 6th Grade, 7th Grade, 8th Grade, 9th Grade, 10th Grade, 11th Grade, 12th Grade, College, Adult>
   Link,<curriculum URL>

2. After the 5 metadata rows, add ONE blank line.

3. Then add the header row:
   Title,Description,Action,URL

4. Then add task rows. Each task row must have exactly 4 columns.

5. CRITICAL: The Description column MUST be wrapped in double quotes if it contains a comma, quote, or newline. Example of a correct row:
   "Email Basics","Create a Gmail account, add family contacts, and email a parent.",Do,https://example.com/email

6. Action must be exactly one of: Read, Watch, Listen, Do

7. Never put commas in the Action column.

8. Do not add extra columns or extra lines.

=== END OF RULES ===

Now create the curriculum CSV following the rules above.`

export default function LlmBuildingCurriculumPage() {
  return (
    <>
      <hgroup>
        <h1>Building a Curriculum File</h1>
        <p>
          Copy the text below and paste it into ChatGPT, Claude, or another LLM.
          Then describe the curriculum you want.
        </p>
      </hgroup>

      <pre>
        <code>{LLM_PROMPT_BLOCK}</code>
      </pre>

      <PageActions text={LLM_PROMPT_BLOCK} />
    </>
  )
}
