import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Forking the Lesson Hollow Repo — Lesson Hollow Help',
  description:
    'Fork Lesson Hollow and vibe-code it into your own homeschool dashboard instead of building from scratch.',
  openGraph: {
    title: 'Forking the Lesson Hollow Repo — Lesson Hollow Help',
    description:
      'Fork Lesson Hollow and vibe-code it into your own homeschool dashboard instead of building from scratch.',
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
    title: 'Forking the Lesson Hollow Repo — Lesson Hollow Help',
    description:
      'Fork Lesson Hollow and vibe-code it into your own homeschool dashboard instead of building from scratch.',
    images: ['/og/lesson-hollow-collage-og.png'],
  },
}

export default function ForkingTheRepoPage() {
  return (
    <>
      <hgroup>
        <h1>Forking the Lesson Hollow Repo</h1>
        <p>
          Any vibe coder can build a homeschool dashboard from scratch, but that
          is a poor use of tokens. Fork Lesson Hollow, vibe-code it into your
          perfect learning management system, and self-host it. Spend the tokens
          you save on the important part: the study sequences (curricula) that
          learners open from the dashboard.
        </p>
      </hgroup>

      <section>
        <h2>The repository</h2>
        <p>
          Lesson Hollow is open source under the MIT license. The full
          repository is at{' '}
          <a
            href="https://github.com/sallycole/lessonhollow"
            target="_blank"
            rel="noopener noreferrer"
          >
            github.com/sallycole/lessonhollow
          </a>
          . Fork it to your own GitHub account, then clone your fork locally.
        </p>
      </section>

      <section>
        <h2>Local setup</h2>
        <p>
          After cloning, install dependencies and start the dev server. The repo
          includes a Nix flake for reproducible tooling. If you have Nix and
          direnv installed, run <code>direnv allow</code> to drop into a shell
          with Node 22 ready. Without Nix, install Node 22 yourself.
        </p>
        <ol>
          <li>
            Copy <code>.env.example</code> to <code>.env.local</code> and fill
            in your own keys. The file documents each variable. At minimum you
            need Supabase credentials.
          </li>
          <li>
            Run <code>npm install</code> to install dependencies.
          </li>
          <li>
            Run <code>npm run dev</code> to start the local server at{' '}
            <code>http://localhost:3000</code>.
          </li>
        </ol>
        <p>
          See the README for the full list of environment variables. Most are
          optional for local development. You only need to fill in what you
          plan to use.
        </p>
      </section>

      <section>
        <h2>Self-hosting</h2>
        <p>
          The app is designed to deploy to Fly.io via Docker. The repo includes
          a <code>Dockerfile</code> and <code>fly.toml</code> that work out of
          the box. You can also deploy to any platform that supports Docker
          containers or the Next.js standalone output.
        </p>
        <p>
          Check the README for deployment details and how to configure Fly
          secrets for production.
        </p>
      </section>

      <section>
        <h2>Spend your tokens on curricula</h2>
        <p>
          Once the dashboard works, point your LLM sessions at building great
          curricula instead of reinventing plumbing. Curricula are where
          learning outcomes happen. The dashboard just keeps them organized.
        </p>
        <ul>
          <li>
            <Link href="/help/tips/building-a-curriculum-file">
              Building a Curriculum File
            </Link>{' '}
            walks through creating a curriculum CSV by hand in a spreadsheet.
          </li>
          <li>
            <Link href="/help/llm/building-a-curriculum-file">
              Building a Curriculum File (LLM)
            </Link>{' '}
            gives you a copy-paste prompt so your LLM outputs valid CSV.
          </li>
          <li>
            <Link href="/help/llm/using-open-source-curriculum-files">
              Using Open Source Curriculum Files
            </Link>{' '}
            lists ready-made curriculum CSVs you can study or import directly.
          </li>
        </ul>
      </section>

      <section>
        <h2>Contributing upstream</h2>
        <p>
          If you build a curriculum worth sharing, consider contributing it back
          to the main repository. The{' '}
          <a
            href="https://github.com/sallycole/lessonhollow/blob/main/CONTRIBUTING.md"
            target="_blank"
            rel="noopener noreferrer"
          >
            CONTRIBUTING.md
          </a>{' '}
          file explains how to submit a curriculum CSV via pull request. Your
          curriculum can then appear on lessonhollow.com for other families to
          use.
        </p>
      </section>
    </>
  )
}
