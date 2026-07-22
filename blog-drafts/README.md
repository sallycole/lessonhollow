# Lesson Hollow blog drafts

This folder is the single source of truth for in-flight blog posts. Each post lives in its own subfolder keyed by **slug** (kebab-case, matches the published URL).

## Folder layout

```
blog-drafts/
├── README.md                    ← this file
├── _template/                   ← copy this to start a new post
│   ├── meta.yaml
│   ├── originals.yaml
│   ├── interview.md
│   ├── POST-SLUG.md
│   ├── assets/
│   │   └── .gitkeep
│   ├── infographics/
│   │   └── .gitkeep
│   └── promotion/
│       └── .gitkeep
├── <slug>/                      ← in-flight posts (status 1–12)
└── published/<slug>/            ← terminal-state posts (status 13)
```

## Why slug-key, not issue-number?

Earlier scattered folders used the Gitea issue number (95, 97, 98, 99, 105, 107) as the key. Slugs are more durable: they survive issue renumbering, they match the published URL, they match `meta.yaml:slug`, they match the asset paths under `~/Pictures/...`, and they match the Gitea issue template's `slug` field. The issue number is recorded in `meta.yaml:gitea_issue_number` instead.

## Status enum

14 lifecycle states + 2 terminal states. Mirror these names exactly in any new tooling (the issue template at `.github/ISSUE_TEMPLATE/blog-post.yml` uses the same set).

1. `suggested` — captured as an idea; no work yet
2. `researching` — gathering sources, examples, prior art
3. `interviewing` — drafting/refining the interview Q's; or running the interview
4. `outlining` — outline drafted; sections agreed
5. `drafting` — body copy in progress
6. `self-reviewed` — author has re-read and tightened
7. `ready-for-review` — handed to Chief Human for editorial pass
8. `revising` — Chief Human's notes incorporated, or in progress
9. `hero-pending` — copy locked, hero image not yet chosen / generated
10. `infographics-pending` — copy locked, in-post infographics not built
11. `ready-to-publish` — all assets present; awaiting schedule
12. `scheduled` — date set; not yet live
13. `published` — live on the site
14. `needs-update` — published but flagged for revision (link rot, stale numbers, etc.)

Terminal:
- `rejected` — never publishing; closes the issue
- `archived` — published then retired; closes the issue

## meta.yaml schema

Every post folder MUST contain a `meta.yaml` at its root:

```yaml
slug: start-learning-before-you-finish-planning   # canonical key, matches folder name
working_title: "Start the Learning Before You Finish the Planning"
status: published                                 # one of the 14 states or 2 terminals
gitea_issue_number: 110                           # null until the issue is opened
audience: homeschool-parents                      # see Gitea template dropdown
organic_search_angle: |
  How to start homeschooling without finishing the curriculum first.
hero_aesthetic: A3                                # cross-ref image-aesthetic skill
target_publish_date: 2026-04-15                   # YYYY-MM-DD or null
actual_publish_date: 2026-04-18                   # null until status >= published
authors:
  - sallycole
tags:
  - getting-started
  - planning
```

## originals.yaml schema

Tracks the high-resolution source images that DO NOT live in the repo (kept under `~/Pictures/lessonhollow/blog-originals/<slug>/` because the PNG sources are too large for git):

```yaml
hero:
  filename: hero.png                              # in ~/Pictures/lessonhollow/blog-originals/<slug>/
  generator: fal-ai/flux-pro
  prompt_file: assets/hero-prompt.md
  generated_at: 2026-04-15T10:32:00-05:00
  webp_target: ../blog/hero-start-learning-before-you-finish-planning.webp
infographics:
  - filename: buy-time-mechanic-source.png
    source: rendered-from-html
    html_file: infographics/buy-time-mechanic.html
    webp_target: ../blog-infographics/start-learning-before-you-finish-planning-buy-time-mechanic.webp
```

## Lifecycle

```
suggested → researching → interviewing → outlining → drafting → self-reviewed →
  ready-for-review → revising → hero-pending → infographics-pending →
  ready-to-publish → scheduled → published → (needs-update | archived)

at any point: → rejected
```

## Replacement table (lazy migration of existing scatter)

| Old location                                   | New location                                       | When to migrate                |
|------------------------------------------------|----------------------------------------------------|--------------------------------|
| `blog-drafts/<issue#>/`                        | `blog-drafts/<slug>/`                              | Next time you touch the post   |
| `blog-assets/<slug>/`                          | `blog-drafts/<slug>/assets/`                       | Next time you touch the post   |
| `blog-infographics/<slug>-*.{html,jpg,webp}`   | `blog-drafts/<slug>/infographics/`                 | Next time you touch the post   |
| `blog-image-plans/<slug>.md`                   | `blog-drafts/<slug>/assets/hero-prompt.md`         | Next time you touch the post   |
| `blog-editorial/<slug>.md`                     | `blog-drafts/<slug>/interview.md` or notes section | Next time you touch the post   |
| `blog-promotion/<slug>.md`                     | `blog-drafts/<slug>/promotion/`                    | Next time you touch the post   |
| `blog/<slug>.md` (final published copy)        | stays put (this is the served file)                | never                          |
| `<slug>-source.png` originals (currently in `blog-assets/<slug>/`) | `~/Pictures/lessonhollow/blog-originals/<slug>/` | When folder is migrated |

**Lazy migration policy:** do not bulk-migrate. Migrate a post only when you're already opening it for other reasons (revision, hero regen, etc.). The replacement table is the contract; existing scatter is grandfathered.

## Three open questions

These are flagged so the next pass can resolve them rather than rediscover them.

1. **Should `published/<slug>/` exist as a sibling, or should `status: published` posts stay in `blog-drafts/<slug>/`?** Current draft says sibling for cleaner separation; matches the part-3 validation plan. Alternative: flat layout with status as the only signal. Recommendation: sibling.

2. **Should `~/Pictures/lessonhollow/blog-originals/` move into the repo via Git LFS, or stay external?** Current draft says external because PNG sources are large and the LH repo is not LFS-configured today. LFS would unify the picture but adds setup cost.

3. **For posts that bypassed the lifecycle (already published before this README existed), what `status` field do we backfill?** Recommendation: `published` plus a `legacy_layout: true` flag in `meta.yaml` so tooling knows the asset pack is incomplete.
