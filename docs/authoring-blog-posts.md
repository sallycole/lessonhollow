# Authoring blog posts

This guide is for whoever (human or AI) is writing blog posts for Lesson Hollow. Posts live as Markdown files under `content/blog/`. The build will fail loudly if a post violates the rules below, so it is faster to follow them up front than to find out at deploy time.

## File location and slug

Save the post at `content/blog/<slug>.md`. The slug is the part of the URL after `/blog/` and must be lowercase, hyphen-separated, and unique. Example: `content/blog/why-personal-curriculum-works.md` becomes `https://lessonhollow.com/blog/why-personal-curriculum-works`.

## Frontmatter schema

Every post starts with a YAML frontmatter block. The fields the renderer reads are:

| Field              | Required | Notes                                                                  |
|--------------------|----------|------------------------------------------------------------------------|
| `title`            | yes      | Plain string, no quotes needed unless it contains a colon.             |
| `date`             | yes      | `YYYY-MM-DD` format.                                                   |
| `categories`       | no       | YAML list of strings. Defaults to `[]`.                                |
| `published`        | no       | Boolean. Defaults to `true`. Set `false` to keep a draft out of the index. |
| `excerpt`          | no       | Promo text for the index card. **Hard limit: 110 characters.** See below. |
| `featuredImage`    | no       | Absolute path under `public/`, e.g. `/blog/my-hero.jpg`. File must exist. |
| `featuredImageAlt` | no       | Plain-text alt for screen readers and OpenGraph.                       |

Example:

```yaml
---
title: How to Build a Personal Curriculum That Your Kid Actually Wants to Start
date: 2026-04-09
categories:
  - homeschooling
  - curriculum
published: true
excerpt: A practical guide to curriculum that feels structured, flexible, and worth starting.
featuredImage: /blog/personal-curriculum-kitchen-table-homeschool.jpg
featuredImageAlt: Two kids drawing at a sunlit kitchen table with books, art supplies, and a laptop nearby.
---
```

## The excerpt rule (the one that breaks builds)

The excerpt renders inside a 3-line CSS clamp on a card that is around 312px wide at the narrowest 2-column layout (Tailwind `md:` breakpoint, 768px viewport). At 16px Geist Sans, that gives roughly 37 characters per line, so three lines hold about 110 characters of average text.

- **Hard maximum: 110 characters.** The build script `scripts/validate-blog-posts.mjs` runs as the npm `prebuild` hook and rejects anything longer. Past 110, the Fly deploy fails before the image is built.
- **Target: about 95 characters.** Leaves a little headroom for wider letters and avoids the third line being a single word.
- Aim for one tight sentence, or two very short ones. The excerpt is promo text on a card, not a summary of the article.
- Past tense or present tense, both fine. Lead with the value to the reader.

Examples that fit:

- `A practical guide to curriculum that feels structured, flexible, and worth starting.` (86 chars)
- `Introducing Lesson Hollow, a personal curriculum tracker for self-directed learners.` (85 chars)

If a draft is over 110, the validator output will tell you exactly how many characters and which file. Trim and re-run.

## Style notes

- **No em dashes.** Lesson Hollow copy avoids them. Use a comma, a period, or a parenthesis. If you need a dash for ranges or compound words, use a hyphen.
- Plain language. Direct sentences. Skip filler.
- The post body itself has no length limit.

## Featured image

- Aspect ratio **16:9**. The renderer sets `width=1600 height=900` on the article hero and `width=1200 height=675` on the index card; both crop with `object-cover` so non-16:9 images will be cropped on every device.
- **Minimum 1024×576**. Larger is fine; Next.js will handle responsive sizing.
- **JPEG**, under ~200KB. The validator only checks that the file exists at the path you reference; size and format are on you.
- Save under `public/blog/<slug>-hero.jpg` so it lives next to the post that owns it.
- Always provide `featuredImageAlt`. Describe what is in the image, not what it represents.

## Local validation

Before pushing, run:

```bash
node scripts/validate-blog-posts.mjs
```

This is exactly what the prebuild hook runs, so if it passes here it will pass on Fly. To go all the way and confirm the page renders, run `npm run build` (which calls the validator first, then `next build`).

## What gets shipped where

- The Markdown file goes to `content/blog/<slug>.md`.
- The hero image goes to `public/blog/<slug>-hero.jpg` (or whatever path you put in `featuredImage`).
- Push the branch, open the post on the index, scan the card to make sure the excerpt is not getting clipped, then merge to `main`. Pushing `main` triggers a GitHub Actions deploy to Fly.
