# Lesson Hollow

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

Lesson Hollow is a homeschool curriculum planner and daily learning tracker. Parents (or
self-directed learners) build or import curricula, enroll players (students), and work a
paced daily task list. It is a [Next.js](https://nextjs.org) app backed by
[Supabase](https://supabase.com) and deployed to [Fly.io](https://fly.io).

Live at **[lessonhollow.com](https://lessonhollow.com)**.

**Why this exists:** I built it so a curriculum becomes a paced daily list instead of a
static outline you re-plan every morning. The planner, the CSV curriculum format, and the
agent MCP surface are open source under MIT so families and builders can inspect, self-host,
and contribute.

**Try it fast**

1. Use the live app: [lessonhollow.com](https://lessonhollow.com)
2. Browse example curricula in [`public/curriculums/`](./public/curriculums/)
3. Run locally with the steps under [Local development](#local-development)

## Features

- **Curricula & tasks** — author curricula by hand or import them from CSV; each task is a
  Read / Watch / Listen / Do action with an optional resource link.
- **Players & enrollments** — enroll one or more players (students) in a curriculum with a start
  date and a pace; the app schedules a daily list from there.
- **Today & Log** — a timezone-aware daily task list and a running activity log per player.
- **Discover** — public curriculum landing pages for browsing and importing.
- **MCP server** — a built-in [Model Context Protocol](https://modelcontextprotocol.io) endpoint
  so agents can create curricula, enroll players, and drive the daily list programmatically.

## Tech stack

| Layer      | Choice                                                            |
|------------|-------------------------------------------------------------------|
| Framework  | Next.js 16 (App Router, standalone output), React 19, TypeScript |
| Styling    | Pico CSS, Lucide icons                                            |
| State      | Zustand                                                           |
| Backend    | Supabase (Postgres + Auth); schema in `supabase/migrations/`      |
| Payments   | Zaprite (Bitcoin, Lightning, card)                               |
| Images     | fal.ai (reward image generation)                                 |
| Email      | AWS SES                                                          |
| Hosting    | Fly.io (Docker, blue-green)                                       |

## Local development

This repo ships a Nix + direnv dev shell (`flake.nix`, `.envrc`). With
[direnv](https://direnv.net) installed, `direnv allow` drops you into a shell with the right
Node toolchain. Without Nix, use Node 22.

```bash
cp .env.example .env.local     # fill in your own keys (see table below)
npm install
npm run dev                    # http://localhost:3000
```

Other scripts:

```bash
npm run build      # production build (runs the blog-post validator first via prebuild)
npm run lint       # eslint
npm test           # vitest unit tests
npm run test:e2e   # playwright end-to-end tests
```

### Environment variables

Copy `.env.example` to `.env.local` and fill in your own values. `NEXT_PUBLIC_*` variables are
exposed to the browser; the rest are server-only.

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project URL + publishable anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase access |
| `SUPABASE_JWT_SECRET` | Verifies MCP API-key auth |
| `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_SITE_URL` | App/site base URLs (redirects, RSS) |
| `ZAPRITE_API_KEY` / `ZAPRITE_WEBHOOK_SECRET` | Payments |
| `FAL_KEY` | fal.ai reward-image generation |
| `API_KEY_ENCRYPTION_KEY` | AES-256-GCM key for encrypting stored fal.ai keys (32 bytes hex) |
| `AWS_SES_REGION` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_SES_FROM_EMAIL` | Feedback-notification email |
| `ADMIN_PLAYER_AUTH_USER_ID` | Curricula from this player auto-publish (leave unset to disable) |
| `NEXT_PUBLIC_GOOGLE_SHEETS_TEMPLATE_URL` | Public "make a copy" link for the CSV template |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Google Analytics 4 (leave empty to disable) |
| `TEST_*` | E2E test-account credentials |

## Curriculum CSV format

Curricula can be imported from CSV. Ready-to-use curriculum files live in
[`public/curriculums/`](./public/curriculums/); the full spec is in
[`docs/csv-format-gt2.md`](./docs/csv-format-gt2.md). A blank template is at
[`public/lesson-hollow-template.csv`](./public/lesson-hollow-template.csv).

## Deployment

Pushing to `main` triggers the GitHub Actions workflow in
[`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml), which cleans up stale blue-green
machines and runs `flyctl deploy --remote-only` against the Fly app `lessonhollow`. The only
required repository secret is `FLY_API_TOKEN`. Public `NEXT_PUBLIC_*` build args are baked in via
`fly.toml`; all runtime secrets are managed as Fly secrets, not in this repo.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md), including how to contribute a curriculum CSV.

## License

[MIT](./LICENSE) © 2026 Sally Cole
