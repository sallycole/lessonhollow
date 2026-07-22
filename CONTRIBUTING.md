# Contributing to Lesson Hollow

Thanks for your interest in improving Lesson Hollow. This guide covers code contributions and
curriculum contributions.

## Development setup

See the [README](./README.md#local-development). In short: `cp .env.example .env.local`, fill in
your own keys, `npm install`, `npm run dev`.

## Before you open a pull request

Run the same checks CI and the build will run:

```bash
npm run lint       # eslint
npm test           # vitest unit tests
npm run build      # production build (also validates blog posts)
```

End-to-end tests need a configured `.env.local` and a running app:

```bash
npm run test:e2e   # playwright
```

## Branch and PR flow

- `main` is the deploy branch — every push to `main` deploys to production. Do your work on a
  feature branch and open a PR against `main`.
- Keep PRs focused. Describe what changed and why, and note any schema (`supabase/migrations/`)
  or environment-variable changes.
- Please do not commit secrets. Real keys belong in `.env.local` (git-ignored); only
  `.env.example` placeholders are tracked.

## Contributing a curriculum

Curricula are plain CSV files. To add one to the published set:

1. Author a CSV following the format in [`docs/csv-format-gt2.md`](./docs/csv-format-gt2.md) and
   the examples in [`public/curriculums/`](./public/curriculums/). Start from
   [`public/lesson-hollow-template.csv`](./public/lesson-hollow-template.csv).
2. Name the file in kebab-case (e.g. `52-library-visits-in-52-weeks.csv`) and drop it in
   `public/curriculums/`.
3. Open a PR. Once merged, the file is downloadable at
   `https://lessonhollow.com/curriculums/<name>.csv` and can be imported through the in-app CSV
   uploader.

See [`public/curriculums/README.md`](./public/curriculums/README.md) for the format summary.
