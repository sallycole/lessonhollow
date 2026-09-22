import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Using Open Source Curriculum Files — Lesson Hollow Help',
  description:
    'Find real curriculum CSV examples and format documentation in the Lesson Hollow GitHub repository.',
  openGraph: {
    title: 'Using Open Source Curriculum Files — Lesson Hollow Help',
    description:
      'Find real curriculum CSV examples and format documentation in the Lesson Hollow GitHub repository.',
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
    title: 'Using Open Source Curriculum Files — Lesson Hollow Help',
    description:
      'Find real curriculum CSV examples and format documentation in the Lesson Hollow GitHub repository.',
    images: ['/og/lesson-hollow-collage-og.png'],
  },
}

export default function UsingOpenSourceCurriculumFilesPage() {
  return (
    <>
      <hgroup>
        <h1>Using Open Source Curriculum Files</h1>
        <p>
          Lesson Hollow is open source. The curriculum CSV files that power the
          product are available on GitHub for you to study, download, or use
          directly.
        </p>
      </hgroup>

      <section>
        <h2>Where the source lives</h2>
        <p>
          The Lesson Hollow repository is at{' '}
          <a
            href="https://github.com/sallycole/lessonhollow"
            target="_blank"
            rel="noopener noreferrer"
          >
            github.com/sallycole/lessonhollow
          </a>
          . This is the full application that runs lessonhollow.com, including
          curriculum CSV examples and format documentation.
        </p>
      </section>

      <section>
        <h2>Curriculum CSV examples</h2>
        <p>
          The{' '}
          <a
            href="https://github.com/sallycole/lessonhollow/tree/main/public/curriculums"
            target="_blank"
            rel="noopener noreferrer"
          >
            public/curriculums
          </a>{' '}
          folder contains ready-to-import curriculum files. You can download any
          of these directly from lessonhollow.com at{' '}
          <code>https://lessonhollow.com/curriculums/&lt;name&gt;.csv</code> or
          view them on GitHub.
        </p>
        <p>
          Open a file, study how the metadata and tasks are structured, then
          adapt the format for your own curriculum or upload the file as-is.
        </p>
        <ul>
          <li>
            <a
              href="https://github.com/sallycole/lessonhollow/blob/main/public/curriculums/2nd-grade-math.csv"
              target="_blank"
              rel="noopener noreferrer"
            >
              2nd-grade-math.csv
            </a>
          </li>
          <li>
            <a
              href="https://github.com/sallycole/lessonhollow/blob/main/public/curriculums/3rd-grade-math.csv"
              target="_blank"
              rel="noopener noreferrer"
            >
              3rd-grade-math.csv
            </a>
          </li>
          <li>
            <a
              href="https://github.com/sallycole/lessonhollow/blob/main/public/curriculums/3rd-grade-reading-at-archive-org.csv"
              target="_blank"
              rel="noopener noreferrer"
            >
              3rd-grade-reading-at-archive-org.csv
            </a>
          </li>
          <li>
            <a
              href="https://github.com/sallycole/lessonhollow/blob/main/public/curriculums/5th-grade-english-language-arts-turtlediary.csv"
              target="_blank"
              rel="noopener noreferrer"
            >
              5th-grade-english-language-arts-turtlediary.csv
            </a>
          </li>
          <li>
            <a
              href="https://github.com/sallycole/lessonhollow/blob/main/public/curriculums/5th-grade-math.csv"
              target="_blank"
              rel="noopener noreferrer"
            >
              5th-grade-math.csv
            </a>
          </li>
          <li>
            <a
              href="https://github.com/sallycole/lessonhollow/blob/main/public/curriculums/52-library-visits-in-52-weeks.csv"
              target="_blank"
              rel="noopener noreferrer"
            >
              52-library-visits-in-52-weeks.csv
            </a>
          </li>
          <li>
            <a
              href="https://github.com/sallycole/lessonhollow/blob/main/public/curriculums/6th-grade-math.csv"
              target="_blank"
              rel="noopener noreferrer"
            >
              6th-grade-math.csv
            </a>
          </li>
          <li>
            <a
              href="https://github.com/sallycole/lessonhollow/blob/main/public/curriculums/a-library-to-build-great-americans.csv"
              target="_blank"
              rel="noopener noreferrer"
            >
              a-library-to-build-great-americans.csv
            </a>
          </li>
          <li>
            <a
              href="https://github.com/sallycole/lessonhollow/blob/main/public/curriculums/advanced-picture-books-at-archive-org.csv"
              target="_blank"
              rel="noopener noreferrer"
            >
              advanced-picture-books-at-archive-org.csv
            </a>
          </li>
          <li>
            <a
              href="https://github.com/sallycole/lessonhollow/blob/main/public/curriculums/augmented-reality-quests-on-meta-quest.csv"
              target="_blank"
              rel="noopener noreferrer"
            >
              augmented-reality-quests-on-meta-quest.csv
            </a>
          </li>
          <li>
            <a
              href="https://github.com/sallycole/lessonhollow/blob/main/public/curriculums/beginning-reading-at-archive-org.csv"
              target="_blank"
              rel="noopener noreferrer"
            >
              beginning-reading-at-archive-org.csv
            </a>
          </li>
          <li>
            <a
              href="https://github.com/sallycole/lessonhollow/blob/main/public/curriculums/computer-skills-for-kids.csv"
              target="_blank"
              rel="noopener noreferrer"
            >
              computer-skills-for-kids.csv
            </a>
          </li>
          <li>
            <a
              href="https://github.com/sallycole/lessonhollow/blob/main/public/curriculums/greek-myths-through-stories-maps-and-retellings.csv"
              target="_blank"
              rel="noopener noreferrer"
            >
              greek-myths-through-stories-maps-and-retellings.csv
            </a>
          </li>
          <li>
            <a
              href="https://github.com/sallycole/lessonhollow/blob/main/public/curriculums/iain-m-banks-galactic-civilization-starter-pack.csv"
              target="_blank"
              rel="noopener noreferrer"
            >
              iain-m-banks-galactic-civilization-starter-pack.csv
            </a>
          </li>
          <li>
            <a
              href="https://github.com/sallycole/lessonhollow/blob/main/public/curriculums/introduction-to-personal-curriculum.csv"
              target="_blank"
              rel="noopener noreferrer"
            >
              introduction-to-personal-curriculum.csv
            </a>
          </li>
          <li>
            <a
              href="https://github.com/sallycole/lessonhollow/blob/main/public/curriculums/k-8-american-history.csv"
              target="_blank"
              rel="noopener noreferrer"
            >
              k-8-american-history.csv
            </a>
          </li>
          <li>
            <a
              href="https://github.com/sallycole/lessonhollow/blob/main/public/curriculums/microsoft-reading-coach.csv"
              target="_blank"
              rel="noopener noreferrer"
            >
              microsoft-reading-coach.csv
            </a>
          </li>
          <li>
            <a
              href="https://github.com/sallycole/lessonhollow/blob/main/public/curriculums/middle-grade-reading-at-archive-org.csv"
              target="_blank"
              rel="noopener noreferrer"
            >
              middle-grade-reading-at-archive-org.csv
            </a>
          </li>
          <li>
            <a
              href="https://github.com/sallycole/lessonhollow/blob/main/public/curriculums/the-standard-algorithms-arithmetic-to-mastery.csv"
              target="_blank"
              rel="noopener noreferrer"
            >
              the-standard-algorithms-arithmetic-to-mastery.csv
            </a>
          </li>
          <li>
            <a
              href="https://github.com/sallycole/lessonhollow/blob/main/public/curriculums/typing-practice.csv"
              target="_blank"
              rel="noopener noreferrer"
            >
              typing-practice.csv
            </a>
          </li>
        </ul>
        <p>
          This folder may grow over time. Check the{' '}
          <a
            href="https://github.com/sallycole/lessonhollow/tree/main/public/curriculums"
            target="_blank"
            rel="noopener noreferrer"
          >
            curriculums folder on GitHub
          </a>{' '}
          for the latest list.
        </p>
      </section>

      <section>
        <h2>Format references in the repo</h2>
        <p>
          The repository includes documentation that describes the CSV format in
          detail.
        </p>
        <ul>
          <li>
            <a
              href="https://github.com/sallycole/lessonhollow/blob/main/public/curriculums/README.md"
              target="_blank"
              rel="noopener noreferrer"
            >
              public/curriculums/README.md
            </a>{' '}
            explains the format at a glance and how to contribute new
            curriculums.
          </li>
          <li>
            <a
              href="https://github.com/sallycole/lessonhollow/blob/main/docs/csv-format-gt2.md"
              target="_blank"
              rel="noopener noreferrer"
            >
              docs/csv-format-gt2.md
            </a>{' '}
            is the full CSV format specification.
          </li>
          <li>
            <a
              href="https://github.com/sallycole/lessonhollow/blob/main/public/lesson-hollow-template.csv"
              target="_blank"
              rel="noopener noreferrer"
            >
              public/lesson-hollow-template.csv
            </a>{' '}
            is a blank starter template you can fill in.
          </li>
          <li>
            <a
              href="https://github.com/sallycole/lessonhollow/blob/main/CONTRIBUTING.md"
              target="_blank"
              rel="noopener noreferrer"
            >
              CONTRIBUTING.md
            </a>{' '}
            describes how to contribute a new curriculum CSV to the repository.
          </li>
        </ul>
      </section>

      <section>
        <h2>How to use these with an LLM</h2>
        <p>
          When asking an LLM to build a curriculum for you, giving it a real
          example helps it match the format correctly.
        </p>
        <ol>
          <li>
            Paste a link to one of the example CSVs above, or open the file on
            GitHub, click <strong>Raw</strong>, and copy the contents into your
            chat.
          </li>
          <li>
            Ask the model to follow the same structure for your new curriculum.
          </li>
          <li>
            Keep the Action column to exactly one of <strong>Read</strong>,{' '}
            <strong>Watch</strong>, <strong>Listen</strong>, or{' '}
            <strong>Do</strong>.
          </li>
          <li>
            Wrap any field containing a comma in double quotes so the CSV parses
            correctly.
          </li>
          <li>
            Verify that any URLs the model generates actually work before you
            upload.
          </li>
        </ol>
        <p>
          For a copy-paste prompt with all the format rules, see{' '}
          <Link href="/help/llm/building-a-curriculum-file">
            Building a Curriculum File (LLM)
          </Link>
          . For a step-by-step spreadsheet walkthrough, see{' '}
          <Link href="/help/tips/building-a-curriculum-file">
            Building a Curriculum File
          </Link>
          .
        </p>
      </section>

      <section>
        <h2>Upload your CSV</h2>
        <p>
          Once you have a curriculum CSV ready, upload it through{' '}
          <strong>Curriculums</strong> &rarr; <strong>New Curriculum</strong>{' '}
          &rarr; <strong>CSV Upload</strong>.
        </p>
      </section>
    </>
  )
}
