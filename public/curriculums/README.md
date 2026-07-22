# Curriculum CSVs

Raw, ready-to-import curriculum files for Lesson Hollow. Each `.csv` here is downloadable at
`https://lessonhollow.com/curriculums/<name>.csv` and can be imported through the in-app CSV
uploader or the `import_tasks_csv` MCP tool.

The full specification is in [`docs/csv-format-gt2.md`](../../docs/csv-format-gt2.md). A blank
starter template is [`public/lesson-hollow-template.csv`](../lesson-hollow-template.csv).

## Format at a glance

A curriculum CSV has two sections. Blank rows anywhere are ignored, and the file is standard
RFC-4180 (quote fields containing commas, quotes, or newlines).

**1. Metadata** — two-column `Key,Value` rows (keys are case-insensitive):

| Key | Required | Meaning |
|-----|----------|---------|
| `Name` | **Yes** | Curriculum name (the only required field) |
| `Description` | No | Short description |
| `Publisher` | No | Publisher / author |
| `Grade Level` | No | One of: `Any`, `Pre-K`, `Kindergarten`, `1st Grade`…`12th Grade`, `College`, `Adult` |
| `Link` **or** `Resource URL` | No | Curriculum-level resource URL |

**2. Tasks** — begins at the first row whose first column is `Title`. The header is
`Title,Description,Action,URL` (columns may appear in any order; they're matched by label):

| Column | Required | Meaning |
|--------|----------|---------|
| `Title` | **Yes** | Task title (rows with an empty title are skipped) |
| `Description` | No | Task description |
| `Action` | **Yes** | One of `Read`, `Watch`, `Listen`, `Do` (case-insensitive) |
| `URL` | No | Per-task resource URL |

See [`52-library-visits-in-52-weeks.csv`](./52-library-visits-in-52-weeks.csv) for a complete
worked example.

## Contributing a curriculum

Author a CSV in this format, name it in kebab-case, drop it in this folder, and open a pull
request. See the repo's [CONTRIBUTING.md](../../CONTRIBUTING.md) for the full flow.
