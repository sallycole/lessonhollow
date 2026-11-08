# Contributing press content

This guide covers adding media coverage and publishing press releases for the Lesson Hollow press room at `/press`.

## Adding media coverage

Media coverage entries are external articles that mention or review Lesson Hollow. These are stored in a single JSON file at `content/press/coverage.json`.

### Coverage entry format

Each entry in the array has these fields:

| Field         | Required | Description                                                |
|---------------|----------|------------------------------------------------------------|
| `id`          | yes      | Unique identifier (kebab-case, include date if helpful)    |
| `title`       | yes      | Article title exactly as published                         |
| `publisher`   | yes      | Publisher name                                             |
| `publisherUrl`| no       | Homepage URL of the publisher                              |
| `url`         | yes      | Full URL to the article                                    |
| `date`        | no       | Publication date in `YYYY-MM-DD` format, or `null` if unknown |
| `dateNote`    | no       | Informal date note when exact date is unavailable (e.g. "Last checked October 2026") |
| `summary`     | yes      | One or two sentences describing the article                |

### Example entry

```json
{
  "id": "example-review-2026-11-02",
  "title": "Lesson Hollow: a homeschool planner with no calendar",
  "publisher": "Example Publication",
  "publisherUrl": "https://example.com",
  "url": "https://example.com/blog/lesson-hollow-review",
  "date": "2026-11-02",
  "summary": "A review covering Lesson Hollow's task-list approach to homeschool planning."
}
```

### Guidelines

- Read the article and use the exact title as published
- Write a neutral, factual summary based on what the article actually says
- Do not fabricate quotes, awards, rankings, or endorsements
- If an exact publication date is not stated, use `"date": null` with a `dateNote` for context
- If multiple articles are from the same publisher, do not imply they are independent sources

## Publishing a press release

Press releases are Markdown files stored in `content/press/releases/`. Each release has its own URL at `/press/releases/<slug>`.

### File location and slug

Save the release at `content/press/releases/<slug>.md`. The slug becomes the URL path and must be lowercase and hyphen-separated. Example: `content/press/releases/announcing-version-2.md` becomes `/press/releases/announcing-version-2`.

### Frontmatter schema

Every release starts with a YAML frontmatter block:

| Field      | Required | Description                                                    |
|------------|----------|----------------------------------------------------------------|
| `title`    | yes      | Plain string headline                                          |
| `date`     | yes      | Publication date in `YYYY-MM-DD` format                        |
| `published`| no       | Boolean, defaults to `true`. Set `false` to keep a draft hidden |
| `excerpt`  | no       | Short summary for the press room listing (max 200 characters)  |

### Example release

```markdown
---
title: Lesson Hollow Announces New Feature
date: 2026-12-01
published: true
excerpt: Today we are announcing a new feature for homeschool families.
---

Today we are pleased to announce a new feature that helps homeschool families...

## Details

The feature includes...
```

### Guidelines

- Use clear, factual language
- Follow Lesson Hollow style: no em dashes, direct sentences, skip filler
- The body content can be as long as needed
- Set `published: false` to preview a draft locally before going live

## Local preview

After adding or editing content, run:

```bash
npm run dev
```

Then visit `http://localhost:3000/press` to preview the press room.

## Validation

Press content is loaded at build time. Run the build to catch any schema errors:

```bash
npm run build
```

Invalid entries will produce console errors with details about what needs fixing.
